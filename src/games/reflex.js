import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const DURATION = 40;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value accent" data-time>40</span></div>
        <div class="hud-item"><span class="hud-label">Combo</span><span class="hud-value" data-combo>x1</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const timeNode = root.querySelector("[data-time]");
  const comboNode = root.querySelector("[data-combo]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);
  root.style.cursor = "crosshair";

  const game = {
    mode: "ready",
    score: 0,
    best: getBest("reflex") ?? 0,
    timeLeft: DURATION,
    targets: [],
    bursts: [],
    hits: 0,
    misses: 0,
    combo: 1,
    time: 0,
    shake: 0,
    spawnTimer: 0,
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    timeNode.textContent = String(Math.ceil(Math.max(0, game.timeLeft)));
    comboNode.textContent = `x${game.combo}`;
  }

  function randomTarget() {
    const pad = 0.12;
    const maxTargets = game.timeLeft > 25 ? 2 : 3;
    if (game.targets.length >= maxTargets) return;
    game.targets.push({
      x: pad + Math.random() * (1 - pad * 2),
      y: 0.2 + Math.random() * 0.6,
      r: 0.055 + Math.random() * 0.035,
      life: 2.4,
      max: 2.4,
      born: game.time,
    });
  }

  function reset() {
    game.score = 0;
    game.timeLeft = DURATION;
    game.targets = [];
    game.bursts = [];
    game.hits = 0;
    game.misses = 0;
    game.combo = 1;
    game.time = 0;
    game.shake = 0;
    game.spawnTimer = 0.2;
    paintHud();
  }

  reset();
  game.mode = "ready";

  function endGame() {
    game.mode = "over";
    game.targets = [];
    const accuracy = game.hits + game.misses ? Math.round((game.hits / (game.hits + game.misses)) * 100) : 0;
    if (game.score > game.best) {
      game.best = game.score;
      setBest("reflex", game.best);
    }
    paintHud();
    audio.win();
    modal = overlay(root, {
      kicker: "TIJD IS OM",
      title: `${formatNumber(game.score)} punten`,
      text: `Je raakte <strong>${game.hits}</strong> doelen met <strong>${accuracy}%</strong> nauwkeurigheid.`,
      extra: `<div class="ov-stat">
        <div><span>Score</span><span>${formatNumber(game.score)}</span></div>
        <div><span>Beste</span><span>${formatNumber(game.best)}</span></div>
        <div><span>Rek</span><span>${accuracy}%</span></div>
      </div>`,
      button: "OPNIEUW",
      onStart: () => {
        reset();
        game.mode = "playing";
      },
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.15 + Math.random() * 0.4;
      game.bursts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        color,
      });
    }
  }

  function update(dt) {
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 3);

    for (let i = game.bursts.length - 1; i >= 0; i--) {
      const b = game.bursts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.97;
      b.vy *= 0.97;
      b.life -= dt;
      if (b.life <= 0) game.bursts.splice(i, 1);
    }

    if (game.mode !== "playing") return;

    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      endGame();
      return;
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      randomTarget();
      game.spawnTimer = 0.45 + Math.random() * 0.5;
    }

    for (let i = game.targets.length - 1; i >= 0; i--) {
      const t = game.targets[i];
      t.life -= dt;
      if (t.life <= 0) {
        game.targets.splice(i, 1);
        game.combo = 1;
        game.misses += 1;
      }
    }

    paintHud();
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    // range circles
    ctx.strokeStyle = "rgba(61,252,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (Math.min(w, h) / 2) * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    // targets
    for (const t of game.targets) {
      const x = t.x * w;
      const y = t.y * h;
      const r = t.r * Math.min(w, h);
      const fade = Math.min(1, t.life / 0.4);
      const shrink = 0.55 + 0.45 * (t.life / t.max);
      const color = t.life / t.max > 0.35 ? "#3dfcff" : "#ff6f91";

      ctx.globalAlpha = fade;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * shrink, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r * shrink * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r * shrink * 1.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // bursts
    for (const b of game.bursts) {
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x * w, b.y * h, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // time bar
    const ratio = Math.max(0, game.timeLeft / DURATION);
    ctx.fillStyle = "rgba(244,239,230,0.08)";
    ctx.fillRect(w * 0.12, h * 0.94, w * 0.76, 4);
    ctx.fillStyle = ratio < 0.25 ? "#ff6f91" : "#3dfcff";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillRect(w * 0.12, h * 0.94, w * 0.76 * ratio, 4);
    ctx.shadowBlur = 0;

    if (game.timeLeft <= 5 && game.mode === "playing") {
      ctx.globalAlpha = 0.06 + Math.abs(Math.sin(game.time * 6)) * 0.06;
      ctx.fillStyle = "#ff6f91";
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
    game.targets = [];
    game.spawnTimer = 0.1;
    randomTarget();
    randomTarget();
    audio.blip();
  }

  const onKeyDown = (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (game.mode !== "playing") begin();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  const onPointerDown = (event) => {
    if (game.mode !== "playing") return;
    const rect = root.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const unit = Math.min(state.width, state.height);

    for (let i = game.targets.length - 1; i >= 0; i--) {
      const t = game.targets[i];
      const dx = (x - t.x) * state.width;
      const dy = (y - t.y) * state.height;
      const shrink = 0.55 + 0.45 * (t.life / t.max);
      if (Math.hypot(dx, dy) <= t.r * unit * shrink + 4) {
        const bonus = Math.round(10 + (t.life / t.max) * 20);
        game.score += bonus * game.combo;
        game.hits += 1;
        game.combo = Math.min(5, game.combo + 1);
        burst(t.x, t.y, "#c9ffe0");
        game.targets.splice(i, 1);
        audio.eat();
        paintHud();
        return;
      }
    }

    game.combo = 1;
    game.misses += 1;
    game.shake = 1;
    audio.miss();
    paintHud();
  };

  root.addEventListener("pointerdown", onPointerDown);

  let modal = overlay(root, {
    kicker: "REFLEX RUSH",
    title: "Raak zoveel doelen als je kunt",
    text: "Je hebt 40 seconden. Elk doel dat je raakt levert meer punten op, en een reeks hits verhoogt je combo.",
    extra: `<div class="ov-keys"><span class="kbd">KLIKKEN</span><span class="kbd">TIKKEN</span></div>`,
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
      randomTarget();
      randomTarget();
    },
    destroy: () => {
      stopLoop();
      destroyCanvas();
      root.style.cursor = "";
      window.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
