import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const COLS = 7;
const ROWS = 6;
const YOU = 1;
const CPU = 2;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Jij</span><span class="hud-value" data-wins>0</span></div>
        <div class="hud-item"><span class="hud-label">Computer</span><span class="hud-value" data-losses>0</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Reeks</span><span class="hud-value accent" data-streak>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste reeks</span><span class="hud-value" data-best>0</span></div>
      </div>
    </div>`;

  const winsNode = root.querySelector("[data-wins]");
  const lossesNode = root.querySelector("[data-losses]");
  const streakNode = root.querySelector("[data-streak]");
  const bestNode = root.querySelector("[data-best]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    board: [],
    turn: YOU,
    wins: 0,
    losses: 0,
    streak: 0,
    best: getBest("quad") ?? 0,
    hover: 3,
    anim: null,
    thinking: 0,
    result: null,
    time: 0,
    lastWin: [], 
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    winsNode.textContent = String(game.wins);
    lossesNode.textContent = String(game.losses);
    streakNode.textContent = String(game.streak);
    bestNode.textContent = formatNumber(game.best);
  }

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function dropRow(col, board = game.board) {
    for (let r = ROWS - 1; r >= 0; r--) if (!board[r][col]) return r;
    return -1;
  }

  function place(board, col, who) {
    const row = dropRow(col, board);
    if (row < 0) return null;
    board[row][col] = who;
    return row;
  }

  function winningCells(board, who) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== who) continue;
        for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const cells = [];
          for (let k = 0; k < 4; k++) {
            const cc = c + dc * k;
            const rr = r + dr * k;
            if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) break;
            if (board[rr][cc] !== who) break;
            cells.push([rr, cc]);
          }
          if (cells.length === 4) return cells;
        }
      }
    }
    return null;
  }

  function full(board) {
    return board[0].every(Boolean);
  }

  function scoreWindow(window, who) {
    const mine = window.filter((v) => v === who).length;
    const empty = window.filter((v) => v === 0).length;
    const enemy = window.length - mine - empty;
    if (mine && enemy) return 0;
    if (mine === 3 && empty === 1) return 8;
    if (mine === 2 && empty === 2) return 3;
    if (mine === 1 && empty === 3) return 1;
    return 0;
  }

  function aiScore(board, col, who) {
    const copy = board.map((row) => row.slice());
    const row = place(copy, col, who);
    if (row === null) return -Infinity;
    if (winningCells(copy, who)) return 100000;

    let score = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        score += scoreWindow([copy[r][c], copy[r][c + 1], copy[r][c + 2], copy[r][c + 3]], who);
      }
    }
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 4; r++) {
        score += scoreWindow([copy[r][c], copy[r + 1][c], copy[r + 2][c], copy[r + 3][c]], who);
      }
    }
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        score += scoreWindow([copy[r][c], copy[r + 1][c + 1], copy[r + 2][c + 2], copy[r + 3][c + 3]], who);
        score += scoreWindow([copy[r + 3][c], copy[r + 2][c + 1], copy[r + 1][c + 2], copy[r][c + 3]], who);
      }
    }
    score += 4 - Math.abs(3 - col);
    return score;
  }

  function cpuMove() {
    const options = [];
    for (let c = 0; c < COLS; c++) if (dropRow(c) >= 0) options.push(c);
    if (!options.length) return null;

    // win now
    for (const c of options) {
      const copy = game.board.map((row) => row.slice());
      place(copy, c, CPU);
      if (winningCells(copy, CPU)) return c;
    }
    // block
    for (const c of options) {
      const copy = game.board.map((row) => row.slice());
      place(copy, c, YOU);
      if (winningCells(copy, YOU)) return c;
    }
    // best of one-ply lookahead
    let best = -Infinity;
    let bestCols = [];
    for (const c of options) {
      const value = aiScore(game.board, c, CPU);
      if (value > best) {
        best = value;
        bestCols = [c];
      } else if (value === best) {
        bestCols.push(c);
      }
    }
    return bestCols[Math.floor(Math.random() * bestCols.length)];
  }

  function endRound(result, cells) {
    game.result = result;
    game.lastWin = cells || [];
    game.turn = 0;

    if (result === "you") {
      game.wins += 1;
      game.streak += 1;
      if (game.streak > game.best) {
        game.best = game.streak;
        setBest("quad", game.best);
      }
      audio.win();
    } else if (result === "cpu") {
      game.losses += 1;
      game.streak = 0;
      audio.miss();
    } else {
      game.streak = 0;
      audio.blip();
    }
    paintHud();

    const title = result === "you" ? "Vier op een rij!" : result === "cpu" ? "De computer wint" : "Vol bord";
    const kicker = result === "you" ? "GEWONNEN" : result === "cpu" ? "VERLOREN" : "GELIJKSPEL";
    const text =
      result === "you"
        ? `Knap gedaan. Je reeks staat op <strong>${game.streak}</strong>.`
        : result === "cpu"
        ? "Probeer de computer voor te blijven. Welke kleur je ook neemt, je moet altijd een rij blokkeren."
        : "Alle vakjes zijn vol zonder winnaar.";

    game.mode = "over";
    modal = overlay(root, {
      kicker,
      title,
      text,
      extra: `<div class="ov-stat">
        <div><span>Jij</span><span>${game.wins}</span></div>
        <div><span>Computer</span><span>${game.losses}</span></div>
        <div><span>Beste reeks</span><span>${formatNumber(game.best)}</span></div>
      </div>`,
      button: "NOG EEN KEER",
      onStart: () => {
        newRound();
        game.mode = "playing";
      },
    });
  }

  function checkState() {
    const youWin = winningCells(game.board, YOU);
    if (youWin) {
      endRound("you", youWin);
      return true;
    }
    const cpuWin = winningCells(game.board, CPU);
    if (cpuWin) {
      endRound("cpu", cpuWin);
      return true;
    }
    if (full(game.board)) {
      endRound("draw", []);
      return true;
    }
    return false;
  }

  function newRound() {
    game.board = emptyBoard();
    game.turn = YOU;
    game.result = null;
    game.lastWin = [];
    game.anim = null;
    game.thinking = 0;
    game.mode = "ready";
    paintHud();
  }

  function play(col) {
    if (game.mode !== "playing" || game.turn !== YOU || game.anim) return;
    const row = dropRow(col);
    if (row < 0) return;

    game.board[row][col] = YOU;
    game.anim = { col, row, who: YOU, t: 0 };
    game.turn = CPU;
    game.thinking = 0.55;
    audio.step();

    if (!checkState()) {
      // cpu responds after the drop animation
    }
  }

  function cpuTurn() {
    if (game.mode !== "playing" || game.turn !== CPU) return;
    const col = cpuMove();
    if (col === null) {
      checkState();
      return;
    }
    const row = dropRow(col);
    game.board[row][col] = CPU;
    game.anim = { col, row, who: CPU, t: 0 };
    game.turn = YOU;
    audio.step();
    checkState();
  }

  function update(dt) {
    game.time += dt;

    if (game.anim) {
      game.anim.t += dt * 4.2;
      if (game.anim.t >= 1) game.anim = null;
    }

    if (game.mode !== "playing") return;

    if (game.thinking > 0) {
      game.thinking = Math.max(0, game.thinking - dt);
      if (game.thinking === 0) cpuTurn();
    }
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    const cell = Math.min(w / (COLS + 1.4), (h * 0.92) / (ROWS + 1));
    const boardW = cell * COLS;
    const boardH = cell * ROWS;
    const ox = (w - boardW) / 2;
    const oy = (h - boardH) / 2;
    const radius = cell * 0.38;

    // column hover highlight
    if (game.mode === "playing" && game.turn === YOU) {
      ctx.fillStyle = "rgba(255,225,77,0.06)";
      ctx.fillRect(ox + game.hover * cell, oy - cell * 0.4, cell, boardH + cell * 0.4);
    }

    // board
    ctx.fillStyle = "rgba(61,252,255,0.05)";
    ctx.strokeStyle = "rgba(61,252,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox - cell * 0.18, oy - cell * 0.18, boardW + cell * 0.36, boardH + cell * 0.36, cell * 0.3);
    ctx.fill();
    ctx.stroke();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = ox + (c + 0.5) * cell;
        const cy = oy + (r + 0.5) * cell;
        const value = game.board[r][c];

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6,8,14,0.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(244,239,230,0.08)";
        ctx.stroke();

        if (!value) continue;
        // skip the disc that is currently animating
        if (game.anim && game.anim.col === c && game.anim.row === r) continue;
        paintDisc(cx, cy, radius, value === YOU);
      }
    }

    // animated disc
    if (game.anim) {
      const { col, row, who, t } = game.anim;
      const cx = ox + (col + 0.5) * cell;
      const startY = oy - cell * 0.5;
      const targetY = oy + (row + 0.5) * cell;
      const cy = startY + (targetY - startY) * Math.min(1, t);
      paintDisc(cx, cy, radius, who === YOU);
    }

    // winning line
    if (game.lastWin.length) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 18;
      const first = game.lastWin[0];
      const last = game.lastWin[game.lastWin.length - 1];
      ctx.beginPath();
      ctx.moveTo(ox + (first[1] + 0.5) * cell, oy + (first[0] + 0.5) * cell);
      ctx.lineTo(ox + (last[1] + 0.5) * cell, oy + (last[0] + 0.5) * cell);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // turn hint
    if (game.mode === "playing") {
      ctx.font = `600 ${Math.max(9, cell * 0.24)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = game.turn === YOU ? "rgba(255,225,77,0.9)" : "rgba(255,111,145,0.9)";
      ctx.fillText(game.turn === YOU ? "JIJ BENT AAN ZET" : "COMPUTER DENKT…", w / 2, oy - cell * 0.55);
    }
  }

  function paintDisc(cx, cy, r, isYou) {
    const color = isYou ? "#ffe14d" : "#ff6f91";
    const glow = isYou ? "rgba(255,225,77,0.8)" : "rgba(255,111,145,0.8)";
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
    grad.addColorStop(0, isYou ? "#fff6c2" : "#ffc9d8");
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, isYou ? "#c79a00" : "#a4234a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- input ---------- */
  function columnAt(x) {
    const w = state.width;
    const h = state.height;
    const cell = Math.min(w / (COLS + 1.4), (h * 0.92) / (ROWS + 1));
    const ox = (w - cell * COLS) / 2;
    return Math.floor((x - ox) / cell);
  }

  function begin() {
    if (game.mode === "playing") return;
    if (game.mode === "over") {
      modal?.close();
      modal = null;
      newRound();
    }
    game.mode = "playing";
    audio.blip();
  }

  const KEYS = ["arrowleft", "arrowright", " ", "enter", "1", "2", "3", "4", "5", "6", "7"];
  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (KEYS.includes(k)) event.preventDefault();

    if (game.mode !== "playing") {
      if (k === " " || k === "enter") begin();
      return;
    }

    if (k === "arrowleft") game.hover = Math.max(0, game.hover - 1);
    if (k === "arrowright") game.hover = Math.min(COLS - 1, game.hover + 1);
    if (/^[1-7]$/.test(k)) {
      game.hover = Number(k) - 1;
      play(game.hover);
    }
    if (k === " " || k === "enter") play(game.hover);
  };
  window.addEventListener("keydown", onKeyDown);

  const onPointerMove = (event) => {
    if (game.mode !== "playing" || game.turn !== YOU) return;
    const rect = root.getBoundingClientRect();
    const col = columnAt(event.clientX - rect.left);
    if (col >= 0 && col < COLS) game.hover = col;
  };

  const onPointerDown = (event) => {
    if (game.mode !== "playing") return;
    const rect = root.getBoundingClientRect();
    const col = columnAt(event.clientX - rect.left);
    if (col < 0 || col >= COLS) return;
    game.hover = col;
    play(col);
  };

  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerdown", onPointerDown);

  newRound();

  let modal = overlay(root, {
    kicker: "ORBIT FOUR",
    title: "Vier op een rij, tegen de computer",
    text: "Klik op een kolom of gebruik de pijltjes en spatie. Wie het eerst vier schijven op een rij heeft, wint.",
    extra: `<div class="ov-keys">
      <span class="kbd">← →</span><span class="kbd">SPATIE</span><span class="kbd">1 – 7</span>
    </div>`,
    button: "BEGIN",
    onStart: begin,
  });

  const stopLoop = loop((dt) => {
    update(dt);
    draw();
  });

  return {
    restart: () => {
      modal?.close();
      modal = null;
      newRound();
      game.mode = "playing";
    },
    destroy: () => {
      stopLoop();
      destroyCanvas();
      window.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
