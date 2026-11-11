/* app.js — UI + game flow */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => I18N.t(k, v);
  const KEY = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };
  const VALUE = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  const OPENINGS = [
    ['e4 e5 Nf3 Nc6 Bb5 a6', 'Ruy López: Morphy Defence'], ['e4 e5 Nf3 Nc6 Bb5', 'Ruy López'], ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Giuoco Piano'],
    ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Two Knights Defence'], ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'], ['e4 e5 Nf3 Nc6 d4', 'Scotch Game'],
    ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'Four Knights Game'], ['e4 e5 Nf3 Nf6', 'Petrov’s Defence'], ['e4 e5 Nf3 Nc6', 'King’s Knight Opening'],
    ['e4 e5 Nf3', 'King’s Knight Opening'], ['e4 e5 f4', 'King’s Gambit'], ['e4 e5 Nc3', 'Vienna Game'], ['e4 e5 Bc4', 'Bishop’s Opening'], ['e4 e5', 'Open Game'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian: Najdorf'], ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', 'Sicilian: Dragon'],
    ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4', 'Sicilian: Open'], ['e4 c5 Nf3 e6', 'Sicilian: French Variation'], ['e4 c5 Nc3', 'Sicilian: Closed'], ['e4 c5 c3', 'Sicilian: Alapin'], ['e4 c5', 'Sicilian Defence'],
    ['e4 e6 d4 d5 Nc3', 'French: Classical'], ['e4 e6 d4 d5 e5', 'French: Advance'], ['e4 e6', 'French Defence'], ['e4 c6', 'Caro-Kann Defence'],
    ['e4 d5', 'Scandinavian Defence'], ['e4 d6', 'Pirc Defence'], ['e4 g6', 'Modern Defence'], ['e4 Nf6', 'Alekhine’s Defence'], ['e4', 'King’s Pawn Opening'],
    ['d4 d5 c4 e6', 'Queen’s Gambit Declined'], ['d4 d5 c4 dxc4', 'Queen’s Gambit Accepted'], ['d4 d5 c4 c6', 'Slav Defence'], ['d4 d5 c4', 'Queen’s Gambit'],
    ['d4 Nf6 c4 g6 Nc3 Bg7 e4', 'King’s Indian Defence'], ['d4 Nf6 c4 g6', 'King’s Indian Defence'], ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defence'],
    ['d4 Nf6 c4 e6 Nf3 b6', 'Queen’s Indian Defence'], ['d4 Nf6 c4 e6', 'Indian Game'], ['d4 Nf6 Bg5', 'Trompowsky Attack'], ['d4 f5', 'Dutch Defence'],
    ['d4 d5 Bf4', 'London System'], ['d4 Nf6 Nf3 g6 Bf4', 'London System'], ['d4 d5', 'Closed Game'], ['d4', 'Queen’s Pawn Opening'],
    ['c4 e5', 'English: Reversed Sicilian'], ['c4', 'English Opening'], ['Nf3 d5 g3', 'King’s Indian Attack'], ['Nf3', 'Réti Opening'], ['f4', 'Bird’s Opening'], ['b3', 'Nimzo-Larsen Attack'], ['g3', 'King’s Fianchetto']
  ];

  /* ---------- state ---------- */
  let game = new Chess();
  let playerColor = 0, level = LEVELS[6], flipped = false;
  let over = null, thinking = false, hinting = false, searchToken = 0;
  let selected = -1, lastMove = null, hintMove = null, viewPly = null;
  let evalHist = [0], evalNow = 0, evalMate = 0;
  let engineReady = null, engine = new EngineClient(), engineKind = null;
  let clock = { on: false, w: 0, b: 0, inc: 0, last: 0 };
  let timeSpec = '0';
  let resignArmed = false, drag = null;
  const settings = Object.assign({ theme: 'ocean', legal: true, autoQueen: false, think: 3, sound: true, level: 7, color: 'w', time: '0' }, store.get('ic_settings', {}));
  const saveSettings = () => store.set('ic_settings', settings);

  /* ---------- board DOM ---------- */
  const boardEl = $('board');
  const sqEls = [];     // by visual index
  const pieceEls = new Map(); // square -> element
  let piecesLayer;

  function buildBoard() {
    boardEl.innerHTML = '';
    for (let v = 0; v < 64; v++) {
      const d = document.createElement('div'); d.className = 'sq';
      d.innerHTML = '<i class="co r"></i><i class="co f"></i>';
      boardEl.appendChild(d); sqEls.push(d);
    }
    piecesLayer = document.createElement('div'); piecesLayer.className = 'pieces';
    boardEl.appendChild(piecesLayer);
    labelSquares();
  }
  const visToSq = (x, y) => (flipped ? y * 8 + (7 - x) : (7 - y) * 8 + x);
  const sqToVis = (sq) => { const f = sq & 7, r = sq >> 3; return flipped ? { x: 7 - f, y: r } : { x: f, y: 7 - r }; };
  function labelSquares() {
    for (let v = 0; v < 64; v++) {
      const x = v & 7, y = v >> 3, sq = visToSq(x, y), el = sqEls[v];
      el.dataset.sq = sq;
      el.classList.toggle('dark', ((sq & 7) + (sq >> 3)) % 2 === 0);
      el.querySelector('.r').textContent = x === 0 ? (sq >> 3) + 1 : '';
      el.querySelector('.f').textContent = y === 7 ? 'abcdefgh'[sq & 7] : '';
    }
  }
  const pieceSvg = (p) => `<svg class="pc ${p >> 3 ? 'pc-b' : 'pc-w'}" viewBox="0 0 100 100"><use href="#p-${KEY[p & 7]}"/></svg>`;
  function setPos(el, sq) { const p = sqToVis(sq); el.style.transform = `translate(${p.x * 100}%, ${p.y * 100}%)`; }
  function buildPieces(c) {
    piecesLayer.innerHTML = ''; pieceEls.clear();
    for (let sq = 0; sq < 64; sq++) {
      const p = c.board[sq]; if (!p) continue;
      const el = document.createElement('div'); el.className = 'piece'; el.innerHTML = pieceSvg(p);
      piecesLayer.appendChild(el); setPos(el, sq); pieceEls.set(sq, el);
    }
  }
  function animateMove(mv, mover) {
    const el = pieceEls.get(mv.from);
    const capSq = mv.flag === 'e' ? (mover === 0 ? mv.to - 8 : mv.to + 8) : mv.to;
    const cap = pieceEls.get(capSq);
    if (cap && cap !== el) { pieceEls.delete(capSq); cap.classList.add('captured'); setTimeout(() => cap.remove(), 220); }
    if (el) {
      pieceEls.delete(mv.from); el.classList.remove('dragging'); pieceEls.set(mv.to, el); setPos(el, mv.to);
      if (mv.promo) el.innerHTML = pieceSvg(mv.promo | (mover << 3));
    }
    if (mv.flag === 'k' || mv.flag === 'q') {
      const rf = mv.flag === 'k' ? mv.to + 1 : mv.to - 2, rt = mv.flag === 'k' ? mv.to - 1 : mv.to + 1;
      const r = pieceEls.get(rf); if (r) { pieceEls.delete(rf); pieceEls.set(rt, r); setPos(r, rt); }
    }
  }

  function viewChess() {
    if (viewPly === null || viewPly >= game.log.length) return game;
    return new Chess(viewPly === 0 ? game.startFen : game.log[viewPly - 1].fen);
  }

  /* ---------- painting ---------- */
  function paintSquares() {
    const c = viewChess();
    const lm = viewPly === null || viewPly >= game.log.length ? lastMove : (viewPly > 0 ? game.log[viewPly - 1].move : null);
    const chk = c.inCheck() ? c.kings[c.turn] : -1;
    const dests = new Map();
    if (selected >= 0 && viewPly === null) for (const m of game.movesFrom(selected)) dests.set(m.to, m.cap ? 'cap' : 'dot');
    for (let v = 0; v < 64; v++) {
      const el = sqEls[v], sq = +el.dataset.sq;
      el.classList.toggle('last', !!lm && (sq === lm.from || sq === lm.to));
      el.classList.toggle('sel', sq === selected);
      el.classList.toggle('check', sq === chk);
      el.classList.toggle('dot', settings.legal && dests.get(sq) === 'dot');
      el.classList.toggle('cap', settings.legal && dests.get(sq) === 'cap');
    }
    drawArrow();
  }
  function drawArrow() {
    const svg = $('arrows');
    svg.querySelectorAll('line').forEach((l) => l.remove());
    if (!hintMove || viewPly !== null) return;
    const a = sqToVis(hintMove.from), b = sqToVis(hintMove.to);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', a.x * 100 + 50); ln.setAttribute('y1', a.y * 100 + 50);
    ln.setAttribute('x2', b.x * 100 + 50); ln.setAttribute('y2', b.y * 100 + 50);
    ln.setAttribute('stroke', '#22d3ee'); ln.setAttribute('stroke-width', '14'); ln.setAttribute('stroke-linecap', 'round');
    ln.setAttribute('opacity', '.85'); ln.setAttribute('marker-end', 'url(#ah)');
    svg.appendChild(ln);
  }

  function fmtClock(ms) {
    if (ms <= 0) return '0:00';
    const s = Math.ceil(ms / 1000);
    if (ms < 10000) return '0:0' + (ms / 1000).toFixed(1);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function materialInfo(c) {
    const cnt = [{}, {}];
    for (let i = 0; i < 64; i++) { const p = c.board[i]; if (p) { const col = p >> 3, ty = p & 7; cnt[col][ty] = (cnt[col][ty] || 0) + 1; } }
    const start = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
    const captured = [[], []]; // pieces of color X that were captured
    const score = [0, 0];
    for (const col of [0, 1]) {
      for (const ty of [5, 4, 3, 2, 1]) {
        const lost = Math.max(0, start[ty] - (cnt[col][ty] || 0));
        for (let i = 0; i < lost; i++) captured[col].push(ty | (col << 3));
      }
      for (const ty of [1, 2, 3, 4, 5]) score[col] += (cnt[col][ty] || 0) * VALUE[ty];
    }
    return { captured, diff: score[0] - score[1] };
  }

  function renderPlayers() {
    const c = viewChess(), mi = materialInfo(c);
    const robotColor = 1 - playerColor;
    const robotName = engineKind === 'stockfish' ? t('sfName') : t('aiName');
    const lvlName = t('lvl' + level.id);
    const bits = {
      robot: { name: robotName, sub: `${lvlName} · ~${level.id === 7 ? '3500+' : level.elo}`, av: '🤖', color: robotColor },
      you: { name: t('you'), sub: t(playerColor === 0 ? 'white' : 'black'), av: '🙂', color: playerColor }
    };
    const top = flipped ? bits.you : bits.robot, bot = flipped ? bits.robot : bits.you;
    for (const [pre, b] of [['top', top], ['bot', bot]]) {
      $(pre + 'Avatar').textContent = b.av;
      $(pre + 'Name').textContent = b.name; $(pre + 'Sub').textContent = b.sub;
      // pieces this player captured = pieces of the opposite color missing
      const opp = 1 - b.color;
      const adv = b.color === 0 ? mi.diff : -mi.diff;
      $(pre + 'Captured').innerHTML = mi.captured[opp].map((p) => pieceSvg(p)).join('') + (adv > 0 ? `<em>+${adv}</em>` : '');
    }
    $('topPlayer').classList.toggle('active', !over && c.turn === (flipped ? playerColor : robotColor));
    $('botPlayer').classList.toggle('active', !over && c.turn === (flipped ? robotColor : playerColor));
    renderClocks();
  }
  function renderClocks() {
    const robotColor = 1 - playerColor;
    const show = clock.on;
    $('topClock').hidden = !show; $('botClock').hidden = !show;
    if (!show) return;
    const rem = (col) => (col === 0 ? clock.w : clock.b);
    $('topClock').textContent = fmtClock(rem(flipped ? playerColor : robotColor));
    $('botClock').textContent = fmtClock(rem(flipped ? robotColor : playerColor));
    $('topClock').classList.toggle('low', rem(flipped ? playerColor : robotColor) < 10000);
    $('botClock').classList.toggle('low', rem(flipped ? robotColor : playerColor) < 10000);
  }

  function renderMoves() {
    const ol = $('moveList'); ol.innerHTML = '';
    const log = game.log; const sb = game.startFen.split(' ')[1] === 'b';
    const cur = viewPly === null ? log.length : viewPly;
    const mk = (i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mv' + (i + 1 === cur ? ' cur' : '');
      b.textContent = log[i].san; b.addEventListener('click', () => gotoPly(i + 1)); return b;
    };
    let i = 0;
    while (i < log.length) {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'no'; n.textContent = Math.floor((i + (sb ? 1 : 0)) / 2) + 1 + '.';
      li.appendChild(n);
      if (sb && i === 0) { const e = document.createElement('span'); e.className = 'mv empty'; e.textContent = '…'; li.appendChild(e); li.appendChild(mk(0)); i++; }
      else { li.appendChild(mk(i)); i++; if (i < log.length) { li.appendChild(mk(i)); i++; } }
      ol.appendChild(li);
    }
    ol.scrollTop = ol.scrollHeight;
    // opening
    const seq = log.map((e) => e.san.replace(/[+#]/g, '')).join(' ');
    let name = '';
    for (const [m, n] of OPENINGS) { if ((seq + ' ').startsWith(m + ' ') || seq === m) { name = n; break; } }
    $('openingName').textContent = log.length ? (name ? `${t('openingLabel')}: ${name}` : '') : t('startPos');
  }

  function evalPct(cp) { return 50 + 50 * Math.tanh(cp / 450); }
  function renderEval() {
    const pct = evalPct(evalNow);
    const fill = $('evalFill'), bar = $('evalBar');
    fill.style.height = pct + '%';
    bar.classList.toggle('flip', flipped);
    let label;
    if (evalMate) label = 'M' + evalMate; else label = (evalNow >= 0 ? '+' : '') + (evalNow / 100).toFixed(1);
    $('evalLabel').textContent = label;
    $('evalLabel').classList.toggle('onwhite', pct >= 50);
    // graph
    const g = $('evalGraph'), n = evalHist.length;
    if (n < 2) { g.innerHTML = ''; return; }
    const W = 120, H = 28, step = W / Math.max(n - 1, 12);
    const pts = evalHist.map((cp, i) => `${(i * step).toFixed(1)},${(H / 2 - Math.max(-800, Math.min(800, cp)) / 800 * (H / 2 - 1)).toFixed(1)}`);
    g.innerHTML = `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 2"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent2)" stroke-width="1.6" stroke-linejoin="round"/>`;
  }

  function renderStatus() {
    const el = $('statusText'); el.className = 'status';
    if (over) { el.textContent = t('gameOver') + ' — ' + t('r_' + over.reason); el.classList.add('over'); }
    else if (viewPly !== null && viewPly < game.log.length) { el.textContent = `${viewPly} / ${game.log.length}`; el.classList.add('review'); }
    else if (thinking) { el.textContent = t('robotTurn'); el.classList.add('think'); }
    else if (hinting) { el.textContent = t('hintThinking'); el.classList.add('think'); }
    else { el.textContent = (game.inCheck() ? t('inCheck') + ' ' : '') + (game.turn === playerColor ? t('yourTurn') : t('robotTurn')); if (game.inCheck()) el.classList.add('chk'); }
    $('thinking').hidden = !(thinking || hinting);
    $('btnUndo').disabled = game.log.length === 0 || (game.log.length === 1 && playerColor === 1 && !over && !thinking);
    $('btnHint').disabled = !canMove();
    $('btnDraw').disabled = !!over || game.log.length < 2;
    $('btnResign').disabled = !!over;
    if (!resignArmed) $('btnResign').firstElementChild.textContent = t('resign');
  }

  function renderAll(full) {
    if (full) buildPieces(viewChess());
    paintSquares(); renderPlayers(); renderMoves(); renderEval(); renderStatus();
  }

  /* ---------- sound ---------- */
  let actx = null;
  function beep(freq, dur, type, vol, when) {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + (when || 0);
      o.type = type || 'triangle'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol || 0.15, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  const sfx = {
    move() { beep(300, 0.07, 'triangle', 0.18); },
    capture() { beep(180, 0.12, 'square', 0.12); beep(120, 0.1, 'triangle', 0.2, 0.01); },
    check() { beep(660, 0.09, 'sine', 0.16); beep(880, 0.12, 'sine', 0.16, 0.09); },
    castle() { beep(260, 0.06, 'triangle', 0.16); beep(330, 0.07, 'triangle', 0.16, 0.08); },
    end(win) { [0, 1, 2].forEach((i) => beep((win ? [523, 659, 784] : [392, 330, 262])[i], 0.25, 'sine', 0.16, i * 0.14)); }
  };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- game flow ---------- */
  const canMove = () => !over && !thinking && !hinting && game.turn === playerColor && (viewPly === null || viewPly >= game.log.length);

  function parseTime(spec) {
    if (!spec || spec === '0') return { on: false, base: 0, inc: 0 };
    const [m, i] = spec.split('+').map(Number); return { on: true, base: m * 60000, inc: (i || 0) * 1000 };
  }

  function startNewGame(opts) {
    searchToken++; engine.cancel(); thinking = false; hinting = false;
    level = LEVELS.find((l) => l.id === opts.level) || LEVELS[6];
    playerColor = opts.color === 'r' ? (Math.random() < 0.5 ? 0 : 1) : (opts.color === 'b' ? 1 : 0);
    flipped = playerColor === 1;
    game = new Chess(); over = null; selected = -1; lastMove = null; hintMove = null; viewPly = null;
    evalHist = [0]; evalNow = 0; evalMate = 0; timeSpec = opts.time || '0';
    const tc = parseTime(timeSpec);
    clock = { on: tc.on, w: tc.base, b: tc.base, inc: tc.inc, last: Date.now() };
    labelSquares(); renderAll(true); save();
    if (game.turn !== playerColor) engineMove();
  }

  function save() {
    if (over) { store.del('ic_game'); return; }
    store.set('ic_game', { level: level.id, color: playerColor, time: timeSpec, moves: game.log.map((e) => e.move.uci), clock: { on: clock.on, w: clock.w, b: clock.b, inc: clock.inc }, evalHist });
  }

  function restore() {
    const s = store.get('ic_game', null);
    if (!s || !Array.isArray(s.moves)) return false;
    try {
      level = LEVELS.find((l) => l.id === s.level) || LEVELS[6];
      playerColor = s.color === 1 ? 1 : 0; flipped = playerColor === 1; timeSpec = s.time || '0';
      game = new Chess();
      for (const u of s.moves) { if (!game.move(u.slice(0, 2), u.slice(2, 4), u[4])) throw new Error('bad move'); }
      lastMove = game.log.length ? { from: game.log[game.log.length - 1].move.from, to: game.log[game.log.length - 1].move.to } : null;
      evalHist = Array.isArray(s.evalHist) && s.evalHist.length === game.log.length + 1 ? s.evalHist : new Array(game.log.length + 1).fill(0);
      evalNow = evalHist[evalHist.length - 1]; evalMate = 0;
      clock = Object.assign({ on: false, w: 0, b: 0, inc: 0 }, s.clock || {}); clock.last = Date.now();
      over = null; selected = -1; hintMove = null; viewPly = null;
      const st = game.status(); if (st.over) { return false; }
      labelSquares(); renderAll(true);
      if (game.turn !== playerColor) engineMove();
      return true;
    } catch (e) { store.del('ic_game'); return false; }
  }

  async function chooseRobotMove(fenBefore) {
    const base = level.id === 7 ? settings.think * 1000 : (engineKind === 'stockfish' ? level.sf.ms : level.ai.time);
    const opts = { impossibleMs: settings.think * 1000 };
    if (clock.on) { const rem = playerColor === 0 ? clock.b : clock.w; opts.ms = Math.max(60, Math.min(base, rem / 25)); }
    return engine.search(fenBefore, level, opts);
  }

  async function engineMove() {
    if (over || game.turn === playerColor) return;
    const token = ++searchToken;
    thinking = true; selected = -1; hintMove = null; paintSquares(); renderStatus();
    if (engineReady) await engineReady;
    if (token !== searchToken) return;
    const t0 = Date.now();
    let res = null;
    try { res = await chooseRobotMove(game.fen()); } catch (e) { console.warn(e); }
    const el = Date.now() - t0; if (el < 450) await sleep(450 - el);
    if (token !== searchToken) return;
    let mv = null;
    if (res && res.uci) {
      const u = res.uci;
      mv = game.moves().find((m) => m.from === Chess.sqIndex(u.slice(0, 2)) && m.to === Chess.sqIndex(u.slice(2, 4)) && (m.promo ? Chess.PCH[m.promo] : '') === (u[4] || ''));
      if (res.score !== undefined) { evalNow = res.score; evalMate = res.mate ? (res.mateIn || 0) * (res.score > 0 ? 1 : -1) : 0; if (res.mate && !res.mateIn) evalMate = 0; }
    }
    if (!mv) { const all = game.moves(); mv = all[Math.floor(Math.random() * all.length)]; }
    thinking = false;
    if (mv) playMove(mv.from, mv.to, mv.promo, true);
  }

  function playMove(from, to, promo, byRobot) {
    const mover = game.turn;
    const mv = game.move(from, to, promo);
    if (!mv) return false;
    viewPly = null; selected = -1; hintMove = null;
    lastMove = { from: mv.from, to: mv.to };
    animateMove(mv, mover);
    if (clock.on) { if (mover === 0) clock.w += clock.inc; else clock.b += clock.inc; clock.last = Date.now(); }
    evalHist.push(evalNow);
    const st = game.status();
    renderAll(false);
    if (st.over) { /* sound handled in finish */ }
    else if (mv.san.includes('+')) sfx.check();
    else if (mv.flag === 'k' || mv.flag === 'q') sfx.castle();
    else if (mv.cap) sfx.capture(); else sfx.move();
    if (st.over) { finish(st.result, st.reason); return true; }
    save();
    if (game.turn !== playerColor) engineMove();
    return true;
  }

  function finish(result, reason) {
    over = { result, reason }; thinking = false; hinting = false; selected = -1;
    store.del('ic_game');
    const youWin = (result === '1-0' && playerColor === 0) || (result === '0-1' && playerColor === 1);
    const draw = result === '1/2-1/2';
    const stats = store.get('ic_stats', {}); const s = stats[level.id] || [0, 0, 0];
    if (youWin) s[0]++; else if (draw) s[1]++; else s[2]++;
    stats[level.id] = s; store.set('ic_stats', stats);
    renderAll(false);
    sfx.end(youWin || draw);
    setTimeout(() => showOver(youWin, draw, reason, s), 900);
  }

  function showOver(youWin, draw, reason, s) {
    if (!over) return;
    const lvl = t('lvl' + level.id);
    $('overEmoji').textContent = t(youWin ? 'emojiWin' : draw ? 'emojiDraw' : 'emojiLose');
    $('overTitle').textContent = youWin ? t('youWin') : draw ? t('drawn') : t('youLose');
    let why = t('r_' + reason);
    if (reason === 'time') why = youWin ? t('timeoutWin') : t('timeoutLose');
    $('overText').textContent = why + ' — ' + t(youWin ? 'overWinText' : draw ? 'overDrawText' : 'overLoseText', { lvl });
    $('overStats').textContent = `${lvl} · ${t('record')}: ${s[0]} / ${s[1]} / ${s[2]}`;
    const d = $('dlgOver'); if (!d.open) d.showModal();
  }

  /* ---------- input ---------- */
  function sqFromEvent(e) {
    const r = boardEl.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return visToSq(x, y);
  }

  async function tryMove(from, to) {
    const cands = game.moves().filter((m) => m.from === from && m.to === to);
    if (!cands.length) return false;
    let promo = 0;
    if (cands[0].promo) {
      if (settings.autoQueen) promo = 5; else promo = await askPromotion();
      if (!promo) { buildPieces(game); paintSquares(); return false; }
    }
    return playMove(from, to, promo, false);
  }

  function askPromotion() {
    return new Promise((resolve) => {
      const d = $('dlgPromo'), box = $('promoChoices'); box.innerHTML = '';
      let done = false;
      for (const ty of [5, 4, 3, 2]) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'promo-btn';
        b.innerHTML = pieceSvg(ty | (playerColor << 3));
        b.addEventListener('click', () => { done = true; d.close(); resolve(ty); });
        box.appendChild(b);
      }
      d.addEventListener('close', () => { if (!done) resolve(0); }, { once: true });
      d.showModal();
    });
  }

  boardEl.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    if (!canMove()) return;
    const sq = sqFromEvent(e); if (sq < 0) return;
    hintMove = null;
    if (selected >= 0 && selected !== sq && game.moves().some((m) => m.from === selected && m.to === sq)) {
      const from = selected; selected = -1; tryMove(from, sq); return;
    }
    const p = game.board[sq];
    if (p && (p >> 3) === playerColor) {
      const was = selected === sq;
      selected = sq; paintSquares();
      const el = pieceEls.get(sq);
      if (el) {
        drag = { sq, el, was, moved: false, x0: e.clientX, y0: e.clientY, id: e.pointerId };
        try { boardEl.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      }
    } else { selected = -1; paintSquares(); }
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    drag.moved = true;
    const r = boardEl.getBoundingClientRect(), s = r.width / 8;
    drag.el.classList.add('dragging');
    drag.el.style.transform = `translate(${e.clientX - r.left - s / 2}px, ${e.clientY - r.top - s / 2}px)`;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    try { boardEl.releasePointerCapture(d.id); } catch (er) { /* ignore */ }
    d.el.classList.remove('dragging');
    const to = sqFromEvent(e);
    if (d.moved && to >= 0 && to !== d.sq) {
      setPos(d.el, d.sq);
      const from = d.sq; selected = -1; paintSquares(); tryMove(from, to);
    } else {
      setPos(d.el, d.sq);
      if (!d.moved && d.was) { selected = -1; paintSquares(); }
    }
  };
  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', endDrag);

  function gotoPly(p) {
    if (!game.log.length) return;
    p = Math.max(0, Math.min(game.log.length, p));
    viewPly = p >= game.log.length ? null : p; selected = -1;
    buildPieces(viewChess()); paintSquares(); renderPlayers(); renderMoves(); renderStatus();
  }
  document.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (document.querySelector('dialog[open]')) return;
    const cur = viewPly === null ? game.log.length : viewPly;
    const isRtl = document.documentElement.dir === 'rtl';
    if (e.key === 'ArrowLeft') { gotoPly(cur + (isRtl ? 1 : -1)); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { gotoPly(cur + (isRtl ? -1 : 1)); e.preventDefault(); }
    else if (e.key === 'Home') gotoPly(0);
    else if (e.key === 'End') gotoPly(game.log.length);
  });

  /* ---------- buttons ---------- */
  $('btnFlip').addEventListener('click', () => {
    flipped = !flipped; labelSquares();
    pieceEls.forEach((el, sq) => setPos(el, sq));
    paintSquares(); renderPlayers(); renderEval();
  });

  $('btnUndo').addEventListener('click', () => {
    if (!game.log.length) { toast(t('noUndo')); return; }
    const wasThinking = thinking;
    searchToken++; engine.cancel(); thinking = false; hinting = false;
    over = null; hintMove = null; viewPly = null;
    if (wasThinking) game.undo(); else { game.undo(); if (game.turn !== playerColor && game.log.length) game.undo(); }
    evalHist.length = game.log.length + 1; evalNow = evalHist[evalHist.length - 1] || 0; evalMate = 0;
    const lm = game.log.length ? game.log[game.log.length - 1].move : null;
    lastMove = lm ? { from: lm.from, to: lm.to } : null; selected = -1;
    clock.last = Date.now(); renderAll(true); save();
    if (game.turn !== playerColor) engineMove();
  });

  $('btnHint').addEventListener('click', async () => {
    if (!canMove()) return;
    hinting = true; hintMove = null; renderStatus();
    let res = null;
    try { if (engineReady) await engineReady; res = await engine.search(game.fen(), level, { full: true, hint: true, ms: 900 }); } catch (e) { /* ignore */ }
    hinting = false;
    if (res && res.uci && !over) {
      hintMove = { from: Chess.sqIndex(res.uci.slice(0, 2)), to: Chess.sqIndex(res.uci.slice(2, 4)) };
      toast(t('hintShown'));
    }
    paintSquares(); renderStatus();
  });

  $('btnDraw').addEventListener('click', () => {
    if (over || game.log.length < 2) return;
    const engScore = playerColor === 0 ? -evalNow : evalNow;
    if (game.log.length >= 20 && engScore <= 20 && !evalMate) { toast(t('drawAccepted')); searchToken++; engine.cancel(); thinking = false; finish('1/2-1/2', 'agreed'); }
    else toast(t('drawDeclined'));
  });

  let resignTimer;
  $('btnResign').addEventListener('click', () => {
    if (over) return;
    if (!resignArmed) {
      resignArmed = true; $('btnResign').firstElementChild.textContent = t('confirmResign');
      clearTimeout(resignTimer); resignTimer = setTimeout(() => { resignArmed = false; renderStatus(); }, 3200); return;
    }
    resignArmed = false; clearTimeout(resignTimer);
    searchToken++; engine.cancel(); thinking = false;
    finish(playerColor === 0 ? '0-1' : '1-0', 'resign');
  });

  function pgnText() {
    const res = over ? over.result : '*';
    const robot = (engineKind === 'stockfish' ? 'Stockfish' : 'Built-in bot') + ' (' + t('lvl' + level.id) + ')';
    const me = 'Player';
    return game.pgn({ White: playerColor === 0 ? me : robot, Black: playerColor === 0 ? robot : me }, res);
  }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (er) { /* ignore */ } ta.remove(); }
  }
  $('btnPgn').addEventListener('click', async () => { await copyText(pgnText()); toast(t('copied')); });
  $('btnOverPgn').addEventListener('click', () => {
    const blob = new Blob([pgnText()], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'game.pgn'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  $('btnOverClose').addEventListener('click', () => $('dlgOver').close());
  $('btnRematch').addEventListener('click', () => { $('dlgOver').close(); openNewDialog(); });

  /* ---------- new game dialog ---------- */
  function renderLevels() {
    const stats = store.get('ic_stats', {}); const box = $('levelList'); box.innerHTML = '';
    for (const l of LEVELS) {
      const s = stats[l.id] || [0, 0, 0];
      const lab = document.createElement('label'); lab.className = 'lvl' + (l.id === 7 ? ' boss' : '') + (settings.level === l.id ? ' on' : '');
      lab.innerHTML = `<input type="radio" name="lvl" value="${l.id}" ${settings.level === l.id ? 'checked' : ''}>` +
        `<span class="lvl-name">${l.id === 7 ? '🔥 ' : ''}${t('lvl' + l.id)}</span>` +
        `<span class="lvl-elo">${l.id === 7 ? '3500+' : '~' + l.elo}</span>` +
        `<small>${l.id === 7 ? t('lvl7d') : t('lvlD' + l.id)}</small>` +
        `<small class="rec">${s[0]}/${s[1]}/${s[2]}</small>`;
      lab.addEventListener('click', () => { settings.level = l.id; saveSettings(); renderLevels(); });
      box.appendChild(lab);
    }
  }
  function openNewDialog() {
    renderLevels();
    document.querySelectorAll('#segColor button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings.color));
    $('selTime').value = settings.time;
    const d = $('dlgNew'); if (!d.open) d.showModal();
  }
  document.querySelectorAll('#segColor button').forEach((b) => b.addEventListener('click', () => {
    settings.color = b.dataset.v; saveSettings();
    document.querySelectorAll('#segColor button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('selTime').addEventListener('change', () => { settings.time = $('selTime').value; saveSettings(); });
  $('btnNew').addEventListener('click', openNewDialog);
  $('btnNewCancel').addEventListener('click', () => { $('dlgNew').close(); if (!started) begin(); });
  $('frmNew').addEventListener('submit', (e) => {
    e.preventDefault(); $('dlgNew').close(); started = true; $('dlgOver').open && $('dlgOver').close();
    startNewGame({ level: settings.level, color: settings.color, time: settings.time });
  });

  /* ---------- settings ---------- */
  function applyTheme() { boardEl.dataset.theme = settings.theme; $('selTheme').value = settings.theme; }
  $('selTheme').addEventListener('change', () => { settings.theme = $('selTheme').value; saveSettings(); applyTheme(); });
  $('chkLegal').addEventListener('change', () => { settings.legal = $('chkLegal').checked; saveSettings(); paintSquares(); });
  $('chkAutoQueen').addEventListener('change', () => { settings.autoQueen = $('chkAutoQueen').checked; saveSettings(); });
  $('rngThink').addEventListener('input', () => { settings.think = +$('rngThink').value; $('thinkTimeVal').textContent = settings.think; saveSettings(); });
  function soundIcon() {
    $('btnSound').innerHTML = settings.sound
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/></svg>';
  }
  $('btnSound').addEventListener('click', () => { settings.sound = !settings.sound; saveSettings(); soundIcon(); if (settings.sound) sfx.move(); });
  $('btnLang').addEventListener('click', () => I18N.setLang(I18N.lang === 'fa' ? 'en' : 'fa'));

  function updateBadge() {
    const b = $('engineBadge');
    b.dataset.state = engineKind || 'loading';
    $('engineBadgeText').textContent = engineKind === 'stockfish' ? t('badgeSF') : engineKind === 'builtin' ? t('badgeAI') : t('badgeLoad');
    b.title = engineKind === 'builtin' ? t('badgeAItip') + (engine.error ? '\n\n' + engine.error : '') : '';
    const eb = document.getElementById('engineErr');
    if (eb) { eb.hidden = !(engineKind === 'builtin' && engine.error); eb.textContent = engine.error || ''; }
  }
  document.addEventListener('langchange', () => { updateBadge(); if (sqEls.length) { renderAll(false); if ($('dlgNew').open) renderLevels(); } });

  /* ---------- clock tick ---------- */
  setInterval(() => {
    const now = Date.now();
    if (!clock.on || over || !started) { clock.last = now; return; }
    const dt = now - clock.last; clock.last = now;
    if (game.log.length === 0) { return; } // clock starts after the first move
    if (game.turn === 0) clock.w -= dt; else clock.b -= dt;
    renderClocks();
    const loser = clock.w <= 0 ? 0 : clock.b <= 0 ? 1 : -1;
    if (loser >= 0) { searchToken++; engine.cancel(); thinking = false; finish(loser === 0 ? '0-1' : '1-0', 'time'); }
  }, 100);

  /* ---------- boot ---------- */
  let started = false;
  function begin() {
    started = true;
    startNewGame({ level: settings.level, color: settings.color, time: settings.time });
  }

  buildBoard(); applyTheme(); soundIcon();
  $('chkLegal').checked = settings.legal; $('chkAutoQueen').checked = settings.autoQueen;
  $('rngThink').value = settings.think; $('thinkTimeVal').textContent = settings.think;
  I18N.apply();
  updateBadge();

  engineReady = engine.init().then((k) => { engineKind = k; updateBadge(); renderPlayers(); }).catch((e) => { console.error(e); engineKind = 'builtin'; updateBadge(); });

  if (restore()) { started = true; } else {
    // show an empty board behind the dialog, then ask for options
    buildPieces(game); renderAll(true); openNewDialog();
  }
  // expose for debugging/tests
  window.__chess = { get game() { return game; }, playMove, load(fen) { searchToken++; engine.cancel(); thinking = false; hinting = false; game.load(fen); over = null; lastMove = null; evalHist = [0]; selected = -1; renderAll(true); }, get engineKind() { return engineKind; }, startNewGame };
})();
