import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber } from "./util.js";

const DURATION = 60;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value accent" data-time>60</span></div>
        <div class="hud-item"><span class="hud-label">Worpen</span><span class="hud-value" data-shots>0</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const timeNode = root.querySelector("[data-time]");
  const shotsNode = root.querySelector("[data-shots]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    ball: { x: 0.16, y: 0.82, vx: 0, vy: 0, live: false, spin: 0, angle: 0, age: 0 },
    hoop: { y: 0.38, dir: 1, x: 0.78, speed: 0.05 },
    drag: null,
    score: 0,
    best: getBest("hoop") ?? 0,
    shots: 0,
    hits: 0,
    timeLeft: DURATION,
    time: 0,
    cooldown: 0,
    flash: 0,
    trail: [],
    scored: false,
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    timeNode.textContent = String(Math.ceil(Math.max(0, game.timeLeft)));
    shotsNode.textContent = String(game.shots);
  }

  function resetBall() {
    game.ball.x = 0.16;
    game.ball.y = 0.82;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.ball.live = false;
    game.ball.spin = 0;
    game.ball.angle = 0;
    game.ball.age = 0;
    game.drag = null;
    game.trail = [];
    game.scored = false;
    game.cooldown = 0.2;
  }

  function reset() {
    game.score = 0;
    game.shots = 0;
    game.hits = 0;
    game.timeLeft = DURATION;
    game.flash = 0;
    game.hoop.y = 0.38;
    game.hoop.dir = 1;
    resetBall();
    paintHud();
  }

  reset();
  game.mode = "ready";

  function endGame() {
    game.mode = "over";
    const accuracy = game.shots ? Math.round((game.hits / game.shots) * 100) : 0;
    if (game.score > game.best) {
      game.best = game.score;
      setBest("hoop", game.best);
    }
    paintHud();
    audio.win();
    modal = overlay(root, {
      kicker: "TIJD IS OM",
      title: `${formatNumber(game.score)} punten`,
      text: `Je raakte <strong>${game.hits}</strong> van je <strong>${game.shots}</strong> worpen (${accuracy}%).`,
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

  function shoot(pointerX, pointerY) {
    if (game.ball.live || game.cooldown > 0) return;
    const w = state.width;
    const h = state.height;
    const bx = game.ball.x * w;
    const by = game.ball.y * h;
    const dx = bx - pointerX;
    const dy = by - pointerY;
    const power = Math.hypot(dx, dy);
    if (power < 18) return;

    // speed in pixels per second, scaled to the court so it plays the same on every screen
    const strength = Math.min(1, power / (h * 0.5));
    const speed = h * 1.55 * (0.6 + strength * 0.95);
    game.ball.vx = (dx / power) * speed;
    game.ball.vy = (dy / power) * speed;
    game.ball.live = true;
    game.ball.spin = game.ball.vx * 0.004;
    game.shots += 1;
    game.scored = false;
    game.trail = [];
    paintHud();
    audio.tone({ freq: 320, to: 520, dur: 0.08, type: "triangle", gain: 0.03 });
  }

  function hoopRect() {
    const w = state.width;
    const h = state.height;
    const rimW = w * 0.085;
    return {
      left: game.hoop.x * w - rimW / 2,
      right: game.hoop.x * w + rimW / 2,
      y: game.hoop.y * h,
      backX: game.hoop.x * w + rimW / 2,
    };
  }

  function update(dt) {
    game.time += dt;
    game.flash = Math.max(0, game.flash - dt * 2);
    game.cooldown = Math.max(0, game.cooldown - dt);

    // hoop drifts vertically
    game.hoop.y += game.hoop.dir * game.hoop.speed * dt;
    if (game.hoop.y > 0.55) {
      game.hoop.y = 0.55;
      game.hoop.dir = -1;
    }
    if (game.hoop.y < 0.3) {
      game.hoop.y = 0.3;
      game.hoop.dir = 1;
    }

    if (game.mode !== "playing") return;

    game.timeLeft -= dt;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      endGame();
      return;
    }

    if (!game.ball.live) {
      paintHud();
      return;
    }

    const w = state.width;
    const h = state.height;
    const ball = game.ball;
    const g = h * 1.55;

    // a shot that keeps bouncing for too long is brought back to the line
    ball.age += dt;
    if (ball.age > 3.2) {
      resetBall();
      return;
    }

    const prevY = ball.y * h;
    ball.vy += g * dt;
    ball.x += (ball.vx * dt) / w;
    ball.y += (ball.vy * dt) / h;
    ball.angle += ball.spin;

    game.trail.push({ x: ball.x, y: ball.y, life: 0.5 });
    if (game.trail.length > 26) game.trail.shift();
    for (const p of game.trail) p.life -= dt;

    const rect = hoopRect();
    const bx = ball.x * w;
    const by = ball.y * h;

    // score: ball centre passes down through the rim
    if (!game.scored && ball.vy > 0 && prevY <= rect.y && by >= rect.y) {
      if (bx > rect.left + 3 && bx < rect.right - 3) {
        game.scored = true;
        game.score += 3;
        game.hits += 1;
        game.flash = 1;
        if (game.score > game.best) game.best = game.score;
        audio.score();
        paintHud();
      }
    }

    // backboard bounce
    if (bx > rect.backX - 4 && bx < rect.backX + 10 && by > rect.y - h * 0.2 && by < rect.y + 6) {
      ball.x = (rect.backX - 6) / w;
      ball.vx = -Math.abs(ball.vx) * 0.55;
      audio.step();
    }

    // floor bounce
    if (ball.y > 0.93) {
      ball.y = 0.93;
      ball.vy = -Math.abs(ball.vy) * 0.42;
      ball.vx *= 0.82;
      if (Math.abs(ball.vy) < h * 0.08) {
        resetBall();
        return;
      }
    }

    // walls
    if (ball.x < 0.04) {
      ball.x = 0.04;
      ball.vx = Math.abs(ball.vx) * 0.6;
    }
    if (ball.x > 0.98) {
      ball.x = 0.98;
      ball.vx = -Math.abs(ball.vx) * 0.6;
    }
    if (ball.y < 0.04) {
      ball.y = 0.04;
      ball.vy = Math.abs(ball.vy) * 0.5;
    }

    if (game.scored && ball.y > 0.9) {
      resetBall();
    }

    paintHud();
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    // court backdrop
    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, "rgba(255,157,110,0.10)");
    sky.addColorStop(0.5, "rgba(255,61,154,0.06)");
    sky.addColorStop(1, "rgba(155,107,255,0.12)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // floor
    ctx.fillStyle = "rgba(255,157,110,0.14)";
    ctx.fillRect(0, h * 0.93, w, h * 0.07);
    ctx.strokeStyle = "rgba(255,157,110,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.93);
    ctx.lineTo(w, h * 0.93);
    ctx.stroke();

    const rect = hoopRect();
    const boardTop = rect.y - h * 0.2;
    const boardH = h * 0.15;

    // backboard
    ctx.fillStyle = "rgba(244,239,230,0.08)";
    ctx.strokeStyle = "rgba(244,239,230,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.backX + 6, boardTop, w * 0.018, boardH, 4);
    ctx.fill();
    ctx.stroke();

    // rim
    ctx.strokeStyle = "#ff9d3d";
    ctx.shadowColor = "#ff9d3d";
    ctx.shadowBlur = 24;
    ctx.lineWidth = Math.max(2.5, h * 0.008);
    ctx.beginPath();
    ctx.moveTo(rect.left, rect.y);
    ctx.lineTo(rect.right, rect.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // net
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    const netH = h * 0.08;
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(rect.left + (rect.right - rect.left) * t, rect.y);
      ctx.lineTo(rect.left + (rect.right - rect.left) * (0.5 + (t - 0.5) * 0.55), rect.y + netH);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(rect.left + (rect.right - rect.left) * 0.22, rect.y + netH * 0.55);
    ctx.lineTo(rect.right - (rect.right - rect.left) * 0.22, rect.y + netH * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rect.left + (rect.right - rect.left) * 0.3, rect.y + netH);
    ctx.lineTo(rect.right - (rect.right - rect.left) * 0.3, rect.y + netH);
    ctx.stroke();

    // trail
    for (const p of game.trail) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life / 0.5) * 0.35;
      ctx.fillStyle = "#ffb066";
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, h * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // aim
    if (game.drag && !game.ball.live) {
      const bx = game.ball.x * w;
      const by = game.ball.y * h;
      const dx = bx - game.drag.x;
      const dy = by - game.drag.y;
      const power = Math.min(1, Math.hypot(dx, dy) / (h * 0.5));

      ctx.strokeStyle = `rgba(61,252,255,${0.35 + power * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + dx * 0.9, by + dy * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(61,252,255,${0.4 + power * 0.6})`;
      ctx.fillRect(w * 0.06, h * 0.9, (w * 0.2) * power, 4);
    }

    // ball
    const ball = game.ball;
    const bx = ball.x * w;
    const by = ball.y * h;
    const r = h * 0.032;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ball.angle);
    ctx.shadowColor = "#ff9d3d";
    ctx.shadowBlur = 22;
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#ffd7a8");
    grad.addColorStop(0.55, "#ff9d3d");
    grad.addColorStop(1, "#a34700");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(60,20,0,0.55)";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    ctx.restore();

    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.12;
      ctx.fillStyle = "#8ef5b0";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    if (!game.ball.live && game.mode === "playing" && game.shots === 0) {
      ctx.fillStyle = "rgba(244,239,230,0.5)";
      ctx.font = `500 ${Math.max(9, h * 0.022)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("SLEEP VAN DE BAL NAAR LINKS EN LAAT LOS", w * 0.5, h * 0.12);
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
    if (game.mode !== "playing" || game.ball.live || game.cooldown > 0) return;
    const rect = root.getBoundingClientRect();
    game.drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerMove = (event) => {
    if (!game.drag) return;
    const rect = root.getBoundingClientRect();
    game.drag.x = event.clientX - rect.left;
    game.drag.y = event.clientY - rect.top;
  };

  const onPointerUp = (event) => {
    if (!game.drag) return;
    const rect = root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    game.drag = null;
    if (game.mode !== "playing") return;
    shoot(x, y);
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);

  let modal = overlay(root, {
    kicker: "HOOP SHOT",
    title: "Schiet de bal door de ring",
    text: "Sleep vanaf de bal naar linksonder en laat los om te schieten. Je hebt 60 seconden en de ring beweegt.",
    extra: `<div class="ov-keys"><span class="kbd">SLEPEN = RICHTEN</span><span class="kbd">LOSLATEN = SCHIETEN</span></div>`,
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
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
