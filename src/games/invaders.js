import { audio } from "../audio.js";
import { overlay, setupCanvas, loop, getBest, setBest, formatNumber, clamp } from "./util.js";

const ROWS = 4;
const COLS = 6;

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
    playerX: 0,
    bullets: [],
    bombs: [],
    aliens: [],
    stars: [],
    lives: 3,
    wave: 1,
    score: 0,
    best: getBest("invaders") ?? 0,
    dir: 1,
    stepTimer: 0,
    fireCooldown: 0,
    invuln: 0,
    shake: 0,
    time: 0,
    aimX: null,
  };

  bestNode.textContent = formatNumber(game.best);

  function paintHud() {
    scoreNode.textContent = formatNumber(game.score);
    bestNode.textContent = formatNumber(game.best);
    livesNode.textContent = String(game.lives);
    waveNode.textContent = String(game.wave);
  }

  function buildStars() {
    game.stars = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.2 + Math.random() * 0.8,
    }));
  }

  function buildWave() {
    game.aliens = [];
    const speedBase = 0.11 + (game.wave - 1) * 0.025;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        game.aliens.push({
          x: 0.12 + c * 0.13,
          y: 0.14 + r * 0.1,
          alive: true,
          kind: r === 0 ? "elite" : r < 2 ? "mid" : "grunt",
          w: 0.072 - r * 0.004,
        });
      }
    }
    game.dir = 1;
    game.stepTimer = 0;
    game.bullets = [];
    game.bombs = [];
    game.speedBase = speedBase;
    game.bombTimer = 1.4;
  }

  function reset() {
    game.lives = 3;
    game.wave = 1;
    game.score = 0;
    game.playerX = 0.5;
    game.invuln = 0;
    game.shake = 0;
    game.fireCooldown = 0;
    buildWave();
    paintHud();
  }

  buildStars();
  reset();
  game.mode = "ready";

  function aliensLeft() {
    return game.aliens.filter((a) => a.alive).length;
  }

  function hitPlayer() {
    if (game.invuln > 0 || game.mode !== "playing") return;
    game.lives -= 1;
    game.invuln = 1.8;
    game.shake = 1;
    audio.hit();
    paintHud();
    if (game.lives <= 0) endGame();
  }

  function endGame() {
    game.mode = "over";
    audio.miss();
    if (game.score > game.best) {
      game.best = game.score;
      setBest("invaders", game.best);
    }
    paintHud();
    modal = overlay(root, {
      kicker: "DE ZWERM HEEFT GEWONNEN",
      title: "Schip neergeschoten",
      text: `Je haalde <strong>${formatNumber(game.score)}</strong> punten in golf <strong>${game.wave}</strong>.`,
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

  function fire() {
    if (game.mode !== "playing" || game.fireCooldown > 0) return;
    game.fireCooldown = 0.26;
    game.bullets.push({ x: game.playerX, y: 0.84 });
    audio.tone({ freq: 880, to: 1400, dur: 0.07, type: "square", gain: 0.02 });
  }

  function stepAliens() {
    const alive = game.aliens.filter((a) => a.alive);
    if (!alive.length) {
      game.wave += 1;
      game.score += 120;
      audio.win();
      buildWave();
      paintHud();
      return;
    }

    const edge = 0.055;
    const minX = Math.min(...alive.map((a) => a.x - a.w / 2));
    const maxX = Math.max(...alive.map((a) => a.x + a.w / 2));
    const nextDir = minX + game.dir * 0.022 < edge || maxX + game.dir * 0.022 > 1 - edge ? -game.dir : game.dir;

    if (nextDir !== game.dir) {
      game.dir = nextDir;
      for (const a of alive) a.y += 0.045;
      const lowest = Math.max(...alive.map((a) => a.y));
      if (lowest > 0.76) {
        endGame();
        return;
      }
    } else {
      for (const a of alive) a.x += game.dir * 0.022;
    }

    // bombs
    const shooters = alive;
    if (shooters.length) {
      const shooter = shooters[Math.floor(Math.random() * shooters.length)];
      game.bombs.push({ x: shooter.x, y: shooter.y + 0.03 });
    }
  }

  function update(dt) {
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 2.2);
    game.fireCooldown = Math.max(0, game.fireCooldown - dt);

    for (const s of game.stars) {
      s.y += dt * 0.05 * s.z;
      if (s.y > 1) {
        s.y = 0;
        s.x = Math.random();
      }
    }

    if (game.mode !== "playing") return;

    if (game.invuln > 0) game.invuln = Math.max(0, game.invuln - dt);
    if (game.aimX !== null) {
      game.playerX = clamp(game.aimX, 0.06, 0.94);
    }

    // alien march
    const left = aliensLeft();
    const total = ROWS * COLS;
    const speed = game.speedBase + (1 - left / total) * 0.22;
    game.stepTimer += dt;
    const stepEvery = 0.62 / Math.max(0.35, speed);
    if (game.stepTimer >= stepEvery) {
      game.stepTimer -= stepEvery;
      stepAliens();
      if (game.mode !== "playing") return;
    }

    // player bullets
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      b.y -= dt * 0.95;
      if (b.y < 0.02) {
        game.bullets.splice(i, 1);
        continue;
      }
      for (const a of game.aliens) {
        if (!a.alive) continue;
        if (Math.abs(b.x - a.x) < a.w * 0.6 && Math.abs(b.y - a.y) < 0.05) {
          a.alive = false;
          game.bullets.splice(i, 1);
          game.score += a.kind === "elite" ? 30 : a.kind === "mid" ? 20 : 10;
          if (game.score > game.best) game.best = game.score;
          audio.eat();
          paintHud();
          break;
        }
      }
    }

    // alien bombs
    for (let i = game.bombs.length - 1; i >= 0; i--) {
      const b = game.bombs[i];
      b.y += dt * 0.55;
      if (b.y > 1) {
        game.bombs.splice(i, 1);
        continue;
      }
      if (Math.abs(b.x - game.playerX) < 0.045 && b.y > 0.82) {
        game.bombs.splice(i, 1);
        hitPlayer();
        if (game.mode !== "playing") return;
      }
    }

    // collision with player row
    for (const a of game.aliens) {
      if (!a.alive) continue;
      if (a.y > 0.8 && Math.abs(a.x - game.playerX) < 0.06) {
        hitPlayer();
        if (game.mode !== "playing") return;
      }
    }
  }

  function draw() {
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake * 12, (Math.random() - 0.5) * game.shake * 12);
    }

    // stars
    for (const s of game.stars) {
      ctx.globalAlpha = 0.25 + s.z * 0.55;
      ctx.fillStyle = "#cfe9ff";
      ctx.fillRect(s.x * w, s.y * h, s.z * 1.6, s.z * 1.6);
    }
    ctx.globalAlpha = 1;

    // alien grid
    for (const a of game.aliens) {
      if (!a.alive) continue;
      const size = a.w * w;
      const x = a.x * w - size / 2;
      const y = a.y * h;
      const color = a.kind === "elite" ? "#ff6f91" : a.kind === "mid" ? "#c9a7ff" : "#8ef5b0";

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(5,6,10,0.9)";
      ctx.lineWidth = Math.max(1.2, size * 0.06);

      // simple layered invader glyph
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.32);
      ctx.lineTo(x + size * 0.22, y + size * 0.32);
      ctx.lineTo(x + size * 0.32, y);
      ctx.lineTo(x + size * 0.68, y);
      ctx.lineTo(x + size * 0.78, y + size * 0.32);
      ctx.lineTo(x + size, y + size * 0.32);
      ctx.lineTo(x + size * 0.86, y + size * 0.66);
      ctx.lineTo(x + size * 0.14, y + size * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + size * 0.36, y + size * 0.22, size * 0.07, 0, Math.PI * 2);
      ctx.arc(x + size * 0.64, y + size * 0.22, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // bullets
    ctx.fillStyle = "#eafff5";
    ctx.shadowColor = "#8ef5b0";
    ctx.shadowBlur = 14;
    for (const b of game.bullets) {
      ctx.fillRect(b.x * w - 1.4, b.y * h - 11, 2.8, 14);
    }

    // bombs
    ctx.shadowColor = "#ff6f91";
    ctx.fillStyle = "#ff6f91";
    for (const b of game.bombs) {
      ctx.beginPath();
      ctx.arc(b.x * w, b.y * h, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ground line
    ctx.strokeStyle = "rgba(142,245,176,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.93);
    ctx.lineTo(w, h * 0.93);
    ctx.stroke();

    // player
    if (!(game.invuln > 0 && Math.floor(game.time * 12) % 2 === 0)) {
      const px = game.playerX * w;
      const py = h * 0.9;
      const s = Math.min(w, h) * 0.045;
      ctx.save();
      ctx.shadowColor = "#3dfcff";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#3dfcff";
      ctx.beginPath();
      ctx.moveTo(px, py - s);
      ctx.lineTo(px + s * 0.85, py + s * 0.55);
      ctx.lineTo(px, py + s * 0.2);
      ctx.lineTo(px - s * 0.85, py + s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
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

  const MOVE_KEYS = ["arrowleft", "arrowright", "a", "d", " "];
  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (MOVE_KEYS.includes(k)) event.preventDefault();

    if (game.mode === "playing") {
      if (k === "arrowleft" || k === "a") {
        game.aimX = null;
        game.playerX = clamp(game.playerX - 0.045, 0.06, 0.94);
      }
      if (k === "arrowright" || k === "d") {
        game.aimX = null;
        game.playerX = clamp(game.playerX + 0.045, 0.06, 0.94);
      }
      if (k === " ") fire();
      return;
    }
    if (k === " " || k === "enter") begin();
  };
  window.addEventListener("keydown", onKeyDown);

  let pointerDown = false;
  const onPointerDown = (event) => {
    if (game.mode !== "playing") return;
    pointerDown = true;
    const rect = root.getBoundingClientRect();
    game.aimX = (event.clientX - rect.left) / rect.width;
    fire();
  };
  const onPointerMove = (event) => {
    if (!pointerDown || game.mode !== "playing") return;
    const rect = root.getBoundingClientRect();
    game.aimX = (event.clientX - rect.left) / rect.width;
  };
  const onPointerUp = () => {
    pointerDown = false;
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);

  let modal = overlay(root, {
    kicker: "STAR SWARM",
    title: "Verdedig de laatste linie",
    text: "Beweeg met de pijltjes of je vinger en schiet met spatie. De zwerm wordt sneller zodra je er een paar neerhaalt.",
    extra: `<div class="ov-keys">
      <span class="kbd">← →</span><span class="kbd">SLEPEN</span><span class="kbd">SPATIE = SCHIETEN</span>
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
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
