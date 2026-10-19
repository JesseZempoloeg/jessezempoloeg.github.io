import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber, clamp, pointerPos } from "./util.js";

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
        <div class="hud-item"><span class="hud-label">Level</span><span class="hud-value" data-level>1</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end">
        <span class="hud-label">Levens</span>
        <div class="lives" data-lives></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const levelNode = root.querySelector("[data-level]");
  const livesNode = root.querySelector("[data-lives]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const COLORS = ["#ff9d6e", "#ffc98a", "#f6e2b3", "#9fe8d0", "#8fd8ff", "#c9a7ff", "#ff8fa3"];

  const game = {
    mode: "ready",
    score: 0,
    best: getBest("breakout") ?? 0,
    lives: 3,
    level: 1,
    bricks: [],
    particles: [],
    trail: [],
    flash: 0,
    shake: 0,
  };

  const paddle = { x: 0, w: 130, h: 12, y: 0, target: 0 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 7, stuck: true };

  bestNode.textContent = formatNumber(game.best);
  paintLives();

  function paintLives() {
    livesNode.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = `life${i < game.lives ? "" : " off"}`;
      livesNode.appendChild(dot);
    }
  }

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    levelNode.textContent = String(game.level);
  }

  function layout() {
    const w = state.width;
    const h = state.height;
    const cols = w < 640 ? 7 : 9;
    const rows = Math.min(7, 4 + game.level);
    const margin = Math.max(18, w * 0.06);
    const usable = w - margin * 2;
    const gap = Math.max(5, w * 0.008);
    const bw = (usable - gap * (cols - 1)) / cols;
    const bh = Math.max(16, Math.min(26, h * 0.032));
    const top = Math.max(96, h * 0.16);

    const keep = new Map();
    game.bricks.forEach((b) => keep.set(`${b.row}:${b.col}`, b));

    const next = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const prev = keep.get(`${r}:${c}`);
        next.push({
          row: r,
          col: c,
          x: margin + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          color: COLORS[r % COLORS.length],
          alive: prev ? prev.alive : true,
        });
      }
    }
    game.bricks = next;

    paddle.w = clamp(w * 0.19, 90, 170);
    paddle.y = h - Math.max(58, h * 0.1);
    paddle.x = clamp(paddle.x || w / 2, paddle.w / 2, w - paddle.w / 2);
    paddle.target = paddle.x;

    if (ball.stuck) {
      ball.x = paddle.x;
      ball.y = paddle.y - ball.r - paddle.h / 2;
    }
  }

  layout();

  function resetBall() {
    ball.stuck = true;
    ball.x = paddle.x;
    ball.y = paddle.y - ball.r - paddle.h / 2 - 1;
    ball.vx = 0;
    ball.vy = 0;
    game.trail.length = 0;
  }

  function launch() {
    if (game.mode !== "playing" || !ball.stuck) return;
    const speed = 340 + (game.level - 1) * 45;
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.7;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.stuck = false;
    audio.blip();
  }

  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 220;
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        color,
        size: 1 + Math.random() * 2.6,
      });
    }
  }

  function startRun() {
    game.mode = "playing";
    game.score = 0;
    game.lives = 3;
    game.level = 1;
    game.bricks.forEach((b) => (b.alive = true));
    game.particles.length = 0;
    paddle.x = state.width / 2;
    paddle.target = paddle.x;
    layout();
    resetBall();
    paintHud();
    paintLives();
  }

  function nextLevel() {
    game.level += 1;
    game.flash = 1;
    layout();
    resetBall();
    paintHud();
    audio.win();
  }

  function loseLife() {
    game.lives -= 1;
    game.shake = 1;
    audio.miss();
    paintLives();
    if (game.lives <= 0) {
      game.mode = "over";
      if (game.score > game.best) {
        game.best = game.score;
        setBest("breakout", game.best);
      }
      paintHud();
      modal = overlay(root, {
        kicker: "DE HEMEL WINT",
        title: "Alle brokken zijn op",
        text: `Je haalde <strong>${formatNumber(game.score)}</strong> punten in level ${game.level}.`,
        button: "OPNIEUW",
        onStart: startRun,
      });
      return;
    }
    resetBall();
  }

  let modal = overlay(root, {
    kicker: "METEOR BREAK",
    title: "Breek de hemel",
    text: "Beweeg met je muis of de pijltjes. Klik of druk op <strong>spatie</strong> om de bal te lanceren. Elke level vliegt hij sneller.",
    extra: `<div class="ov-keys">
      <span class="kbd">MUIS</span><span class="kbd">← →</span><span class="kbd">SPATIE = LANCEREN</span>
    </div>`,
    button: "BEGIN",
    onStart: () => {
      game.mode = "playing";
      resetBall();
    },
  });

  /* ---------- input ---------- */
  const onPointerMove = (event) => {
    const p = pointerPos(root, event);
    paddle.target = clamp(p.x, paddle.w / 2, state.width - paddle.w / 2);
  };
  const onPointerDown = () => launch();
  const keys = new Set();

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", " "].includes(k)) event.preventDefault();
    keys.add(k);
    if (k === " ") launch();
  };
  const onKeyUp = (event) => keys.delete(event.key.toLowerCase());

  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ---------- physics ---------- */
  function update(dt) {
    const w = state.width;
    const h = state.height;

    if (game.mode === "playing") {
      const speed = 620;
      if (keys.has("arrowleft") || keys.has("a")) paddle.target -= speed * dt;
      if (keys.has("arrowright") || keys.has("d")) paddle.target += speed * dt;
      paddle.target = clamp(paddle.target, paddle.w / 2, w - paddle.w / 2);
    }
    paddle.x += (paddle.target - paddle.x) * Math.min(1, dt * 16);

    if (ball.stuck) {
      ball.x = paddle.x;
      ball.y = paddle.y - ball.r - paddle.h / 2 - 1;
    }

    if (game.mode === "playing" && !ball.stuck) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // walls
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
        audio.step();
      }
      if (ball.x + ball.r > w) {
        ball.x = w - ball.r;
        ball.vx = -Math.abs(ball.vx);
        audio.step();
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
        audio.step();
      }

      // paddle
      const py = paddle.y;
      if (
        ball.vy > 0 &&
        ball.y + ball.r >= py - paddle.h / 2 &&
        ball.y - ball.r <= py + paddle.h / 2 &&
        Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r
      ) {
        const rel = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
        const angle = -Math.PI / 2 + rel * 1.05;
        const speed = Math.min(760, Math.hypot(ball.vx, ball.vy) * 1.015);
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = py - paddle.h / 2 - ball.r - 0.5;
        audio.blip();
      }

      // bricks
      for (const b of game.bricks) {
        if (!b.alive) continue;
        const cx = clamp(ball.x, b.x, b.x + b.w);
        const cy = clamp(ball.y, b.y, b.y + b.h);
        if (Math.hypot(ball.x - cx, ball.y - cy) > ball.r) continue;

        b.alive = false;
        game.score += 10;
        if (game.score > game.best) game.best = game.score;
        paintHud();
        burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);
        audio.eat();
        game.flash = Math.min(1, game.flash + 0.18);

        const overlapX = Math.min(Math.abs(ball.x - b.x), Math.abs(ball.x - (b.x + b.w)));
        const overlapY = Math.min(Math.abs(ball.y - b.y), Math.abs(ball.y - (b.y + b.h)));
        if (overlapX < overlapY) {
          ball.vx = ball.x < b.x + b.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        } else {
          ball.vy = ball.y < b.y + b.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        }
        break;
      }

      if (ball.y - ball.r > h) loseLife();
      if (game.mode === "playing" && game.bricks.every((b) => !b.alive)) nextLevel();
    }

    // trail
    if (!ball.stuck && game.mode === "playing") {
      game.trail.push({ x: ball.x, y: ball.y });
      if (game.trail.length > 14) game.trail.shift();
    } else if (game.trail.length) {
      game.trail.shift();
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 0.99;
      p.life -= dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }

    game.flash = Math.max(0, game.flash - dt * 2);
    game.shake = Math.max(0, game.shake - dt * 3);
  }

  /* ---------- draw ---------- */
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h * 0.1, Math.max(w, h));
    bg.addColorStop(0, "rgba(38,28,42,0.55)");
    bg.addColorStop(0.5, "rgba(10,10,18,0.2)");
    bg.addColorStop(1, "rgba(4,5,10,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (game.shake > 0) {
      const s = game.shake * game.shake * 12;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // bricks
    for (const b of game.bricks) {
      if (!b.alive) continue;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.92;
      roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.22)";
      roundRect(b.x + 1, b.y + 1, b.w - 2, b.h * 0.35, 3);
      ctx.fill();
    }

    // particles
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // paddle
    ctx.save();
    ctx.shadowColor = "#ff9d6e";
    ctx.shadowBlur = 26;
    const grad = ctx.createLinearGradient(paddle.x - paddle.w / 2, 0, paddle.x + paddle.w / 2, 0);
    grad.addColorStop(0, "#ffb27a");
    grad.addColorStop(0.5, "#fff1dc");
    grad.addColorStop(1, "#ff8a5c");
    ctx.fillStyle = grad;
    roundRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h, paddle.h / 2);
    ctx.fill();
    ctx.restore();

    // ball trail
    for (let i = 0; i < game.trail.length; i++) {
      const t = game.trail[i];
      const k = (i + 1) / game.trail.length;
      ctx.globalAlpha = k * 0.32;
      ctx.fillStyle = "#ffd9b0";
      ctx.beginPath();
      ctx.arc(t.x, t.y, ball.r * k * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ball
    ctx.save();
    ctx.shadowColor = "#ffc890";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#fff6ea";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // level flash
    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.5;
      ctx.fillStyle = "#ffd9b0";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    if (ball.stuck && game.mode === "playing") {
      ctx.fillStyle = "rgba(244,239,230,0.45)";
      ctx.font = "500 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "4px";
      ctx.fillText("KLIK OF SPATIE", w / 2, h - 22);
    }
  }

  const stopLoop = loop((dt) => {
    update(dt);
    draw();
  });

  /* ---------- resize ---------- */
  const ro = new ResizeObserver(() => layout());
  ro.observe(root);

  return {
    restart: () => {
      modal?.close();
      modal = null;
      startRun();
    },
    destroy: () => {
      stopLoop();
      ro.disconnect();
      destroyCanvas();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
