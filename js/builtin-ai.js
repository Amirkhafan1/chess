/* builtin-ai.js — fallback chess engine (alpha-beta) running in a Web Worker.
 * Used automatically when Stockfish files are not found in /engine.
 * Message in : {id, fen, depth, time, noise}
 * Message out: {id, uci, score (cp, white POV), depth}
 */
importScripts('chess-core.js');

const VAL = [0, 100, 320, 330, 500, 900, 0];
const PST = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
const KING_END = [-50,-30,-30,-30,-30,-30,-30,-50, -30,-30,0,0,0,0,-30,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-20,-10,0,0,-10,-20,-30, -50,-40,-30,-20,-20,-30,-40,-50];

const MATE = 100000;
let nodes = 0, deadline = 0, stopped = false;

function evaluate(c) {
  const b = c.board;
  let score = 0, material = 0;
  for (let i = 0; i < 64; i++) if (b[i]) { const t = b[i] & 7; if (t !== 1 && t !== 6) material += VAL[t]; }
  const endgame = material <= 2600;
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p) continue;
    const t = p & 7, black = p >> 3, r = i >> 3, f = i & 7;
    const idx = black ? r * 8 + f : (7 - r) * 8 + f;
    const table = (t === 6 && endgame) ? KING_END : PST[t];
    const v = VAL[t] + table[idx];
    score += black ? -v : v;
  }
  return c.turn === 0 ? score : -score; // from side-to-move POV
}

function order(c, moves, ttMove) {
  for (const m of moves) {
    let s = 0;
    if (ttMove && m.from === ttMove.from && m.to === ttMove.to && m.promo === ttMove.promo) s = 1e6;
    else if (m.cap) s = 10000 + VAL[m.cap & 7] * 10 - VAL[m.piece & 7];
    if (m.promo) s += 9000 + VAL[m.promo];
    m.s = s;
  }
  moves.sort((a, b) => b.s - a.s);
}

function qsearch(c, alpha, beta, ply) {
  nodes++;
  if ((nodes & 2047) === 0 && Date.now() > deadline) stopped = true;
  if (stopped) return 0;
  const stand = evaluate(c);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (ply > 12) return alpha;
  const moves = c.pseudo(true);
  order(c, moves);
  const us = c.turn;
  for (const m of moves) {
    c.make(m);
    if (c.isAttacked(c.kings[us], us ^ 1)) { c.unmake(); continue; }
    const sc = -qsearch(c, -beta, -alpha, ply + 1);
    c.unmake();
    if (stopped) return 0;
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function search(c, depth, alpha, beta, ply) {
  nodes++;
  if ((nodes & 2047) === 0 && Date.now() > deadline) stopped = true;
  if (stopped) return 0;
  const us = c.turn;
  const inChk = c.isAttacked(c.kings[us], us ^ 1);
  if (inChk) depth++;
  if (depth <= 0) return qsearch(c, alpha, beta, ply);
  if (c.half >= 100) return 0;
  const moves = c.pseudo();
  order(c, moves);
  let legal = 0, best = -Infinity;
  for (const m of moves) {
    c.make(m);
    if (c.isAttacked(c.kings[us], us ^ 1)) { c.unmake(); continue; }
    legal++;
    const sc = -search(c, depth - 1, -beta, -alpha, ply + 1);
    c.unmake();
    if (stopped) return 0;
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  if (!legal) return inChk ? -MATE + ply : 0;
  return best;
}

function think(fen, maxDepth, timeMs, noise) {
  const c = new Chess(fen);
  const us = c.turn;
  nodes = 0; stopped = false; deadline = Date.now() + timeMs;
  const root = c.moves();
  if (!root.length) return null;
  if (root.length === 1) { const m = root[0]; return { m, score: 0, depth: 0 }; }
  let best = { m: root[0], score: 0, depth: 0 };
  let ordered = root.slice();
  for (let d = 1; d <= maxDepth; d++) {
    let bestScore = -Infinity, bestMove = null, alpha = -Infinity;
    const scored = [];
    order(c, ordered);
    for (const m of ordered) {
      c.make(m);
      let sc = -search(c, d - 1, -Infinity, noise ? Infinity : -alpha, 1);
      c.unmake();
      if (stopped) break;
      if (noise) sc += (Math.random() - 0.5) * 2 * noise;
      scored.push([m, sc]);
      if (sc > bestScore) { bestScore = sc; bestMove = m; if (!noise) alpha = sc; }
    }
    if (stopped) break;
    best = { m: bestMove, score: bestScore, depth: d };
    // put best move first for the next iteration
    ordered = [bestMove].concat(ordered.filter((x) => x !== bestMove));
    if (Math.abs(bestScore) > MATE - 200) break;
  }
  // convert to white POV
  best.score = us === 0 ? best.score : -best.score;
  return best;
}

self.onmessage = (e) => {
  const { id, fen, depth, time, noise } = e.data;
  const r = think(fen, depth || 3, time || 1000, noise || 0);
  if (!r) { self.postMessage({ id, uci: null }); return; }
  const m = r.m;
  self.postMessage({
    id,
    uci: Chess.sqName(m.from) + Chess.sqName(m.to) + (m.promo ? Chess.PCH[m.promo] : ''),
    score: Math.max(-3000, Math.min(3000, r.score)),
    depth: r.depth,
    mate: Math.abs(r.score) > MATE - 200,
  });
};
