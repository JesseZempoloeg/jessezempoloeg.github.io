import { audio } from "../audio.js";
import { overlay, getBest, setBest, setupCanvas, loop, clamp, formatClock } from "./util.js";

const WIN_SCORE = 7;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Jij</span><span class="hud-value accent" data-you>0</span></div>
        <div class="hud-item"><span class="hud-label">Computer</span><span class="hud-value" data-cpu>0</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value" data-time>0:00.00</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>—</span></div>
      </div>
    </div>`;

  const youNode = root.querySelector("[data-you]");
  const cpuNode = root.querySelector("[data-cpu]");
  const timeNode = root.querySelector("[data-time]");
  const bestNode = root.querySelector("[data-best]");

  const { canvas, ctx, state } = setupCanvas(root);

  let player = { x: 0, y: 0, vx: 0, vy: 0, r: 20 };
  let cpu = { x: 0, y: 0, vx: 0, vy: 0, r: 20 };
  let puck = { x: 0, y: 0, vx: 0, vy: 0, r: 14, trail: [] };
  let scoreYou = 0;
  let scoreCpu = 0;
  let playing = false;
  let over = false;
  let phase = "intro"; // intro | serve | play | over
  let serveTimer = 0;
  let serveDir = 1;
  let matchTime = 0;
  let modal = null;
  let best = getBest("hockey");
  let pointer = null;
  let lastHitAt = 0;

  const paintBest = () => {
    bestNode.textContent = best === null ? "—" : formatClock(best / 100);
  };
  paintBest();

  function table() {
    const pad = Math.min(state.width, state.height) * 0.045;
    // keep the scoreboard clear of the rink
    const topInset = Math.min(84, state.height * 0.13);
    const x = pad;
    const y = pad + topInset;
    const w = Math.max(120, state.width - pad * 2);
    const h = Math.max(120, state.height - y - pad);
    return {
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      goalHalf: w * 0.18,
      bottom: y + h,
      right: x + w,
    };
  }

  function sizes() {
    const t = table();
    const base = Math.min(t.w, t.h);
    return {
      puck: Math.max(7, base * 0.035),
      paddle: Math.max(12, base * 0.058),
    };
  }

  function layout() {
    const t = table();
    const s = sizes();
    puck.r = s.puck;
    player.r = s.paddle;
    cpu.r = s.paddle;
    if (!playing && serveTimer <= 0) {
      player.x = t.cx;
      player.y = t.y + t.h * 0.76;
      cpu.x = t.cx;
      cpu.y = t.y + t.h * 0.24;
      puck.x = t.cx;
      puck.y = t.cy;
    }
    player.y = clamp(player.y, t.y + t.h * 0.5, t.bottom - player.r);
    cpu.y = clamp(cpu.y, t.y + cpu.r, t.cy);
  }

  function serve(direction) {
    const t = table();
    const base = Math.min(t.w, t.h);
    puck.x = t.cx;
    puck.y = t.cy;
    // angled so the puck never flies straight into a goal
    puck.vx = (Math.random() < 0.5 ? -1 : 1) * base * 0.14;
    puck.vy = direction * base * 0.26;
    puck.trail = [];
    serveTimer = 0;
    playing = true;
    phase = "play";
  }

  function resetMatch() {
    modal?.close();
    modal = null;
    scoreYou = 0;
    scoreCpu = 0;
    matchTime = 0;
    over = false;
    playing = false;
    phase = "serve";
    serveTimer = 0.6;
    serveDir = 1;
    pointer = null;
    youNode.textContent = "0";
    cpuNode.textContent = "0";
    timeNode.textContent = "0:00.00";
    layout();
  }

  function scorePoint(who) {
    const t = table();
    if (who === "you") {
      scoreYou += 1;
      youNode.textContent = String(scoreYou);
      audio.score();
    } else {
      scoreCpu += 1;
      cpuNode.textContent = String(scoreCpu);
      audio.miss();
    }
    playing = false;
    phase = "serve";
    serveTimer = 0.8;
    // serve towards the player who conceded
    serveDir = who === "you" ? -1 : 1;
    puck.vx = 0;
    puck.vy = 0;
    puck.x = t.cx;
    puck.y = t.cy;
    puck.trail = [];

    if (scoreYou >= WIN_SCORE || scoreCpu >= WIN_SCORE) {
      finish();
    }
  }

  function finish() {
    over = true;
    playing = false;
    phase = "over";
    const won = scoreYou > scoreCpu;
    let record = false;
    if (won) {
      const centi = Math.round(matchTime * 100);
      record = best === null || centi < best;
      if (record) {
        best = centi;
        setBest("hockey", best);
        paintBest();
      }
      audio.win();
    } else {
      audio.hit();
    }

    modal = overlay(root, {
      kicker: won ? (record ? "NIEUW RECORD" : "GEWONNEN") : "VERLOREN",
      title: won ? `${scoreYou} – ${scoreCpu}` : `${scoreYou} – ${scoreCpu}`,
      text: won
        ? "Je hield de puck aan de andere kant. Speel nog een potje voor een snellere tijd."
        : "De computer was sneller. Dek de hoeken af en sla terug zodra je ruimte hebt.",
      extra: `<div class="ov-stat">
        <div><span>Tijd</span><span>${formatClock(matchTime)}</span></div>
        <div><span>Beste</span><span>${best === null ? "—" : formatClock(best / 100)}</span></div>
      </div>`,
      button: "OPNIEUW",
      onStart: resetMatch,
    });
  }

  /* ---------------- input ---------------- */

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function onMove(event) {
    pointer = localPoint(event);
  }

  function onLeave() {
    pointer = null;
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onMove);

  /* ---------------- physics ---------------- */

  function collidePaddle(paddle) {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const min = puck.r + paddle.r;
    if (dist > min || dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    // push the puck clear of the paddle so it doesn't get stuck dribbling
    const clearance = min + puck.r * 0.35;
    puck.x = paddle.x + nx * clearance;
    puck.y = paddle.y + ny * clearance;

    const rel = (puck.vx - paddle.vx) * nx + (puck.vy - paddle.vy) * ny;
    if (rel < 0) {
      puck.vx -= 1.85 * rel * nx;
      puck.vy -= 1.85 * rel * ny;
    }
    puck.vx += paddle.vx * 0.75;
    puck.vy += paddle.vy * 0.75;

    // the computer always tries to send the puck back towards your goal
    if (paddle === cpu) {
      const t = table();
      const push = Math.min(t.w, t.h) * 0.34;
      if (puck.vy < push) {
        puck.vy = push;
        puck.vx += (Math.random() - 0.5) * Math.min(t.w, t.h) * 0.3;
      }
    }

    const now = performance.now();
    if (now - lastHitAt > 70) {
      lastHitAt = now;
      audio.step();
    }
  }

  function step(dt) {
    const t = table();
    const s = sizes();
    const maxSpeed = Math.min(t.w, t.h) * 2.6;

    // player paddle follows the pointer smoothly
    const targetX = pointer ? clamp(pointer.x, t.x + s.paddle, t.right - s.paddle) : player.x;
    const targetY = pointer ? clamp(pointer.y, t.cy + s.paddle * 0.2, t.bottom - s.paddle) : player.y;
    const follow = Math.min(1, dt * 16);
    const nextX = player.x + (targetX - player.x) * follow;
    const nextY = player.y + (targetY - player.y) * follow;
    player.vx = (nextX - player.x) / Math.max(dt, 0.001);
    player.vy = (nextY - player.y) / Math.max(dt, 0.001);
    player.x = nextX;
    player.y = nextY;

    // computer paddle
    if (playing) {
      const wantY = puck.y < t.cy ? clamp(puck.y - s.paddle * 0.4, t.y + s.paddle, t.cy) : t.y + t.h * 0.24;
      const wantX = clamp(puck.x + puck.vx * 0.1, t.x + s.paddle, t.right - s.paddle);
      // slower than the puck, and a little quicker once the player is behind
      const speed = Math.min(t.w, t.h) * (0.4 + Math.min(0.26, scoreYou * 0.03));
      const ax = clamp(wantX - cpu.x, -speed * dt, speed * dt);
      const ay = clamp(wantY - cpu.y, -speed * dt, speed * dt);
      cpu.vx = ax / Math.max(dt, 0.001);
      cpu.vy = ay / Math.max(dt, 0.001);
      cpu.x = clamp(cpu.x + ax, t.x + s.paddle, t.right - s.paddle);
      cpu.y = clamp(cpu.y + ay, t.y + s.paddle, t.cy);
    } else {
      cpu.vx = 0;
      cpu.vy = 0;
    }

    if (!playing) return;

    // puck motion
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    puck.vx *= 1 - 0.55 * dt;
    puck.vy *= 1 - 0.55 * dt;

    const speed = Math.hypot(puck.vx, puck.vy);
    if (speed > maxSpeed) {
      puck.vx = (puck.vx / speed) * maxSpeed;
      puck.vy = (puck.vy / speed) * maxSpeed;
    } else {
      // never let the puck die in a corner
      const floor = Math.min(t.w, t.h) * 0.14;
      if (speed < floor) {
        const angle = speed > 0.5 ? Math.atan2(puck.vy, puck.vx) : Math.random() * Math.PI * 2;
        puck.vx = Math.cos(angle) * floor;
        puck.vy = Math.sin(angle) * floor;
      }
    }

    // side walls
    if (puck.x - puck.r < t.x) {
      puck.x = t.x + puck.r;
      puck.vx = Math.abs(puck.vx) * 0.92;
      audio.step();
    } else if (puck.x + puck.r > t.right) {
      puck.x = t.right - puck.r;
      puck.vx = -Math.abs(puck.vx) * 0.92;
      audio.step();
    }

    const inGoalMouth = Math.abs(puck.x - t.cx) < t.goalHalf - puck.r * 0.4;

    // top goal (computer defends, player scores)
    if (puck.y - puck.r < t.y) {
      if (inGoalMouth) {
        puck.y = t.y - puck.r;
        scorePoint("you");
        return;
      }
      puck.y = t.y + puck.r;
      puck.vy = Math.abs(puck.vy) * 0.92;
      audio.step();
    }

    // bottom goal (player defends)
    if (puck.y + puck.r > t.bottom) {
      if (inGoalMouth) {
        puck.y = t.bottom + puck.r;
        scorePoint("cpu");
        return;
      }
      puck.y = t.bottom - puck.r;
      puck.vy = -Math.abs(puck.vy) * 0.92;
      audio.step();
    }

    collidePaddle(player);
    collidePaddle(cpu);

    puck.trail.push({ x: puck.x, y: puck.y });
    if (puck.trail.length > 10) puck.trail.shift();
  }

  /* ---------------- draw ---------------- */

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawTarget() {
    const t = table();
    const line = Math.min(t.w, t.h) * 0.004 + 1;

    ctx.save();
    ctx.strokeStyle = "rgba(143,216,255,0.16)";
    ctx.lineWidth = line;
    roundRect(t.x, t.y, t.w, t.h, 16);
    ctx.stroke();

    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = "rgba(244,239,230,0.14)";
    ctx.beginPath();
    ctx.moveTo(t.x, t.cy);
    ctx.lineTo(t.right, t.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(t.cx, t.cy, Math.min(t.w, t.h) * 0.14, 0, Math.PI * 2);
    ctx.stroke();

    // goal mouths
    ctx.lineWidth = line * 2.2;
    ctx.strokeStyle = "rgba(244,239,230,0.75)";
    ctx.beginPath();
    ctx.moveTo(t.cx - t.goalHalf, t.y);
    ctx.lineTo(t.cx + t.goalHalf, t.y);
    ctx.moveTo(t.cx - t.goalHalf, t.bottom);
    ctx.lineTo(t.cx + t.goalHalf, t.bottom);
    ctx.stroke();

    ctx.lineWidth = line;
    ctx.strokeStyle = "rgba(255,111,145,0.55)";
    ctx.beginPath();
    ctx.moveTo(t.cx - t.goalHalf, t.y);
    ctx.lineTo(t.cx - t.goalHalf, t.y + 9);
    ctx.moveTo(t.cx + t.goalHalf, t.y);
    ctx.lineTo(t.cx + t.goalHalf, t.y + 9);
    ctx.stroke();

    ctx.strokeStyle = "rgba(143,216,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(t.cx - t.goalHalf, t.bottom);
    ctx.lineTo(t.cx - t.goalHalf, t.bottom - 9);
    ctx.moveTo(t.cx + t.goalHalf, t.bottom);
    ctx.lineTo(t.cx + t.goalHalf, t.bottom - 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawPaddle(paddle, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(10,14,24,0.9)";
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    drawTarget();

    puck.trail.forEach((point, index) => {
      const ratio = index / Math.max(1, puck.trail.length);
      ctx.fillStyle = `rgba(244,239,230,${(ratio * 0.14).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, puck.r * (0.3 + ratio * 0.55), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.save();
    ctx.shadowColor = "#f4efe6";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPaddle(player, "#8fd8ff");
    drawPaddle(cpu, "#ff6f91");
  }

  const stop = loop((dt) => {
    if (phase === "serve") {
      serveTimer -= dt;
      if (serveTimer <= 0) serve(serveDir);
    } else if (phase === "play") {
      matchTime += dt;
    }

    const steps = 2;
    for (let i = 0; i < steps; i++) step(dt / steps);

    if (phase === "play") timeNode.textContent = formatClock(matchTime);
    draw();
  });

  layout();
  modal = overlay(root, {
    kicker: "NEON HOCKEY",
    title: "Eerste bij zeven",
    text: "Beweeg met je muis of vinger over je helft. Sla de puck in de bovenste goal en houd je eigen doel dicht.",
    extra: `<div class="ov-keys"><span class="kbd">MUIS</span><span class="kbd">VINGER</span></div>`,
    button: "BEGIN",
    onStart: () => {
      modal = null;
      resetMatch();
      audio.blip();
    },
  });

  return {
    restart: () => {
      over = false;
      resetMatch();
      audio.blip();
    },
    destroy: () => {
      stop();
      modal?.close();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onMove);
    },
  };
}
