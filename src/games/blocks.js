import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const COLS = 10;
const ROWS = 20;

const PIECES = {
  I: { color: "#6fe6ff", shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  J: { color: "#6f8bff", shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: "#ffb066", shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  O: { color: "#ffe14d", shape: [[1, 1], [1, 1]] },
  S: { color: "#8ef5b0", shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  T: { color: "#c9a7ff", shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  Z: { color: "#ff6f91", shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
};
const TYPES = Object.keys(PIECES);

const rotate = (m) => m[0].map((_, c) => m.map((row) => row[c]).reverse());

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
        <div class="hud-item"><span class="hud-label">Lijnen</span><span class="hud-value" data-lines>0</span></div>
        <div class="hud-item"><span class="hud-label">Level</span><span class="hud-value accent" data-level>1</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const linesNode = root.querySelector("[data-lines]");
  const levelNode = root.querySelector("[data-level]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    board: [],
    piece: null,
    next: null,
    score: 0,
    best: getBest("blocks") ?? 0,
    lines: 0,
    level: 1,
    drop: 0,
    flash: 0,
  };

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    linesNode.textContent = String(game.lines);
    levelNode.textContent = String(game.level);
  }

  function makePiece(type) {
    const def = PIECES[type];
    const m = def.shape.map((row) => row.slice());
    return {
      type,
      m,
      color: def.color,
      x: Math.floor((COLS - m[0].length) / 2),
      y: 0,
    };
  }

  function collides(piece, dx = 0, dy = 0, matrix = piece.m) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = piece.x + c + dx;
        const y = piece.y + r + dy;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && game.board[y][x]) return true;
      }
    }
    return false;
  }

  function spawn() {
    game.piece = game.next || makePiece(TYPES[Math.floor(Math.random() * TYPES.length)]);
    game.next = makePiece(TYPES[Math.floor(Math.random() * TYPES.length)]);
    game.drop = 0;
    if (collides(game.piece)) endGame();
  }

  function lock() {
    const piece = game.piece;
    for (let r = 0; r < piece.m.length; r++) {
      for (let c = 0; c < piece.m[r].length; c++) {
        if (!piece.m[r][c]) continue;
        const x = piece.x + c;
        const y = piece.y + r;
        if (y >= 0) game.board[y][x] = piece.color;
      }
    }

    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (game.board[r].every(Boolean)) full.push(r);
    }

    if (full.length) {
      for (const r of full.slice().reverse()) game.board.splice(r, 1);
      for (let i = 0; i < full.length; i++) game.board.unshift(Array(COLS).fill(null));
      const points = [0, 100, 300, 500, 800][full.length] * game.level;
      game.score += points;
      game.lines += full.length;
      game.level = 1 + Math.floor(game.lines / 10);
      game.flash = 1;
      audio.score();
      paintHud();
    } else {
      audio.step();
    }

    spawn();
  }

  function move(dx) {
    if (game.mode !== "playing") return;
    if (!collides(game.piece, dx, 0)) game.piece.x += dx;
  }

  function turn() {
    if (game.mode !== "playing") return;
    const rotated = rotate(game.piece.m);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(game.piece, kick, 0, rotated)) {
        game.piece.m = rotated;
        game.piece.x += kick;
        audio.step();
        return;
      }
    }
  }

  function softDrop() {
    if (game.mode !== "playing") return;
    if (!collides(game.piece, 0, 1)) {
      game.piece.y += 1;
      game.score += 1;
      paintHud();
      game.drop = 0;
    } else {
      lock();
    }
  }

  function hardDrop() {
    if (game.mode !== "playing") return;
    let dropped = 0;
    while (!collides(game.piece, 0, 1)) {
      game.piece.y += 1;
      dropped += 1;
    }
    game.score += dropped * 2;
    audio.hit();
    lock();
    paintHud();
  }

  function reset() {
    game.board = emptyBoard();
    game.piece = null;
    game.next = null;
    game.score = 0;
    game.lines = 0;
    game.level = 1;
    game.drop = 0;
    game.flash = 0;
    spawn();
    paintHud();
  }

  function endGame() {
    game.mode = "over";
    audio.miss();
    if (game.score > game.best) {
      game.best = game.score;
      setBest("blocks", game.best);
    }
    paintHud();
    modal = overlay(root, {
      kicker: "DE TOREN IS VOL",
      title: "Geen ruimte meer",
      text: `Je stapelde <strong>${game.score}</strong> punten en ruimde <strong>${game.lines}</strong> lijnen op.`,
      extra: `<div class="ov-stat">
        <div><span>Score</span><span>${formatNumber(game.score)}</span></div>
        <div><span>Beste</span><span>${formatNumber(game.best)}</span></div>
      </div>`,
      button: "OPNIEUW",
      onStart: () => {
        reset();
        game.mode = "playing";
      },
    });
  }

  function update(dt) {
    game.flash = Math.max(0, game.flash - dt * 2.2);
    if (game.mode !== "playing") return;

    const interval = Math.max(0.06, 0.78 - (game.level - 1) * 0.065);
    game.drop += dt;
    while (game.drop >= interval) {
      game.drop -= interval;
      if (!collides(game.piece, 0, 1)) game.piece.y += 1;
      else lock();
      if (game.mode !== "playing") return;
    }
  }

  function cellRect(ox, oy, cell, x, y) {
    return { x: ox + x * cell, y: oy + y * cell, w: cell, h: cell };
  }

  function block(x, y, cell, color, alpha = 1) {
    const inset = Math.max(1.2, cell * 0.07);
    const r = Math.max(2, cell * 0.2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.5;
    const bx = x + inset;
    const by = y + inset;
    const bw = cell - inset * 2;
    const bh = cell - inset * 2;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    const cell = Math.min((w * 0.92) / (COLS + 3.4), (h * 0.9) / ROWS);
    const boardW = COLS * cell;
    const boardH = ROWS * cell;
    const ox = (w - boardW) / 2 - cell * 1.2;
    const oy = (h - boardH) / 2;

    // well
    ctx.fillStyle = "rgba(111,230,255,0.05)";
    ctx.strokeStyle = "rgba(111,230,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox - 2, oy - 2, boardW + 4, boardH + 4, Math.min(18, cell * 0.7));
    ctx.fill();
    ctx.stroke();

    // grid
    ctx.strokeStyle = "rgba(244,239,230,0.05)";
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cell, oy);
      ctx.lineTo(ox + c * cell, oy + boardH);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cell);
      ctx.lineTo(ox + boardW, oy + r * cell);
      ctx.stroke();
    }

    // settled blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = game.board[r][c];
        if (!color) continue;
        const rect = cellRect(ox, oy, cell, c, r);
        block(rect.x, rect.y, cell, color, 0.92);
      }
    }

    // ghost
    if (game.piece && game.mode !== "over") {
      const piece = game.piece;
      let ghostY = 0;
      while (!collides(piece, 0, ghostY + 1)) ghostY += 1;
      for (let r = 0; r < piece.m.length; r++) {
        for (let c = 0; c < piece.m[r].length; c++) {
          if (!piece.m[r][c]) continue;
          const y = piece.y + r + ghostY;
          if (y < 0) continue;
          const rect = cellRect(ox, oy, cell, piece.x + c, y);
          block(rect.x, rect.y, cell, piece.color, 0.16);
        }
      }

      for (let r = 0; r < piece.m.length; r++) {
        for (let c = 0; c < piece.m[r].length; c++) {
          if (!piece.m[r][c]) continue;
          const y = piece.y + r;
          if (y < 0) continue;
          const rect = cellRect(ox, oy, cell, piece.x + c, y);
          block(rect.x, rect.y, cell, piece.color, 1);
        }
      }
    }

    // next piece
    if (game.next) {
      const px = ox + boardW + cell * 0.75;
      const py = oy + cell * 0.6;
      const labelSize = Math.max(8, cell * 0.34);
      ctx.fillStyle = "rgba(244,239,230,0.4)";
      ctx.font = `${labelSize}px Inter, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("VOLGENDE", px, py - cell * 0.15);

      const m = game.next.m;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          block(px + c * cell, py + r * cell, cell, game.next.color, 0.9);
        }
      }

      // level meter
      const meterX = px;
      const meterY = py + cell * 5.2;
      const meterH = Math.min(cell * 4, (oy + boardH - meterY) * 0.9);
      if (meterH > cell) {
        ctx.fillStyle = "rgba(244,239,230,0.08)";
        ctx.fillRect(meterX, meterY, cell * 0.5, meterH);
        const fill = (game.lines % 10) / 10;
        ctx.fillStyle = "rgba(255,61,154,0.85)";
        ctx.fillRect(meterX, meterY + meterH * (1 - fill), cell * 0.5, meterH * fill);
      }
    }

    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.12;
      ctx.fillStyle = "#6fe6ff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  function begin() {
    if (game.mode === "playing") return;
    if (game.mode === "over") {
      modal?.close();
      modal = null;
      reset();
    }
    game.mode = "playing";
    audio.blip();
  }

  const KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "x"];

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (KEYS.includes(k)) event.preventDefault();

    if (game.mode === "ready" || game.mode === "over") {
      if (k === " " || k === "enter") begin();
      return;
    }
    if (k === "arrowleft" || k === "a") move(-1);
    if (k === "arrowright" || k === "d") move(1);
    if (k === "arrowup" || k === "w" || k === "x") turn();
    if (k === "arrowdown" || k === "s") softDrop();
    if (k === " ") hardDrop();
  };
  window.addEventListener("keydown", onKeyDown);

  let start = null;

  const onPointerDown = (event) => {
    if (game.mode !== "playing") return;
    start = { x: event.clientX, y: event.clientY, t: performance.now() };
  };

  const onPointerUp = (event) => {
    if (!start || game.mode !== "playing") return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = performance.now() - start.t;
    start = null;

    if (Math.hypot(dx, dy) < 18) {
      if (elapsed > 380) hardDrop();
      else turn();
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1);
      move(dx > 0 ? 1 : -1);
    } else if (dy > 0) {
      softDrop();
    } else {
      turn();
    }
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", onPointerUp);

  reset();
  game.mode = "ready";

  let modal = overlay(root, {
    kicker: "NEON BLOCKS",
    title: "Stapel, draai, ruim op",
    text: "Laat de blokken zakken en maak volle lijnen. Hoe meer lijnen, hoe sneller het gaat.",
    extra: `<div class="ov-keys">
      <span class="kbd">← →</span><span class="kbd">↑ = DRAAIEN</span><span class="kbd">↓ = ZAKKEN</span><span class="kbd">SPATIE = VALLEN</span>
    </div>`,
    button: "BEGIN",
    onStart: () => {
      begin();
    },
  });

  const stopLoop = loop((dt) => {
    update(dt);
    draw();
  });

  return {
    restart: () => {
      modal?.close();
      modal = null;
      reset();
      game.mode = "playing";
    },
    destroy: () => {
      stopLoop();
      destroyCanvas();
      window.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
    },
  };
}
