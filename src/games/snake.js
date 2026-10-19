import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber, clamp, pick } from "./util.js";

const GRID = 19;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
        <div class="hud-item"><span class="hud-label">Lengte</span><span class="hud-value" data-len>4</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const lenNode = root.querySelector("[data-len]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    snake: [],
    dir: { x: 1, y: 0 },
    queue: [],
    food: { x: 10, y: 9 },
    score: 0,
    best: getBest("snake") ?? 0,
    acc: 0,
    interval: 0.15,
    time: 0,
    particles: [],
    pulse: 0,
    eaten: 0,
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    lenNode.textContent = String(game.snake.length);
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!game.snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    if (free.length) game.food = pick(free);
  }

  function reset() {
    const mid = Math.floor(GRID / 2);
    game.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    game.dir = { x: 1, y: 0 };
    game.queue = [];
    game.score = 0;
    game.acc = 0;
    game.interval = 0.15;
    game.particles.length = 0;
    game.eaten = 0;
    placeFood();
    paintHud();
  }

  reset();

  function burst(gx, gy, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 180;
      game.particles.push({
        gx,
        gy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        color,
      });
    }
  }

  function die() {
    game.mode = "over";
    audio.miss();
    if (game.score > game.best) {
      game.best = game.score;
      setBest("snake", game.best);
    }
    paintHud();
    modal = overlay(root, {
      kicker: "VERDWAALD IN HET DONKER",
      title: "Je beet jezelf",
      text: `Je verzamelde <strong>${formatNumber(game.eaten)}</strong> sterren en werd <strong>${game.snake.length}</strong> segmenten lang.`,
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

  function step() {
    if (game.queue.length) {
      const next = game.queue.shift();
      if (next.x !== -game.dir.x || next.y !== -game.dir.y) game.dir = next;
    }

    const head = game.snake[0];
    const nx = head.x + game.dir.x;
    const ny = head.y + game.dir.y;

    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      die();
      return;
    }
    if (game.snake.some((s) => s.x === nx && s.y === ny)) {
      die();
      return;
    }

    game.snake.unshift({ x: nx, y: ny });

    if (nx === game.food.x && ny === game.food.y) {
      game.score += 10;
      game.eaten += 1;
      game.pulse = 1;
      if (game.score > game.best) game.best = game.score;
      game.interval = Math.max(0.065, 0.15 - game.eaten * 0.0042);
      audio.eat();
      burst(nx, ny, "#9dffc4");
      placeFood();
      paintHud();
    } else {
      game.snake.pop();
    }
  }

  function update(dt) {
    game.time += dt;
    game.pulse = Math.max(0, game.pulse - dt * 2.4);

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.gx += (p.vx * dt) / 20;
      p.gy += (p.vy * dt) / 20;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }

    if (game.mode !== "playing") return;

    game.acc += dt;
    while (game.acc >= game.interval) {
      game.acc -= game.interval;
      step();
      if (game.mode !== "playing") break;
    }
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    const size = Math.min(w, h) * 0.9;
    const cell = size / GRID;
    const ox = (w - size) / 2;
    const oy = (h - size) / 2;

    // board
    ctx.save();
    ctx.fillStyle = "rgba(142,245,176,0.035)";
    ctx.strokeStyle = "rgba(142,245,176,0.12)";
    ctx.lineWidth = 1;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(ox + r, oy);
    ctx.arcTo(ox + size, oy, ox + size, oy + size, r);
    ctx.arcTo(ox + size, oy + size, ox, oy + size, r);
    ctx.arcTo(ox, oy + size, ox, oy, r);
    ctx.arcTo(ox, oy, ox + size, oy, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // grid dots
    ctx.fillStyle = "rgba(142,245,176,0.10)";
    for (let y = 1; y < GRID; y++) {
      for (let x = 1; x < GRID; x++) {
        ctx.fillRect(ox + x * cell - 0.5, oy + y * cell - 0.5, 1, 1);
      }
    }

    // food
    const fx = ox + (game.food.x + 0.5) * cell;
    const fy = oy + (game.food.y + 0.5) * cell;
    const pulse = 1 + Math.sin(game.time * 5) * 0.12;

    ctx.save();
    ctx.shadowColor = "#c9ffe0";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "#eafff2";
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 0.26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(142,245,176,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 0.42 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // particles
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(ox + p.gx * cell + cell / 2, oy + p.gy * cell + cell / 2, cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // snake (tail first so the head sits on top)
    for (let i = game.snake.length - 1; i >= 0; i--) {
      const seg = game.snake[i];
      const k = 1 - i / Math.max(1, game.snake.length);
      const px = ox + seg.x * cell;
      const py = oy + seg.y * cell;
      const inset = cell * 0.1;

      ctx.save();
      ctx.shadowColor = "rgba(142,245,176,0.85)";
      ctx.shadowBlur = i === 0 ? 26 : 12 * k;
      ctx.fillStyle = i === 0 ? "#d6ffe6" : `rgba(${Math.round(120 + 60 * k)}, 245, ${Math.round(170 + 30 * k)}, ${0.55 + 0.45 * k})`;
      const rr = cell * (i === 0 ? 0.3 : 0.24);
      const x = px + inset;
      const y = py + inset;
      const s = cell - inset * 2;
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + s, y, x + s, y + s, rr);
      ctx.arcTo(x + s, y + s, x, y + s, rr);
      ctx.arcTo(x, y + s, x, y, rr);
      ctx.arcTo(x, y, x + s, y, rr);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (i === 0) {
        // eyes
        const ex = px + cell / 2 + game.dir.x * cell * 0.16;
        const ey = py + cell / 2 + game.dir.y * cell * 0.16;
        const off = cell * 0.16;
        ctx.fillStyle = "rgba(6,26,16,0.9)";
        if (game.dir.x !== 0) {
          ctx.beginPath();
          ctx.arc(ex, ey - off, cell * 0.055, 0, Math.PI * 2);
          ctx.arc(ex, ey + off, cell * 0.055, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(ex - off, ey, cell * 0.055, 0, Math.PI * 2);
          ctx.arc(ex + off, ey, cell * 0.055, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // eat flash
    if (game.pulse > 0) {
      ctx.globalAlpha = game.pulse * 0.09;
      ctx.fillStyle = "#8ef5b0";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  function turn(x, y) {
    const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
    if (last.x === -x && last.y === -y) return;
    if (last.x === x && last.y === y) return;
    if (game.queue.length < 2) game.queue.push({ x, y });
  }

  function begin() {
    if (game.mode === "playing") return;
    if (game.mode === "over") {
      reset();
    }
    game.mode = "playing";
    audio.blip();
  }

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(k)) {
      event.preventDefault();
    }
    if (k === "arrowleft" || k === "a") turn(-1, 0);
    if (k === "arrowright" || k === "d") turn(1, 0);
    if (k === "arrowup" || k === "w") turn(0, -1);
    if (k === "arrowdown" || k === "s") turn(0, 1);
    if (k === " ") begin();
  };
  window.addEventListener("keydown", onKeyDown);

  let touchStart = null;
  const onPointerDown = (event) => {
    touchStart = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event) => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.hypot(dx, dy) < 24) {
      begin();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
  };
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", onPointerUp);

  let modal = overlay(root, {
    kicker: "NEON SNAKE",
    title: "Eet, groei, overleef",
    text: "Stuur met de pijltjes of WASD. Op mobiel kun je vegen. Elke ster maakt je sneller.",
    extra: `<div class="ov-keys">
      <span class="kbd">← ↑ ↓ →</span><span class="kbd">WASD</span><span class="kbd">SPATIE = START</span>
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
