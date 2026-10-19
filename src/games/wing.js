import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const GRAVITY = 2.35;
const FLAP = -0.78;
const PIPE_W = 0.13;
const GAP = 0.3;
const SPEED = 0.34;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    y: 0.45,
    vy: 0,
    pipes: [],
    stars: [],
    score: 0,
    best: getBest("wing") ?? 0,
    spawnTimer: 0,
    time: 0,
    flash: 0,
    angle: 0,
  };

  bestNode.textContent = formatNumber(game.best);

  for (let i = 0; i < 60; i++) {
    game.stars.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      a: 0.2 + Math.random() * 0.6,
    });
  }

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
  }

  function reset() {
    game.y = 0.45;
    game.vy = 0;
    game.pipes = [];
    game.score = 0;
    game.spawnTimer = 0.6;
    game.flash = 0;
    game.angle = 0;
    paintHud();
  }

  function spawnPipe() {
    const gapY = 0.2 + Math.random() * 0.45;
    game.pipes.push({ x: 1.08, gapY, passed: false });
  }

  function endGame() {
    game.mode = "over";
    audio.hit();
    if (game.score > game.best) {
      game.best = game.score;
      setBest("wing", game.best);
    }
    paintHud();
    modal = overlay(root, {
      kicker: "NEERGEVALLEN",
      title: "De zwaartekracht wint",
      text: `Je vloog door <strong>${game.score}</strong> poorten${game.score === game.best && game.score > 0 ? " — een nieuw record." : "."}`,
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

  function flap() {
    if (game.mode === "over") return;
    if (game.mode === "ready") {
      game.mode = "playing";
      modal?.close();
      modal = null;
    }
    game.vy = FLAP;
    game.angle = -0.5;
    audio.tone({ freq: 520, to: 760, dur: 0.08, type: "triangle", gain: 0.03 });
  }

  function update(dt) {
    game.time += dt;
    game.flash = Math.max(0, game.flash - dt * 3);

    for (const s of game.stars) {
      s.x -= dt * 0.02 * (0.5 + s.r);
      if (s.x < 0) s.x += 1;
    }

    if (game.mode !== "playing") return;

    game.vy += GRAVITY * dt;
    game.y += game.vy * dt;
    game.angle += (-Math.PI / 2 - game.angle) * dt * 2.2;

    if (game.y > 0.94) {
      game.y = 0.94;
      endGame();
      return;
    }
    if (game.y < 0.05) {
      game.y = 0.05;
      game.vy = 0;
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnPipe();
      game.spawnTimer = 1.55;
    }

    const birdX = 0.28;
    const r = 0.032;

    for (let i = game.pipes.length - 1; i >= 0; i--) {
      const p = game.pipes[i];
      p.x -= SPEED * dt;

      if (!p.passed && p.x + PIPE_W < birdX) {
        p.passed = true;
        game.score += 1;
        if (game.score > game.best) game.best = game.score;
        game.flash = 1;
        audio.eat();
        paintHud();
      }

      if (p.x < -PIPE_W - 0.05) {
        game.pipes.splice(i, 1);
        continue;
      }

      // collision: bird circle vs two pipe rects
      const insideX = birdX + r > p.x && birdX - r < p.x + PIPE_W;
      if (!insideX) continue;
      const topBottom = p.gapY;
      const bottomTop = p.gapY + GAP;
      if (game.y - r < topBottom || game.y + r > bottomTop) {
        endGame();
        return;
      }
    }
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    // sky glow
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "rgba(61,252,255,0.10)");
    sky.addColorStop(0.55, "rgba(155,107,255,0.08)");
    sky.addColorStop(1, "rgba(255,61,154,0.12)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    for (const s of game.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#eaf4ff";
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // pipes
    for (const p of game.pipes) {
      const px = p.x * w;
      const pw = PIPE_W * w;
      const topEnd = p.gapY * h;
      const botStart = (p.gapY + GAP) * h;

      for (const [y0, y1] of [[0, topEnd], [botStart, h * 0.95]]) {
        const grad = ctx.createLinearGradient(px, 0, px + pw, 0);
        grad.addColorStop(0, "rgba(255,61,154,0.55)");
        grad.addColorStop(0.5, "rgba(255,61,154,0.95)");
        grad.addColorStop(1, "rgba(155,107,255,0.75)");
        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(255,61,154,0.7)";
        ctx.shadowBlur = 22;
        ctx.fillRect(px, y0, pw, y1 - y0);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "rgba(255,220,240,0.65)";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(px + 0.7, y0 + 0.7, pw - 1.4, Math.max(0, y1 - y0 - 1.4));

        // cap
        const capY = y0 === 0 ? y1 - 10 : y1;
        ctx.fillStyle = "rgba(255,190,225,0.9)";
        ctx.fillRect(px - 5, capY, pw + 10, 10);
      }
    }

    // ground
    ctx.fillStyle = "rgba(255,61,154,0.16)";
    ctx.fillRect(0, h * 0.95, w, h * 0.05);

    // bird
    const bx = 0.28 * w;
    const by = game.y * h;
    const rad = Math.max(9, Math.min(w, h) * 0.032);

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.max(-0.6, Math.min(1.1, game.angle * 0.55)));

    ctx.shadowColor = "#ffe14d";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath();
    ctx.ellipse(0, 0, rad * 1.25, rad, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff9d3d";
    ctx.beginPath();
    ctx.moveTo(rad * 1.05, 0);
    ctx.lineTo(rad * 1.8, rad * 0.18);
    ctx.lineTo(rad * 1.05, rad * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0a0d14";
    ctx.beginPath();
    ctx.arc(rad * 0.45, -rad * 0.3, rad * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.10;
      ctx.fillStyle = "#ffe14d";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (k === " " || k === "arrowup" || k === "w" || k === "enter") {
      event.preventDefault();
      if (game.mode === "over") return;
      flap();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  const onPointerDown = () => {
    if (game.mode === "over") return;
    flap();
  };
  root.addEventListener("pointerdown", onPointerDown);

  let modal = overlay(root, {
    kicker: "NEON WING",
    title: "Blijf tussen de poorten",
    text: "Tik of druk op spatie om te fladderen. Elke poort die je voorbij vliegt is een punt.",
    extra: `<div class="ov-keys"><span class="kbd">SPATIE</span><span class="kbd">TIKKEN</span></div>`,
    button: "BEGIN",
    onStart: () => {
      game.mode = "playing";
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
    },
  };
}
