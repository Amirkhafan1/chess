/* engine.js — one interface for two back-ends:
 *   1) Stockfish (WASM, UCI over a Web Worker)   -> files in /engine
 *   2) built-in alpha-beta bot (js/builtin-ai.js) -> automatic fallback
 */
(function () {
  const CFG = window.CHESS_CONFIG || {};

  // id, SF settings, built-in bot settings, rough strength label
  const LEVELS = [
    { id: 1, elo: 800,  sf: { skill: 0, depth: 1, ms: 60 },            ai: { depth: 1, time: 300, noise: 220 } },
    { id: 2, elo: 1100, sf: { skill: 3, depth: 3, ms: 120 },           ai: { depth: 2, time: 400, noise: 110 } },
    { id: 3, elo: 1500, sf: { elo: 1500, ms: 300 },                    ai: { depth: 3, time: 700, noise: 45 } },
    { id: 4, elo: 1900, sf: { elo: 1900, ms: 500 },                    ai: { depth: 4, time: 1200, noise: 12 } },
    { id: 5, elo: 2400, sf: { elo: 2400, ms: 800 },                    ai: { depth: 5, time: 2000, noise: 0 } },
    { id: 6, elo: 2900, sf: { elo: 2900, ms: 1500 },                   ai: { depth: 6, time: 3000, noise: 0 } },
    { id: 7, elo: 3500, sf: { full: true, ms: 'impossible' },          ai: { depth: 7, time: 'impossible', noise: 0 } }
  ];

  class EngineClient {
    constructor() {
      this.kind = null;     // 'stockfish' | 'builtin'
      this.worker = null;
      this.listener = null; // current line listener (stockfish)
      this.pending = null;  // {resolve, id}
      this.seq = 0;
    }

    async init() {
      this.error = '';
      if (location.protocol === 'file:') {
        this.error = 'file:// — سایت را باید از روی هاست (http/https) باز کنی، نه با دابل‌کلیک';
      } else {
        const cands = [CFG.stockfishJs, 'engine/stockfish-19-lite-single.js', 'engine/stockfish-17.1-lite-single.js', 'engine/stockfish.js']
          .filter((x, i, a) => x && a.indexOf(x) === i);
        for (const url of cands) {
          try {
            await this._initStockfish(url);
            this.kind = 'stockfish'; this.url = url;
            return this.kind;
          } catch (e) {
            this._killWorker();
            console.info('[engine] ' + url + ' failed:', e && e.message);
            // keep the error of the configured file (first candidate) as the main reason
            if (!this.error) this.error = url + ' → ' + (e && e.message);
          }
        }
      }
      this._initBuiltin();
      this.kind = 'builtin';
      return this.kind;
    }

    _killWorker() { if (this.worker) { try { this.worker.terminate(); } catch (e) { /* */ } this.worker = null; } }

    _initBuiltin() {
      this.worker = new Worker('js/builtin-ai.js');
      this.worker.onmessage = (e) => {
        const d = e.data;
        if (this.pending && this.pending.id === d.id) {
          const p = this.pending; this.pending = null; p.resolve(d.uci ? { uci: d.uci, score: d.score, mate: d.mate, depth: d.depth } : null);
        }
      };
    }

    async _initStockfish(url) {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('stockfish.js HTTP ' + r.status);
      const head = (await r.text()).slice(0, 200).trim();
      if (head.startsWith('<')) throw new Error('stockfish.js not found (HTML returned)');
      const w = new Worker(url);
      this.worker = w;
      w.onmessage = (e) => { if (this.listener) this.listener(String(e.data)); };
      let fail = null;
      w.onerror = (e) => { console.warn('[engine] worker error', e.message); if (fail) fail(new Error('worker error: ' + (e.message || 'cannot load'))); };
      const wait = (pred, timeout) => new Promise((resolve, reject) => {
        const to = setTimeout(() => { this.listener = null; fail = null; reject(new Error('UCI timeout (فایل .wasm بارگذاری نشد؟)')); }, timeout);
        fail = (err) => { clearTimeout(to); this.listener = null; fail = null; reject(err); };
        this.listener = (line) => { if (pred(line)) { clearTimeout(to); fail = null; this.listener = null; resolve(line); } };
      });
      w.postMessage('uci');
      await wait((l) => l.startsWith('uciok'), CFG.engineLoadTimeoutMs || 30000);
      w.postMessage('setoption name Hash value 32');
      w.postMessage('setoption name Threads value 1');
      w.postMessage('isready');
      await wait((l) => l.startsWith('readyok'), 15000);
    }

    cancel() {
      if (this.kind === 'stockfish' && this.worker && this.active) this.worker.postMessage('stop');
      if (this.kind === 'builtin' && this.pending) {
        // the built-in bot cannot be interrupted mid-search; restart the worker
        this._killWorker(); this._initBuiltin();
        if (this.pending) { const p = this.pending; this.pending = null; p.resolve(null); }
      }
    }

    /** level: object from LEVELS, opts: {full:boolean, ms:number} for hints */
    async search(fen, level, opts) {
      // serialize: wait until a cancelled/previous search has fully finished
      while (this.active) { try { await this.active; } catch (e) { /* ignore */ } }
      const p = this._search(fen, level, opts);
      this.active = p;
      try { return await p; } finally { if (this.active === p) this.active = null; }
    }

    _search(fen, level, opts) {
      opts = opts || {};
      const id = ++this.seq;
      const impossibleMs = (opts.impossibleMs || CFG.impossibleMovetimeMs || 3000);
      const whiteToMove = fen.split(' ')[1] !== 'b';
      if (this.kind === 'stockfish') return this._searchSF(fen, level, opts, impossibleMs, whiteToMove);
      return new Promise((resolve) => {
        const a = level.ai;
        const time = opts.ms || (a.time === 'impossible' ? Math.min(impossibleMs, 8000) : a.time);
        this.pending = { id, resolve };
        this.worker.postMessage({ id, fen, depth: opts.hint ? 5 : a.depth, time, noise: opts.hint ? 0 : a.noise });
      });
    }

    _searchSF(fen, level, opts, impossibleMs, whiteToMove) {
      const w = this.worker, s = level.sf;
      return new Promise((resolve) => {
        let last = null;
        const cap = (cp) => Math.max(-3000, Math.min(3000, cp));
        const finish = (line) => {
          this.listener = null;
          const m = line.split(/\s+/)[1];
          if (!m || m === '(none)') return resolve(null);
          resolve(Object.assign({ uci: m }, last || { score: 0, depth: 0 }));
        };
        this.listener = (line) => {
          if (line.startsWith('info') && line.includes(' score ')) {
            const mm = line.match(/score (cp|mate) (-?\d+)/), dd = line.match(/ depth (\d+)/);
            if (mm && !line.includes('lowerbound') && !line.includes('upperbound')) {
              let sc = parseInt(mm[2], 10), mate = mm[1] === 'mate';
              let cp = mate ? (sc > 0 ? 10000 - sc : -10000 - sc) : sc;
              if (!whiteToMove) cp = -cp;
              last = { score: mate ? cp : cap(cp), mate, mateIn: mate ? Math.abs(sc) : 0, depth: dd ? +dd[1] : 0 };
            }
          } else if (line.startsWith('bestmove')) finish(line);
        };
        const full = opts.full || s.full;
        w.postMessage('ucinewgame');
        if (full) {
          w.postMessage('setoption name UCI_LimitStrength value false');
          w.postMessage('setoption name Skill Level value 20');
        } else if (s.elo) {
          w.postMessage('setoption name Skill Level value 20');
          w.postMessage('setoption name UCI_LimitStrength value true');
          w.postMessage('setoption name UCI_Elo value ' + s.elo);
        } else {
          w.postMessage('setoption name UCI_LimitStrength value false');
          w.postMessage('setoption name Skill Level value ' + s.skill);
        }
        w.postMessage('position fen ' + fen);
        const ms = opts.ms || (s.ms === 'impossible' ? impossibleMs : s.ms);
        w.postMessage('go ' + (s.depth && !full ? 'depth ' + s.depth + ' ' : '') + 'movetime ' + ms);
      });
    }
  }

  window.EngineClient = EngineClient;
  window.LEVELS = LEVELS;
})();
