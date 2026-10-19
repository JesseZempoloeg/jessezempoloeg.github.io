import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber, clamp } from "./util.js";

const TURN = 3.6;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Levens</span><span class="hud-value accent" data-lives>3</span></div>
        <div class="hud-item"><span class="hud-label">Golf</span><span class="hud-value" data-wave>1</span></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const livesNode = root.querySelector("[data-lives]");
  const waveNode = root.querySelector("[data-wave]");

  const { ctx, state, destroy: destroyCanvas } = setupCanvas(root);

  const game = {
    mode: "ready",
    ship: { x: 0.5, y: 0.55, vx: 0, vy: 0, angle: -Math.PI / 2 },
    bullets: [],
    rocks: [],
    particles: [],
    lives: 3,
    wave: 1,
    score: 0,
    best: getBest("shards") ?? 0,
    cooldown: 0,
    invuln: 0,
    time: 0,
    respawn: 0,
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    livesNode.textContent = String(game.lives);
    waveNode.textContent = String(game.wave);
  }

  function aspect() {
    return state.width / Math.max(1, state.height);
  }

  function spawnRock(size, x, y, vx, vy) {
    const speed = 0.1 + Math.random() * 0.16;
    const a = Math.random() * Math.PI * 2;
    const verts = [];
    const points = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < points; i++) {
      verts.push(0.68 + Math.random() * 0.42);
    }
    game.rocks.push({
      x: x ?? Math.random(),
      y: y ?? Math.random(),
      vx: vx ?? Math.cos(a) * speed,
      vy: vy ?? Math.sin(a) * speed,
      size,
      r: size,
      verts,
      spin: (Math.random() - 0.5) * 1.6,
      angle: Math.random() * Math.PI * 2,
    });
  }

  function buildWave() {
    game.rocks = [];
    const count = 3 + game.wave;
    for (let i = 0; i < count; i++) spawnRock(0.075);
  }

  function reset() {
    game.ship = { x: 0.5, y: 0.55, vx: 0, vy: 0, angle: -Math.PI / 2 };
    game.bullets = [];
    game.particles = [];
    game.lives = 3;
    game.wave = 1;
    game.score = 0;
    game.cooldown = 0;
    game.invuln = 2;
    game.respawn = 0;
    buildWave();
    paintHud();
  }

  reset();
  game.mode = "ready";

  function burst(x, y, color, count = 14, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.08 + Math.random() * 0.3) * power;
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.5,
        max: 0.85,
        color,
      });
    }
  }

  function shoot() {
    if (game.mode !== "playing" || game.cooldown > 0 || game.respawn > 0) return;
    if (game.bullets.length >= 5) return;
    game.cooldown = 0.17;
    const ship = game.ship;
    game.bullets.push({
      x: ship.x + Math.cos(ship.angle) * 0.035,
      y: ship.y + Math.sin(ship.angle) * 0.035,
      vx: Math.cos(ship.angle) * 1.15 + ship.vx * 0.4,
      vy: Math.sin(ship.angle) * 1.15 + ship.vy * 0.4,
      life: 1.1,
    });
    audio.tone({ freq: 940, to: 460, dur: 0.09, type: "square", gain: 0.025 });
  }

  function crash() {
    if (game.invuln > 0 || game.respawn > 0) return;
    game.lives -= 1;
    burst(game.ship.x, game.ship.y, "#6fe6ff", 26, 1.4);
    audio.hit();
    paintHud();
    if (game.lives <= 0) {
      endGame();
      return;
    }
    game.respawn = 1.6;
    game.invuln = 2.4;
  }

  function endGame() {
    game.mode = "over";
    audio.miss();
    if (game.score > game.best) {
      game.best = game.score;
      setBest("shards", game.best);
    }
    paintHud();
    modal = overlay(root, {
      kicker: "SCHIP VERLOREN",
      title: "De shards waren sneller",
      text: `Je verpulverde <strong>${formatNumber(game.score)}</strong> punten aan brokstukken.`,
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

  function split(rock) {
    const nextSize = rock.size * 0.58;
    const pieces = rock.size > 0.04 ? 2 : 0;
    for (let i = 0; i < pieces; i++) {
      const a = Math.random() * Math.PI * 2;
      spawnRock(nextSize, rock.x, rock.y, Math.cos(a) * 0.19, Math.sin(a) * 0.19);
    }
    game.score += Math.round(180 * (0.075 / Math.max(0.03, rock.size)));
    if (game.score > game.best) game.best = game.score;
    burst(rock.x, rock.y, "#d7c4ff", 16, 1.1);
    audio.eat();
    paintHud();
  }

  function update(dt) {
    game.time += dt;
    game.cooldown = Math.max(0, game.cooldown - dt);
    game.invuln = Math.max(0, game.invuln - dt);

    for (const p of game.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt;
    }
    game.particles = game.particles.filter((p) => p.life > 0);

    if (game.mode !== "playing") return;

    if (game.respawn > 0) {
      game.respawn = Math.max(0, game.respawn - dt);
      if (game.respawn === 0) {
        game.ship.x = 0.5;
        game.ship.y = 0.55;
        game.ship.vx = 0;
        game.ship.vy = 0;
      }
    }

    const ship = game.ship;
    if (keys.left) ship.angle -= TURN * dt;
    if (keys.right) ship.angle += TURN * dt;
    if (keys.thrust && game.respawn === 0) {
      ship.vx += Math.cos(ship.angle) * 0.75 * dt;
      ship.vy += Math.sin(ship.angle) * 0.75 * dt;
    }

    const damp = Math.pow(0.72, dt);
    ship.vx *= damp;
    ship.vy *= damp;

    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 0.85) {
      ship.vx = (ship.vx / speed) * 0.85;
      ship.vy = (ship.vy / speed) * 0.85;
    }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    const asp = aspect();
    if (ship.x < -0.02) ship.x += 1.04;
    if (ship.x > 1.02) ship.x -= 1.04;
    if (ship.y < -0.02) ship.y += 1.04;
    if (ship.y > 1.02) ship.y -= 1.04;

    // bullets
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let hit = false;

      for (let j = game.rocks.length - 1; j >= 0; j--) {
        const rock = game.rocks[j];
        const dx = (b.x - rock.x) * asp;
        const dy = b.y - rock.y;
        if (Math.hypot(dx, dy) < rock.size + 0.012) {
          game.rocks.splice(j, 1);
          split(rock);
          hit = true;
          break;
        }
      }

      if (hit || b.life <= 0) game.bullets.splice(i, 1);
    }

    // rocks
    for (const rock of game.rocks) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.angle += rock.spin * dt;

      if (rock.x < -0.05) rock.x += 1.1;
      if (rock.x > 1.05) rock.x -= 1.1;
      if (rock.y < -0.05) rock.y += 1.1;
      if (rock.y > 1.05) rock.y -= 1.1;

      if (game.respawn === 0 && game.invuln <= 0) {
        const dx = (ship.x - rock.x) * asp;
        const dy = ship.y - rock.y;
        if (Math.hypot(dx, dy) < rock.size + 0.022) {
          crash();
          if (game.mode !== "playing") return;
        }
      }
    }

    if (!game.rocks.length) {
      game.wave += 1;
      game.score += 100;
      audio.win();
      buildWave();
      paintHud();
    }
  }

  function drawShip(x, y, angle) {
    const unit = Math.min(state.width, state.height);
    const s = unit * 0.028;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (keys.thrust && game.respawn === 0) {
      ctx.fillStyle = "rgba(255,157,110,0.9)";
      ctx.shadowColor = "#ff9d6e";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.4);
      ctx.lineTo(-s * (1.2 + Math.random() * 0.5), 0);
      ctx.lineTo(-s * 0.6, s * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.shadowColor = "#6fe6ff";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#dff6ff";
    ctx.beginPath();
    ctx.moveTo(s * 1.25, 0);
    ctx.lineTo(-s * 0.8, -s * 0.75);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.8, s * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    const unit = Math.min(w, h);

    ctx.clearRect(0, 0, w, h);

    // dust
    ctx.strokeStyle = "rgba(155,107,255,0.10)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const r = unit * (0.12 + i * 0.11) * (w / Math.max(w, h));
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, r * 1.3, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // particles
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // rocks
    for (const rock of game.rocks) {
      const cx = rock.x * w;
      const cy = rock.y * h;
      const r = rock.size * h;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rock.angle);
      ctx.strokeStyle = "#c9a7ff";
      ctx.fillStyle = "rgba(120,86,200,0.18)";
      ctx.shadowColor = "#9b6bff";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      rock.verts.forEach((v, i) => {
        const a = (i / rock.verts.length) * Math.PI * 2;
        const px = Math.cos(a) * r * v;
        const py = Math.sin(a) * r * v;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // bullets
    ctx.fillStyle = "#eaffff";
    ctx.shadowColor = "#6fe6ff";
    ctx.shadowBlur = 14;
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.arc(b.x * w, b.y * h, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ship
    if (game.respawn === 0) {
      if (!(game.invuln > 0 && Math.floor(game.time * 10) % 2 === 0)) {
        drawShip(game.ship.x * w, game.ship.y * h, game.ship.angle);
      }
    }

  }

  /* ---------- input ---------- */
  const keys = { left: false, right: false, thrust: false };

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

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w"].includes(k)) event.preventDefault();

    if (game.mode !== "playing") {
      if (k === " " || k === "enter") begin();
      return;
    }
    if (k === "arrowleft" || k === "a") keys.left = true;
    if (k === "arrowright" || k === "d") keys.right = true;
    if (k === "arrowup" || k === "w") keys.thrust = true;
    if (k === " ") shoot();
  };

  const onKeyUp = (event) => {
    const k = event.key.toLowerCase();
    if (k === "arrowleft" || k === "a") keys.left = false;
    if (k === "arrowright" || k === "d") keys.right = false;
    if (k === "arrowup" || k === "w") keys.thrust = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // touch: left half steers, right half thrusts, tap shoots
  const touches = new Map();
  let lastShoot = 0;

  const onPointerDown = (event) => {
    if (game.mode !== "playing") return;
    const rect = root.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    touches.set(event.pointerId, x);
    if (x < 0.3) keys.left = true;
    else if (x > 0.7) keys.right = true;
    else keys.thrust = true;

    const now = performance.now();
    if (now - lastShoot > 180) {
      lastShoot = now;
      shoot();
    }
  };

  const releasePointer = (event) => {
    touches.delete(event.pointerId);
    if (!touches.size) {
      keys.left = false;
      keys.right = false;
      keys.thrust = false;
      return;
    }
    keys.left = [...touches.values()].some((v) => v < 0.3);
    keys.right = [...touches.values()].some((v) => v > 0.7);
    keys.thrust = !keys.left && !keys.right;
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", releasePointer);
  root.addEventListener("pointercancel", releasePointer);

  let modal = overlay(root, {
    kicker: "SHARD STORM",
    title: "Breek alles tot stof",
    text: "Draai met links en rechts, stuw met pijltje omhoog en schiet met spatie. Grote brokken splitsen in kleinere.",
    extra: `<div class="ov-keys">
      <span class="kbd">← →</span><span class="kbd">↑ = STUWEN</span><span class="kbd">SPATIE = SCHIETEN</span>
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
      window.removeEventListener("keyup", onKeyUp);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", releasePointer);
      root.removeEventListener("pointercancel", releasePointer);
    },
  };
}
