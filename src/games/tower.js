import { audio } from "../audio.js";
import { overlay, getBest, setBest, setupCanvas, loop, clamp } from "./util.js";

const TOWER_COST = 35;
const UPGRADE_COST = 30;
const START_GOLD = 70;
const START_LIVES = 12;

/* Path in normalized 0..1 coordinates. */
const PATH = [
  [-0.06, 0.18],
  [0.22, 0.18],
  [0.22, 0.5],
  [0.5, 0.5],
  [0.5, 0.82],
  [0.78, 0.82],
  [0.78, 0.32],
  [1.06, 0.32],
];

const SPOTS = [
  [0.08, 0.36],
  [0.36, 0.32],
  [0.12, 0.68],
  [0.36, 0.68],
  [0.64, 0.36],
  [0.66, 0.68],
  [0.9, 0.55],
  [0.9, 0.12],
];

const LEVELS = [
  { range: 0.26, damage: 11, cooldown: 0.55 },
  { range: 0.3, damage: 18, cooldown: 0.46 },
  { range: 0.34, damage: 29, cooldown: 0.36 },
];

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Golf</span><span class="hud-value" data-wave>0</span></div>
        <div class="hud-item"><span class="hud-label">Levens</span><span class="hud-value accent" data-lives>${START_LIVES}</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Munten</span><span class="hud-value" data-gold>${START_GOLD}</span></div>
      </div>
    </div>`;

  const waveNode = root.querySelector("[data-wave]");
  const livesNode = root.querySelector("[data-lives]");
  const goldNode = root.querySelector("[data-gold]");

  const { canvas, ctx, state } = setupCanvas(root);

  let towers = [];
  let enemies = [];
  let bullets = [];
  let particles = [];
  let wave = 0;
  let lives = START_LIVES;
  let gold = START_GOLD;
  let spawnQueue = [];
  let spawnTimer = 0;
  let breakTimer = 0; // pause between waves
  let running = false;
  let over = false;
  let modal = null;
  let hoverSpot = null;
  let selected = null;
  let hoverSpotIndex = null;
  let time = 0;
  let best = getBest("tower") ?? 0;

  /* ---------------- geometry ---------------- */

  function toPx([nx, ny]) {
    return { x: nx * state.width, y: ny * state.height };
  }

  function pathPoints() {
    return PATH.map(toPx);
  }

  function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  }

  function pointAt(points, t) {
    const total = pathLength(points);
    let target = clamp(t, 0, 1) * total;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (target <= seg || i === points.length - 1) {
        const k = seg === 0 ? 0 : clamp(target / seg, 0, 1);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      target -= seg;
    }
    return points[points.length - 1];
  }

  const unit = () => Math.min(state.width, state.height);

  /* ---------------- game state ---------------- */

  function reset() {
    modal?.close();
    modal = null;
    towers = [];
    enemies = [];
    bullets = [];
    particles = [];
    spawnQueue = [];
    spawnTimer = 0;
    breakTimer = 2;
    wave = 0;
    lives = START_LIVES;
    gold = START_GOLD;
    running = true;
    over = false;
    selected = null;
    time = 0;
    paint();
    startWave();
  }

  function paint() {
    waveNode.textContent = String(wave);
    livesNode.textContent = String(Math.max(0, lives));
    goldNode.textContent = String(gold);
  }

  function startWave() {
    wave += 1;
    paint();
    const count = Math.min(26, 4 + wave * 2);
    const hp = 26 * (1 + wave * 0.4);
    const speed = Math.min(230, 80 + wave * 7);
    spawnQueue = [];
    for (let i = 0; i < count; i++) {
      const boss = wave % 5 === 0 && i === count - 1;
      spawnQueue.push({
        hp: boss ? hp * 3.4 : hp,
        maxHp: boss ? hp * 3.4 : hp,
        speed: boss ? speed * 0.62 : speed,
        reward: boss ? 26 + wave : 8 + Math.round(wave * 0.9),
        boss,
      });
    }
    spawnTimer = 0.4;
    if (wave > best) {
      best = wave;
      setBest("tower", wave);
    }
  }

  function spawn(spec) {
    enemies.push({
      t: 0,
      hp: spec.hp,
      maxHp: spec.maxHp,
      speed: spec.speed,
      reward: spec.reward,
      boss: spec.boss,
      hurt: 0,
    });
  }

  function shot(from, target, damage) {
    bullets.push({ x: from.x, y: from.y, target, damage, speed: unit() * 1.1 });
  }

  function burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, max: 0.45, color });
    }
  }

  function leak(enemy) {
    lives -= enemy.boss ? 3 : 1;
    audio.miss();
    paint();
    if (lives <= 0) {
      lives = 0;
      gameOver();
    }
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    audio.hit();
    modal = overlay(root, {
      kicker: "DOORGEBROKEN",
      title: `Golf ${wave} was te veel`,
      text: "De vijand liep door je verdediging. Bouw dichter bij de route en houd munten over voor een tweede toren.",
      extra: `<div class="ov-stat">
        <div><span>Golven</span><span>${Math.max(0, wave - 1)}</span></div>
        <div><span>Beste</span><span>${best}</span></div>
      </div>`,
      button: "OPNIEUW",
      onStart: reset,
    });
  }

  /* ---------------- input ---------------- */

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function spotAt(point) {
    let bestIndex = null;
    let bestDist = Infinity;
    SPOTS.forEach((spot, index) => {
      const p = toPx(spot);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < unit() * 0.055 && d < bestDist) {
        bestDist = d;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function onClick(event) {
    if (!running || over) return;
    const point = localPoint(event);
    const index = spotAt(point);
    if (index === null) {
      selected = null;
      return;
    }
    const existing = towers.find((tower) => tower.index === index);
    if (existing) {
      const cost = UPGRADE_COST * existing.level;
      if (existing.level < LEVELS.length && gold >= cost) {
        gold -= cost;
        existing.level += 1;
        audio.score();
        paint();
      } else {
        selected = selected === index ? null : index;
      }
      return;
    }
    if (gold < TOWER_COST) {
      audio.miss();
      return;
    }
    gold -= TOWER_COST;
    towers.push({ index, level: 1, angle: -Math.PI / 2, cooldown: 0, shots: 0 });
    selected = null;
    audio.blip();
    paint();
  }

  function onMove(event) {
    const point = localPoint(event);
    hoverSpot = point;
    hoverSpotIndex = spotAt(point);
  }

  function onLeave() {
    hoverSpot = null;
    hoverSpotIndex = null;
  }

  canvas.addEventListener("pointerdown", onClick);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);

  /* ---------------- update ---------------- */

  function update(dt) {
    time += dt;
    if (!running) return;

    if (breakTimer > 0) {
      breakTimer -= dt;
    } else if (spawnQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn(spawnQueue.shift());
        spawnTimer = Math.max(0.28, 0.85 - wave * 0.03);
      }
    } else if (!enemies.length) {
      // wave cleared
      const bonus = 18 + wave * 5;
      gold += bonus;
      audio.win();
      paint();
      breakTimer = 3.4;
      startWave();
    }

    const points = pathPoints();

    for (const enemy of enemies) {
      const total = pathLength(points);
      enemy.t += (enemy.speed * dt) / total;
      enemy.hurt = Math.max(0, enemy.hurt - dt * 3);
      if (enemy.t >= 1) {
        const pos = pointAt(points, 1);
        burst(pos.x, pos.y, "#ff6f91", 10);
        leak(enemy);
        enemy.dead = true;
      }
    }
    enemies = enemies.filter((enemy) => !enemy.dead);

    for (const tower of towers) {
      const spot = toPx(SPOTS[tower.index]);
      const stats = LEVELS[tower.level - 1];
      const range = stats.range * unit();
      tower.cooldown -= dt;

      let target = null;
      let bestProgress = -1;
      for (const enemy of enemies) {
        const pos = pointAt(points, enemy.t);
        if (Math.hypot(pos.x - spot.x, pos.y - spot.y) > range) continue;
        if (enemy.t > bestProgress) {
          bestProgress = enemy.t;
          target = enemy;
        }
      }

      if (target) {
        const pos = pointAt(points, target.t);
        const wanted = Math.atan2(pos.y - spot.y, pos.x - spot.x);
        let diff = wanted - tower.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        tower.angle += clamp(diff, -dt * 7, dt * 7);
        if (tower.cooldown <= 0) {
          tower.cooldown = stats.cooldown;
          tower.shots += 1;
          shot(spot, target, stats.damage);
          audio.step();
        }
      }
    }

    for (const bullet of bullets) {
      if (bullet.target.dead) {
        bullet.dead = true;
        continue;
      }
      const pos = pointAt(points, bullet.target.t);
      const dx = pos.x - bullet.x;
      const dy = pos.y - bullet.y;
      const dist = Math.hypot(dx, dy);
      const step = bullet.speed * dt;
      if (dist <= step || dist < 6) {
        bullet.target.hp -= bullet.damage;
        bullet.target.hurt = 1;
        bullet.dead = true;
        burst(pos.x, pos.y, "#8fd8ff", 3);
        if (bullet.target.hp <= 0 && !bullet.target.dead) {
          bullet.target.dead = true;
          gold += bullet.target.reward;
          audio.score();
          burst(pos.x, pos.y, bullet.target.boss ? "#ffd166" : "#8ef5b0", bullet.target.boss ? 18 : 8);
          paint();
        }
        continue;
      }
      bullet.x += (dx / dist) * step;
      bullet.y += (dy / dist) * step;
    }
    bullets = bullets.filter((bullet) => !bullet.dead);
    enemies = enemies.filter((enemy) => !enemy.dead);

    for (const particle of particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
    }
    particles = particles.filter((particle) => particle.life > 0);
  }

  /* ---------------- draw ---------------- */

  function drawPath(points) {
    const width = unit() * 0.075;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.strokeStyle = "rgba(143,216,255,0.08)";
    ctx.lineWidth = width * 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(10,14,24,0.92)";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    ctx.setLineDash([unit() * 0.012, unit() * 0.02]);
    ctx.strokeStyle = "rgba(143,216,255,0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpotMarkers() {
    const radius = unit() * 0.026;
    SPOTS.forEach((spot, index) => {
      const p = toPx(spot);
      const tower = towers.find((t) => t.index === index);
      if (tower) return;
      const hovered = hoverSpotIndex === index;
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = hovered ? "rgba(143,216,255,0.85)" : "rgba(244,239,230,0.24)";
      ctx.lineWidth = hovered ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = hovered ? "rgba(143,216,255,0.9)" : "rgba(244,239,230,0.35)";
      ctx.font = `${Math.round(unit() * 0.022)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", p.x, p.y + 1);
    });
  }

  function drawTowers() {
    for (const tower of towers) {
      const p = toPx(SPOTS[tower.index]);
      const stats = LEVELS[tower.level - 1];
      const range = stats.range * unit();
      const r = unit() * 0.028;

      const showRange = hoverSpotIndex === tower.index || selected === tower.index;
      if (showRange) {
        ctx.save();
        ctx.fillStyle = "rgba(143,216,255,0.06)";
        ctx.strokeStyle = "rgba(143,216,255,0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "rgba(143,216,255,0.14)";
      ctx.strokeStyle = "rgba(143,216,255,0.7)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.rotate(tower.angle);
      ctx.fillStyle = tower.level === 3 ? "#ffd166" : "#8fd8ff";
      ctx.beginPath();
      ctx.moveTo(r * 0.2, -r * 0.42);
      ctx.lineTo(r * 1.15, 0);
      ctx.lineTo(r * 0.2, r * 0.42);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < tower.level; i++) {
        ctx.fillStyle = "rgba(244,239,230,0.85)";
        ctx.beginPath();
        ctx.arc(-r * 0.5, (i - (tower.level - 1) / 2) * r * 0.42, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEnemies(points) {
    for (const enemy of enemies) {
      const p = pointAt(points, enemy.t);
      const r = unit() * (enemy.boss ? 0.028 : 0.019);
      ctx.save();
      ctx.fillStyle = enemy.hurt > 0.4 ? "#ffffff" : enemy.boss ? "#ffd166" : "#ff6f91";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const w = r * 2.4;
      const h = Math.max(2, r * 0.32);
      const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      ctx.fillStyle = "rgba(4,5,10,0.7)";
      ctx.fillRect(p.x - w / 2, p.y - r - h - 4, w, h);
      ctx.fillStyle = ratio > 0.5 ? "#8ef5b0" : ratio > 0.25 ? "#ffe14d" : "#ff6f91";
      ctx.fillRect(p.x - w / 2, p.y - r - h - 4, w * ratio, h);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    const points = pathPoints();
    drawPath(points);
    drawSpotMarkers();
    drawTowers();
    drawEnemies(points);

    for (const bullet of bullets) {
      ctx.fillStyle = "#e8fbff";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, unit() * 0.006 + 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (hoverSpot && hoverSpotIndex !== null && !towers.some((t) => t.index === hoverSpotIndex) && running) {
      const p = toPx(SPOTS[hoverSpotIndex]);
      const affordable = gold >= TOWER_COST;
      ctx.fillStyle = affordable ? "rgba(143,216,255,0.9)" : "rgba(255,107,145,0.9)";
      ctx.font = `${Math.round(unit() * 0.026)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${TOWER_COST} munten`, p.x, p.y - unit() * 0.045);
    }

    if (breakTimer > 0 && running && wave > 0) {
      ctx.fillStyle = "rgba(244,239,230,0.55)";
      ctx.font = `${Math.round(unit() * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`Golf ${wave} komt eraan`, state.width / 2, state.height * 0.94);
    }
  }

  const stop = loop((dt) => {
    update(dt);
    draw();
  });

  running = false;
  breakTimer = 0;
  paint();
  modal = overlay(root, {
    kicker: "TORENWACHT",
    title: "Houd de route vrij",
    text: "Klik op een plus om een toren te bouwen (35 munten). Klik op een bestaande toren om hem te upgraden. Vijanden die doorbreken kosten een leven.",
    extra: `<div class="ov-keys"><span class="kbd">KLIK = BOUWEN</span><span class="kbd">KLIK = UPGRADEN</span></div>`,
    button: "BEGIN",
    onStart: () => {
      modal = null;
      reset();
    },
  });

  return {
    restart: () => {
      reset();
      audio.blip();
    },
    destroy: () => {
      stop();
      modal?.close();
      canvas.removeEventListener("pointerdown", onClick);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    },
  };
}
