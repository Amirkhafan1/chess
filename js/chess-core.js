/* chess-core.js — a compact, self-contained chess rules engine (no dependencies).
 * Squares: 0..63, a1=0, b1=1, ... h1=7, a2=8 ... h8=63.
 * Pieces: type 1..6 = P N B R Q K ; white = type, black = type|8.
 */
(function (global) {
  'use strict';
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const PCH = '.pnbrqk';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const KN_T = [], KG_T = [], RAYS_B = [], RAYS_R = [];
  (function init() {
    for (let s = 0; s < 64; s++) {
      const f = s & 7, r = s >> 3;
      KN_T[s] = []; KG_T[s] = [];
      for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
        const nf = f + df, nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) KN_T[s].push(nr * 8 + nf);
      }
      for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        const nf = f + df, nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) KG_T[s].push(nr * 8 + nf);
      }
      const ray = (dirs) => dirs.map(([df, dr]) => {
        const a = []; let nf = f + df, nr = r + dr;
        while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) { a.push(nr * 8 + nf); nf += df; nr += dr; }
        return a;
      });
      RAYS_B[s] = ray([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
      RAYS_R[s] = ray([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    }
  })();

  const CASTLE_MASK = new Array(64).fill(15);
  CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[7] = 15 & ~1; CASTLE_MASK[4] = 15 & ~3;
  CASTLE_MASK[56] = 15 & ~8; CASTLE_MASK[63] = 15 & ~4; CASTLE_MASK[60] = 15 & ~12;

  const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
  const sqIndex = (n) => (n.charCodeAt(0) - 97) + (n.charCodeAt(1) - 49) * 8;

  class Chess {
    constructor(fen) { this.load(fen || START); }

    load(fen) {
      const parts = fen.trim().split(/\s+/);
      this.board = new Int8Array(64);
      let r = 7, f = 0;
      for (const ch of parts[0]) {
        if (ch === '/') { r--; f = 0; }
        else if (ch >= '1' && ch <= '8') f += +ch;
        else {
          const lower = ch.toLowerCase();
          const t = PCH.indexOf(lower);
          this.board[r * 8 + f] = t | (ch === lower ? 8 : 0);
          f++;
        }
      }
      this.turn = parts[1] === 'b' ? 1 : 0;
      this.castle = 0;
      const c = parts[2] || '-';
      if (c.includes('K')) this.castle |= 1;
      if (c.includes('Q')) this.castle |= 2;
      if (c.includes('k')) this.castle |= 4;
      if (c.includes('q')) this.castle |= 8;
      this.ep = parts[3] && parts[3] !== '-' ? sqIndex(parts[3]) : -1;
      this.half = parseInt(parts[4] || '0', 10) || 0;
      this.full = parseInt(parts[5] || '1', 10) || 1;
      this.kings = [-1, -1];
      for (let i = 0; i < 64; i++) {
        if ((this.board[i] & 7) === K) this.kings[this.board[i] >> 3] = i;
      }
      this.stack = [];      // undo records
      this.log = [];        // public history: {move, san, fen}
      this.keys = [this._key()];
      this._legal = null;
      this.startFen = this.fen();
    }

    fen() {
      let s = '';
      for (let r = 7; r >= 0; r--) {
        let e = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 8 + f];
          if (!p) { e++; continue; }
          if (e) { s += e; e = 0; }
          const ch = PCH[p & 7];
          s += (p >> 3) ? ch : ch.toUpperCase();
        }
        if (e) s += e;
        if (r) s += '/';
      }
      let c = '';
      if (this.castle & 1) c += 'K'; if (this.castle & 2) c += 'Q';
      if (this.castle & 4) c += 'k'; if (this.castle & 8) c += 'q';
      return `${s} ${this.turn ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
    }

    _key() {
      let ep = '-';
      if (this.ep >= 0) {
        // only count ep if a pawn of the side to move can actually capture
        const us = this.turn, pawn = P | (us << 3), f = this.ep & 7;
        const base = us === 0 ? this.ep - 8 : this.ep + 8;
        if ((f > 0 && this.board[base - 1] === pawn) || (f < 7 && this.board[base + 1] === pawn)) ep = String(this.ep);
      }
      return this.fen().split(' ').slice(0, 3).join(' ') + ' ' + ep;
    }

    get(sq) { return this.board[typeof sq === 'string' ? sqIndex(sq) : sq]; }

    isAttacked(sq, by) {
      const b = this.board, f = sq & 7;
      if (by === 0) {
        if (f > 0 && sq - 9 >= 0 && b[sq - 9] === P) return true;
        if (f < 7 && sq - 7 >= 0 && b[sq - 7] === P) return true;
      } else {
        if (f > 0 && sq + 7 < 64 && b[sq + 7] === (P | 8)) return true;
        if (f < 7 && sq + 9 < 64 && b[sq + 9] === (P | 8)) return true;
      }
      const cb = by << 3;
      for (const t of KN_T[sq]) if (b[t] === (N | cb)) return true;
      for (const t of KG_T[sq]) if (b[t] === (K | cb)) return true;
      for (const ray of RAYS_B[sq]) {
        for (const t of ray) {
          const p = b[t];
          if (p) { if (p === (B | cb) || p === (Q | cb)) return true; break; }
        }
      }
      for (const ray of RAYS_R[sq]) {
        for (const t of ray) {
          const p = b[t];
          if (p) { if (p === (R | cb) || p === (Q | cb)) return true; break; }
        }
      }
      return false;
    }

    inCheck(side) {
      const s = side === undefined ? this.turn : side;
      return this.isAttacked(this.kings[s], s ^ 1);
    }

    /** pseudo-legal moves (may leave own king in check). */
    pseudo(capturesOnly) {
      const b = this.board, us = this.turn, cb = us << 3, out = [];
      const add = (from, to, piece, cap, promo, flag) => out.push({ from, to, piece, cap, promo: promo || 0, flag: flag || '' });
      for (let s = 0; s < 64; s++) {
        const p = b[s];
        if (!p || (p >> 3) !== us) continue;
        const t = p & 7, f = s & 7, r = s >> 3;
        if (t === P) {
          const dir = us === 0 ? 8 : -8, startR = us === 0 ? 1 : 6, promoR = us === 0 ? 6 : 1;
          const one = s + dir;
          if (!b[one]) {
            if (r === promoR) { for (const pr of [Q, R, B, N]) add(s, one, p, 0, pr); }
            else if (!capturesOnly) {
              add(s, one, p, 0);
              if (r === startR && !b[one + dir]) add(s, one + dir, p, 0, 0, 'd');
            }
          }
          for (const df of [-1, 1]) {
            const nf = f + df; if (nf < 0 || nf > 7) continue;
            const to = one + df;
            if (b[to] && (b[to] >> 3) !== us) {
              if (r === promoR) { for (const pr of [Q, R, B, N]) add(s, to, p, b[to], pr); }
              else add(s, to, p, b[to]);
            } else if (to === this.ep && !b[to]) {
              add(s, to, p, P | ((us ^ 1) << 3), 0, 'e');
            }
          }
        } else if (t === N || t === K) {
          for (const to of (t === N ? KN_T[s] : KG_T[s])) {
            const q = b[to];
            if (!q) { if (!capturesOnly) add(s, to, p, 0); }
            else if ((q >> 3) !== us) add(s, to, p, q);
          }
          if (t === K && !capturesOnly) {
            const base = us === 0 ? 0 : 56;
            if (s === base + 4 && !this.isAttacked(s, us ^ 1)) {
              if ((this.castle & (us === 0 ? 1 : 4)) && !b[base + 5] && !b[base + 6] && b[base + 7] === (R | cb) &&
                !this.isAttacked(base + 5, us ^ 1) && !this.isAttacked(base + 6, us ^ 1)) add(s, base + 6, p, 0, 0, 'k');
              if ((this.castle & (us === 0 ? 2 : 8)) && !b[base + 1] && !b[base + 2] && !b[base + 3] && b[base] === (R | cb) &&
                !this.isAttacked(base + 3, us ^ 1) && !this.isAttacked(base + 2, us ^ 1)) add(s, base + 2, p, 0, 0, 'q');
            }
          }
        } else {
          const rays = t === B ? RAYS_B[s] : t === R ? RAYS_R[s] : RAYS_B[s].concat(RAYS_R[s]);
          for (const ray of rays) {
            for (const to of ray) {
              const q = b[to];
              if (!q) { if (!capturesOnly) add(s, to, p, 0); }
              else { if ((q >> 3) !== us) add(s, to, p, q); break; }
            }
          }
        }
      }
      return out;
    }

    /** low-level make; returns nothing, pushes to this.stack */
    make(m) {
      const b = this.board, us = this.turn;
      const u = { m, castle: this.castle, ep: this.ep, half: this.half, full: this.full };
      this.stack.push(u);
      b[m.from] = 0;
      if (m.flag === 'e') b[us === 0 ? m.to - 8 : m.to + 8] = 0;
      b[m.to] = m.promo ? (m.promo | (us << 3)) : m.piece;
      if (m.flag === 'k') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
      else if (m.flag === 'q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
      if ((m.piece & 7) === K) this.kings[us] = m.to;
      this.castle &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
      this.ep = m.flag === 'd' ? (m.from + m.to) >> 1 : -1;
      this.half = ((m.piece & 7) === P || m.cap) ? 0 : this.half + 1;
      if (us === 1) this.full++;
      this.turn = us ^ 1;
    }

    unmake() {
      const u = this.stack.pop(), m = u.m, b = this.board;
      this.turn ^= 1;
      const us = this.turn;
      b[m.from] = m.piece;
      if (m.flag === 'e') { b[m.to] = 0; b[us === 0 ? m.to - 8 : m.to + 8] = m.cap; }
      else b[m.to] = m.cap;
      if (m.flag === 'k') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
      else if (m.flag === 'q') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
      if ((m.piece & 7) === K) this.kings[us] = m.from;
      this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.full = u.full;
    }

    moves() {
      if (this._legal) return this._legal;
      const us = this.turn, res = [];
      for (const m of this.pseudo()) {
        this.make(m);
        if (!this.isAttacked(this.kings[us], us ^ 1)) res.push(m);
        this.unmake();
      }
      this._legal = res;
      return res;
    }

    movesFrom(sq) { return this.moves().filter((m) => m.from === sq); }

    _san(m) {
      if (m.flag === 'k') return 'O-O';
      if (m.flag === 'q') return 'O-O-O';
      const t = m.piece & 7, legal = this.moves();
      let s = '';
      if (t !== P) {
        s = PCH[t].toUpperCase();
        const others = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
        if (others.length) {
          const sameFile = others.some((o) => (o.from & 7) === (m.from & 7));
          const sameRank = others.some((o) => (o.from >> 3) === (m.from >> 3));
          if (!sameFile) s += 'abcdefgh'[m.from & 7];
          else if (!sameRank) s += (m.from >> 3) + 1;
          else s += sqName(m.from);
        }
      } else if (m.cap) s = 'abcdefgh'[m.from & 7];
      if (m.cap) s += 'x';
      s += sqName(m.to);
      if (m.promo) s += '=' + PCH[m.promo].toUpperCase();
      return s;
    }

    /** play a legal move. a/b are squares (index or name) ; returns move (with .san) or null */
    move(from, to, promo) {
      if (typeof from === 'string') from = sqIndex(from);
      if (typeof to === 'string') to = sqIndex(to);
      if (typeof promo === 'string') promo = PCH.indexOf(promo.toLowerCase());
      const m = this.moves().find((x) => x.from === from && x.to === to && (x.promo || 0) === (promo || 0));
      if (!m) return null;
      let san = this._san(m);
      this.make(m);
      this._legal = null;
      const chk = this.inCheck();
      if (chk) san += this.moves().length ? '+' : '#';
      m.san = san;
      m.uci = sqName(m.from) + sqName(m.to) + (m.promo ? PCH[m.promo] : '');
      this.log.push({ move: m, san, fen: this.fen() });
      this.keys.push(this._key());
      return m;
    }

    undo() {
      if (!this.log.length) return null;
      const e = this.log.pop();
      this.unmake();
      this.keys.pop();
      this._legal = null;
      return e.move;
    }

    isCheckmate() { return this.inCheck() && this.moves().length === 0; }
    isStalemate() { return !this.inCheck() && this.moves().length === 0; }
    isInsufficient() {
      const minors = []; let bishopsSq = [];
      for (let i = 0; i < 64; i++) {
        const p = this.board[i]; if (!p) continue;
        const t = p & 7;
        if (t === P || t === R || t === Q) return false;
        if (t === N || t === B) { minors.push(p); if (t === B) bishopsSq.push((i & 7) + (i >> 3)); }
      }
      if (minors.length <= 1) return true;
      if (minors.every((p) => (p & 7) === B)) {
        const par = bishopsSq.map((x) => x & 1);
        return par.every((x) => x === par[0]);
      }
      return false;
    }
    isThreefold() {
      const k = this.keys[this.keys.length - 1];
      let c = 0; for (const x of this.keys) if (x === k) c++;
      return c >= 3;
    }
    /** returns null or {over:true, result:'1-0'|'0-1'|'1/2-1/2', reason} */
    status() {
      if (this.isCheckmate()) return { over: true, result: this.turn === 0 ? '0-1' : '1-0', reason: 'checkmate' };
      if (this.isStalemate()) return { over: true, result: '1/2-1/2', reason: 'stalemate' };
      if (this.isInsufficient()) return { over: true, result: '1/2-1/2', reason: 'insufficient' };
      if (this.isThreefold()) return { over: true, result: '1/2-1/2', reason: 'repetition' };
      if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty' };
      return { over: false };
    }

    pgn(headers, result) {
      const h = Object.assign({ Event: 'Casual game', Site: '?', Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), White: '?', Black: '?', Result: result || '*' }, headers || {});
      let out = Object.entries(h).map(([k, v]) => `[${k} "${v}"]`).join('\n') + '\n\n';
      const startFull = parseInt(this.startFen.split(' ')[5], 10) || 1;
      const startBlack = this.startFen.split(' ')[1] === 'b';
      this.log.forEach((e, i) => {
        const idx = i + (startBlack ? 1 : 0);
        if (idx % 2 === 0) out += `${startFull + (idx >> 1)}. `;
        else if (i === 0) out += `${startFull}... `;
        out += e.san + ' ';
      });
      return out + (result || '*');
    }
  }

  Chess.START = START; Chess.sqName = sqName; Chess.sqIndex = sqIndex; Chess.PCH = PCH;
  global.Chess = Chess;
})(typeof self !== 'undefined' ? self : this);
