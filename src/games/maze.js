import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const MAP = [
  "###############",
  "#......#......#",
  "#.##.#.#.#.##.#",
  "#o##.#.#.#.##o#",
  "#.............#",
  "#.##.##.##.##.#",
  "#....#...#....#",
  "####.#.#.#.####",
  "#....#...#....#",
  "#.##.##.##.##.#",
  "#.............#",
  "#o##.#.#.#.##o#",
  "#.##.#.#.#.##.#",
  "#......#......#",
  "###############",
];

const ROWS = MAP.length;
const COLS = MAP[0].length;
const START = { col: 7, row: 10 };
const CORNERS = [
  { col: 1, row: 1 },
  { col: 13, row: 1 },
  { col: 1, row: 13 },
  { col: 13, row: 13 },
];
const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Levens</span><span class="hud-value accent" data-lives>3</span></div>
        <div class="hud-item"><span class="hud-label">Level</span><span class="hud-value" data-level>1</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const livesNode = root.querySelector("[data-lives]");
  const levelNode = root.querySelector("[data-level]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    grid: [],
    pellets: 0,
    score: 0,
    best: getBest("maze") ?? 0,
    lives: 3,
    level: 1,
    time: 0,
    fright: 0,
    freeze: 0,
    player: null,
    ghosts: [],
    playerStep: 0.12,
    ghostStep: 0.15,
    palette: ["#ff6f91", "#6fe6ff", "#ffb066", "#c9a7ff"],
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    livesNode.textContent = String(game.lives);
    levelNode.textContent = String(game.level);
  }

  function isWall(col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
    return MAP[row][col] === "#";
  }

  function makeEntity(col, row) {
    return { col, row, fromCol: col, fromRow: row, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, t: 0 };
  }

  function buildLevel() {
    game.grid = MAP.map((row) => row.split(""));
    game.pellets = game.grid.flat().filter((c) => c === "." || c === "o").length;
    game.player = makeEntity(START.col, START.row);
    game.ghosts = CORNERS.map((c, i) => {
      const ghost = makeEntity(c.col, c.row);
      ghost.home = c;
      ghost.color = game.palette[i];
      ghost.dir = DIRS[i % 2 === 0 ? 0 : 1];
      return ghost;
    });
    game.fright = 0;
    game.freeze = 1;
    paintHud();
  }

  function reset() {
    game.score = 0;
    game.lives = 3;
    game.level = 1;
    game.fright = 0;
    buildLevel();
  }

  function pos(entity) {
    const t = Math.min(1, entity.t);
    return {
      x: entity.fromCol + (entity.col - entity.fromCol) * t,
      y: entity.fromRow + (entity.row - entity.fromRow) * t,
    };
  }

  function distToPlayer(col, row) {
    return Math.hypot(col - game.player.col, row - game.player.row);
  }

  function choosePlayer(p) {
    if (p.nextDir && !isWall(p.col + p.nextDir.x, p.row + p.nextDir.y)) {
      p.dir = p.nextDir;
    }
    if (p.dir.x || p.dir.y) {
      if (isWall(p.col + p.dir.x, p.row + p.dir.y)) p.dir = { x: 0, y: 0 };
    }
  }

  function chooseGhost(g) {
    const reverse = { x: -g.dir.x, y: -g.dir.y };
    const options = DIRS.filter((d) => !isWall(g.col + d.x, g.row + d.y));
    const forward = options.filter((d) => !(d.x === reverse.x && d.y === reverse.y));
    const pool = forward.length ? forward : options;
    if (!pool.length) {
      g.dir = reverse;
      return;
    }

    if (game.fright > 0) {
      g.dir = pool[Math.floor(Math.random() * pool.length)];
      return;
    }

    if (Math.random() < 0.22) {
      g.dir = pool[Math.floor(Math.random() * pool.length)];
      return;
    }

    let bestDir = pool[0];
    let bestDist = Infinity;
    for (const d of pool) {
      const dist = distToPlayer(g.col + d.x, g.row + d.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = d;
      }
    }
    g.dir = bestDir;
  }

  function eatAt(col, row) {
    const cell = game.grid[row]?.[col];
    if (cell !== "." && cell !== "o") return;
    game.grid[row][col] = " ";
    game.pellets -= 1;
    if (cell === ".") {
      game.score += 10;
      audio.step();
    } else {
      game.score += 50;
      game.fright = 6.5;
      audio.score();
    }
    if (game.score > game.best) game.best = game.score;
    paintHud();

    if (game.pellets === 0) {
      game.level += 1;
      game.score += 200;
      game.playerStep = Math.max(0.085, 0.12 - (game.level - 1) * 0.006);
      game.ghostStep = Math.max(0.1, 0.15 - (game.level - 1) * 0.008);
      audio.win();
      buildLevel();
    }
  }

  function advance(entity, stepTime, dt, choose) {
    entity.t += dt / stepTime;
    let guard = 0;
    while (entity.t >= 1 && guard++ < 5) {
      entity.t -= 1;
      entity.fromCol = entity.col;
      entity.fromRow = entity.row;
      choose(entity);
      const nx = entity.fromCol + entity.dir.x;
      const ny = entity.fromRow + entity.dir.y;
      if (!isWall(nx, ny) && (entity.dir.x || entity.dir.y)) {
        entity.col = nx;
        entity.row = ny;
      } else {
        entity.col = entity.fromCol;
        entity.row = entity.fromRow;
        entity.t = Math.min(entity.t, 0.999);
      }
      if (entity === game.player) eatAt(entity.col, entity.row);
    }
    if (entity.t > 1) entity.t = 1;
  }

  function resetActors() {
    game.player = makeEntity(START.col, START.row);
    game.ghosts.forEach((g, i) => {
      const home = CORNERS[i];
      g.col = home.col;
      g.row = home.row;
      g.fromCol = home.col;
      g.fromRow = home.row;
      g.t = 0;
      g.dir = DIRS[i % 2 === 0 ? 0 : 1];
    });
    game.fright = 0;
    game.freeze = 1.1;
  }

  function loseLife() {
    if (game.freeze > 0) return;
    game.lives -= 1;
    audio.hit();
    paintHud();
    if (game.lives <= 0) {
      endGame();
      return;
    }
    resetActors();
  }

  function endGame() {
    game.mode = "over";
    audio.miss();
    if (game.score > game.best) {
      game.best = game.score;
      setBest("maze", game.best);
    }
    paintHud();
    modal = overlay(root, {
      kicker: "GEPAKT",
      title: "De spoken waren sneller",
      text: `Je at <strong>${formatNumber(game.score)}</strong> punten weg in level <strong>${game.level}</strong>.`,
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
    game.time += dt;

    if (game.mode !== "playing") return;

    if (game.freeze > 0) {
      game.freeze = Math.max(0, game.freeze - dt);
      return;
    }

    if (game.fright > 0) game.fright = Math.max(0, game.fright - dt);

    advance(game.player, game.playerStep, dt, choosePlayer);
    for (const ghost of game.ghosts) advance(ghost, game.ghostStep, dt, chooseGhost);

    // collisions
    const p = pos(game.player);
    for (const ghost of game.ghosts) {
      const g = pos(ghost);
      if (Math.hypot(p.x - g.x, p.y - g.y) > 0.55) continue;
      if (game.fright > 0) {
        game.score += 200;
        if (game.score > game.best) game.best = game.score;
        audio.eat();
        paintHud();
        ghost.col = ghost.home.col;
        ghost.row = ghost.home.row;
        ghost.fromCol = ghost.home.col;
        ghost.fromRow = ghost.home.row;
        ghost.t = 0;
      } else {
        loseLife();
        return;
      }
    }
  }

  function drawMaze(ox, oy, cell) {
    // walls
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (MAP[row][col] !== "#") continue;
        const x = ox + col * cell;
        const y = oy + row * cell;
        const inset = cell * 0.08;
        ctx.fillStyle = "rgba(61,252,255,0.07)";
        ctx.strokeStyle = "rgba(61,252,255,0.55)";
        ctx.lineWidth = Math.max(1, cell * 0.055);
        ctx.shadowColor = "rgba(61,252,255,0.55)";
        ctx.shadowBlur = cell * 0.5;
        const r = cell * 0.28;
        const bx = x + inset;
        const by = y + inset;
        const bw = cell - inset * 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bw, r);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // pellets
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = game.grid[row]?.[col];
        if (c !== "." && c !== "o") continue;
        const cx = ox + (col + 0.5) * cell;
        const cy = oy + (row + 0.5) * cell;
        if (c === ".") {
          ctx.fillStyle = "rgba(255,247,214,0.85)";
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1.4, cell * 0.075), 0, Math.PI * 2);
          ctx.fill();
        } else {
          const pulse = 1 + Math.sin(game.time * 6) * 0.22;
          ctx.fillStyle = "#ffe14d";
          ctx.shadowColor = "#ffe14d";
          ctx.shadowBlur = cell * 0.7;
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.18 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  function drawPlayer(ox, oy, cell) {
    const p = pos(game.player);
    const cx = ox + (p.x + 0.5) * cell;
    const cy = oy + (p.y + 0.5) * cell;
    const r = cell * 0.38;
    const dir = game.player.dir;
    const base = dir.x ? (dir.x > 0 ? 0 : Math.PI) : dir.y ? (dir.y > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    const mouth = Math.abs(Math.sin(game.time * 9)) * 0.32 + 0.04;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(base);
    ctx.shadowColor = "#ffe14d";
    ctx.shadowBlur = cell * 0.9;
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGhost(ghost, ox, oy, cell) {
    const g = pos(ghost);
    const cx = ox + (g.x + 0.5) * cell;
    const cy = oy + (g.y + 0.5) * cell;
    const r = cell * 0.36;
    const frightened = game.fright > 0;
    const blinking = frightened && game.fright < 2 && Math.floor(game.time * 8) % 2 === 0;
    const color = frightened ? (blinking ? "#eaffff" : "#6f8bff") : ghost.color;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -r * 0.15, r, Math.PI, 0);
    ctx.lineTo(r, r * 0.62);
    ctx.quadraticCurveTo(r * 0.66, r * 0.34, r * 0.33, r * 0.62);
    ctx.quadraticCurveTo(0, r * 0.34, -r * 0.33, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.66, r * 0.34, -r, r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (frightened) {
      ctx.fillStyle = "rgba(10,14,22,0.85)";
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.2, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(10,14,22,0.85)";
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.25);
      ctx.lineTo(-r * 0.16, r * 0.36);
      ctx.lineTo(r * 0.16, r * 0.25);
      ctx.lineTo(r * 0.5, r * 0.36);
      ctx.stroke();
    } else {
      const lookX = ghost.dir.x * r * 0.12;
      const lookY = ghost.dir.y * r * 0.12;
      ctx.fillStyle = "#f6fbff";
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.22, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.32, -r * 0.22, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0d14";
      ctx.beginPath();
      ctx.arc(-r * 0.32 + lookX, -r * 0.22 + lookY, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.32 + lookX, -r * 0.22 + lookY, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    const cell = Math.min(w / (COLS + 0.6), h / (ROWS + 0.6));
    const ox = (w - COLS * cell) / 2;
    const oy = (h - ROWS * cell) / 2;

    drawMaze(ox, oy, cell);

    for (const ghost of game.ghosts) drawGhost(ghost, ox, oy, cell);
    drawPlayer(ox, oy, cell);

    if (game.freeze > 0 && game.mode === "playing") {
      ctx.fillStyle = "rgba(244,239,230,0.85)";
      ctx.font = `600 ${Math.max(11, cell * 0.62)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("KLAAR?", ox + (COLS * cell) / 2, oy + (ROWS * cell) / 2 + cell * 0.3);
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
    game.freeze = Math.max(game.freeze, 0.8);
    audio.blip();
  }

  const KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "];
  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (KEYS.includes(k)) event.preventDefault();

    if (game.mode !== "playing") {
      if (k === " " || k === "enter") begin();
      return;
    }

    const player = game.player;
    if (k === "arrowleft" || k === "a") player.nextDir = { x: -1, y: 0 };
    if (k === "arrowright" || k === "d") player.nextDir = { x: 1, y: 0 };
    if (k === "arrowup" || k === "w") player.nextDir = { x: 0, y: -1 };
    if (k === "arrowdown" || k === "s") player.nextDir = { x: 0, y: 1 };
  };
  window.addEventListener("keydown", onKeyDown);

  let swipe = null;
  const onPointerDown = (event) => {
    swipe = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;

    if (game.mode !== "playing") return;
    if (Math.hypot(dx, dy) < 20) return;
    const player = game.player;
    if (Math.abs(dx) > Math.abs(dy)) player.nextDir = { x: dx > 0 ? 1 : -1, y: 0 };
    else player.nextDir = { x: 0, y: dy > 0 ? 1 : -1 };
  };
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", onPointerUp);

  reset();
  game.mode = "ready";

  let modal = overlay(root, {
    kicker: "MAZE MUNCHER",
    title: "Eet alles, ontwijk de spoken",
    text: "Stuur met de pijltjes of veeg over het scherm. Grote stippen maken de spoken even bang — dan kun je ze juist opeten.",
    extra: `<div class="ov-keys">
      <span class="kbd">← ↑ ↓ →</span><span class="kbd">WASD</span><span class="kbd">VEGEN</span>
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
      reset();
      game.mode = "playing";
      game.freeze = 0.8;
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
