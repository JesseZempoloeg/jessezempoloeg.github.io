import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const N = 4;
const SIZE = N * N;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Zetten</span><span class="hud-value" data-moves>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>—</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value accent" data-time>0:00</span></div>
      </div>
    </div>`;

  const movesNode = root.querySelector("[data-moves]");
  const bestNode = root.querySelector("[data-best]");
  const timeNode = root.querySelector("[data-time]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    tiles: [],
    moves: 0,
    seconds: 0,
    best: getBest("slide"),
    flash: 0,
    time: 0,
    cel: 0,
    origin: { x: 0, y: 0 },
  };

  function paintHud() {
    movesNode.textContent = String(game.moves);
    bestNode.textContent = game.best === null ? "—" : `${formatNumber(game.best)} ZETTEN`;
    const m = Math.floor(game.seconds / 60);
    const s = Math.floor(game.seconds % 60);
    timeNode.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }

  function solved() {
    for (let i = 0; i < SIZE - 1; i++) if (game.tiles[i] !== i + 1) return false;
    return game.tiles[SIZE - 1] === 0;
  }

  function blankIndex() {
    return game.tiles.indexOf(0);
  }

  function neighbours(index) {
    const r = Math.floor(index / N);
    const c = index % N;
    const list = [];
    if (r > 0) list.push(index - N);
    if (r < N - 1) list.push(index + N);
    if (c > 0) list.push(index - 1);
    if (c < N - 1) list.push(index + 1);
    return list;
  }

  function move(index) {
    if (game.mode !== "playing") return false;
    const blank = blankIndex();
    if (!neighbours(blank).includes(index)) return false;

    game.tiles[blank] = game.tiles[index];
    game.tiles[index] = 0;
    game.moves += 1;
    paintHud();
    audio.step();

    if (solved()) {
      game.flash = 1;
      endGame();
    }
    return true;
  }

  function shuffle() {
    game.tiles = Array.from({ length: SIZE - 1 }, (_, i) => i + 1).concat(0);
    let blank = SIZE - 1;
    let last = -1;
    for (let i = 0; i < 400; i++) {
      const options = neighbours(blank).filter((n) => n !== last);
      const pick = options[Math.floor(Math.random() * options.length)];
      game.tiles[blank] = game.tiles[pick];
      game.tiles[pick] = 0;
      last = blank;
      blank = pick;
    }
  }

  function reset() {
    shuffle();
    game.moves = 0;
    game.seconds = 0;
    game.flash = 0;
    paintHud();
  }

  function endGame() {
    game.mode = "over";
    audio.win();
    if (game.best === null || game.moves < game.best) {
      game.best = game.moves;
      setBest("slide", game.best);
    }
    paintHud();

    const m = Math.floor(game.seconds / 60);
    const s = Math.floor(game.seconds % 60);
    modal = overlay(root, {
      kicker: "OPGELOST",
      title: `${game.moves} zetten`,
      text: `Je had <strong>${m}:${String(s).padStart(2, "0")}</strong> nodig. Minder zetten is beter.`,
      extra: `<div class="ov-stat">
        <div><span>Zetten</span><span>${game.moves}</span></div>
        <div><span>Beste</span><span>${formatNumber(game.best)}</span></div>
      </div>`,
      button: "NIEUWE PUZZEL",
      onStart: () => {
        reset();
        game.mode = "playing";
      },
    });
  }

  function update(dt) {
    game.time += dt;
    game.flash = Math.max(0, game.flash - dt * 1.4);
    if (game.mode !== "playing") return;
    if (game.moves > 0) {
      game.seconds += dt;
      paintHud();
    }
  }

  function geometry() {
    const cell = Math.min((state.width * 0.86) / N, (state.height * 0.82) / N);
    const boardSize = cell * N;
    return {
      cell,
      ox: (state.width - boardSize) / 2,
      oy: (state.height - boardSize) / 2,
    };
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    const { cell, ox, oy } = geometry();
    const gap = cell * 0.055;
    const radius = cell * 0.16;

    ctx.fillStyle = "rgba(155,107,255,0.05)";
    ctx.strokeStyle = "rgba(155,107,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox - cell * 0.12, oy - cell * 0.12, cell * N + cell * 0.24, cell * N + cell * 0.24, cell * 0.24);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < SIZE; i++) {
      const value = game.tiles[i];
      if (!value) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const x = ox + c * cell + gap;
      const y = oy + r * cell + gap;
      const size = cell - gap * 2;

      const correct = value === i + 1;
      const grad = ctx.createLinearGradient(x, y, x + size, y + size);
      if (correct) {
        grad.addColorStop(0, "rgba(142,245,176,0.9)");
        grad.addColorStop(1, "rgba(61,252,255,0.55)");
      } else {
        grad.addColorStop(0, "rgba(201,167,255,0.85)");
        grad.addColorStop(1, "rgba(155,107,255,0.45)");
      }

      ctx.save();
      ctx.shadowColor = correct ? "rgba(142,245,176,0.6)" : "rgba(155,107,255,0.55)";
      ctx.shadowBlur = cell * 0.4;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, radius);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(6,8,14,0.92)";
      ctx.font = `500 ${Math.max(12, cell * 0.42)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), x + size / 2, y + size / 2 + cell * 0.02);
      ctx.textBaseline = "alphabetic";
    }

    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.15;
      ctx.fillStyle = "#8ef5b0";
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

  const onPointerDown = (event) => {
    if (game.mode !== "playing") return;
    const rect = root.getBoundingClientRect();
    const { cell, ox, oy } = geometry();
    const x = event.clientX - rect.left - ox;
    const y = event.clientY - rect.top - oy;
    if (x < 0 || y < 0 || x > cell * N || y > cell * N) return;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    move(row * N + col);
  };
  root.addEventListener("pointerdown", onPointerDown);

  const KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", " "];
  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (KEYS.includes(k)) event.preventDefault();

    if (game.mode !== "playing") {
      if (k === " " || k === "enter") begin();
      return;
    }

    // arrow moves the blank, so the clicked tile slides in the opposite direction
    const blank = blankIndex();
    if (k === "arrowup") move(blank + N);
    if (k === "arrowdown") move(blank - N);
    if (k === "arrowleft") move(blank + 1);
    if (k === "arrowright") move(blank - 1);
  };
  window.addEventListener("keydown", onKeyDown);

  reset();

  let modal = overlay(root, {
    kicker: "NEBULA SLIDE",
    title: "Schuif de tegels in volgorde",
    text: "Klik een tegel naast het lege vak. Groene tegels staan al goed. Probeer het in zo weinig mogelijk zetten.",
    extra: `<div class="ov-keys"><span class="kbd">KLIKKEN</span><span class="kbd">PIJLTJES</span></div>`,
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
    },
    destroy: () => {
      stopLoop();
      destroyCanvas();
      window.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
