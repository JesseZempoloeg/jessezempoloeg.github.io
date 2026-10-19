import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { overlay, getBest, setBest, loop } from "./util.js";

const BEST_KEY = "planet";
const PLANET_R = 4;
const SPAWN_R = 34;
const CAM_Z = 22;
const MAX_HP = 5;
const UP = new THREE.Vector3(0, 1, 0);
const METEOR_COLORS = [0xff7a3d, 0xff3d9a, 0xffe14d];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Schild</span><span class="hud-value" data-hp></span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end">
        <span class="hud-label" data-best>Beste: —</span>
      </div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">MUIS / PIJLEN: RICHTEN · SPATIE / KLIK: VUREN</p>`;

  const scoreNode = root.querySelector("[data-score]");
  const hpNode = root.querySelector("[data-hp]");
  const bestNode = root.querySelector("[data-best]");

  /* ---------- three.js scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03030a);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(0, 7, CAM_Z);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x6070ff, 0.5));
  const sun = new THREE.PointLight(0x3dfcff, 160, 0, 2);
  sun.position.set(-12, 9, 14);
  scene.add(sun);

  const starPos = [];
  for (let i = 0; i < 1600; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(90 + Math.random() * 140);
    starPos.push(v.x, v.y, v.z);
  }
  scene.add(
    new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })
    )
  );

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x1d4dff, emissive: 0x081a4a, roughness: 0.45, metalness: 0.2 })
  );
  scene.add(planet);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R * 1.12, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x3dfcff,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(atmo);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PLANET_R * 1.7, 0.05, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xff3d9a })
  );
  ring.rotation.x = Math.PI / 2.4;
  scene.add(ring);

  const turret = new THREE.Group();
  turret.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x9aa4ff, metalness: 0.6, roughness: 0.3 })
    )
  );
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 1.1, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0x553a00 })
  );
  barrel.position.y = 0.8;
  turret.add(barrel);
  scene.add(turret);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.5, 0.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = Math.max(1, root.clientWidth);
    const h = Math.max(1, root.clientHeight);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  /* ---------- game state ---------- */
  let state = "idle"; // idle | play | over
  let score = 0;
  let hp = MAX_HP;
  let aim = Math.PI / 2;
  let fireHeld = false;
  let cooldown = 0;
  let spawnTimer = 0;
  let shake = 0;
  const keys = { left: false, right: false };
  const meteors = [];
  const bolts = [];
  const parts = [];
  let ov = null;

  function removeMesh(mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  function clearScene() {
    for (const m of meteors) removeMesh(m.mesh);
    for (const b of bolts) removeMesh(b.mesh);
    for (const p of parts) removeMesh(p.mesh);
    meteors.length = 0;
    bolts.length = 0;
    parts.length = 0;
  }

  function renderHud() {
    scoreNode.textContent = String(score);
    hpNode.textContent = "●".repeat(Math.max(0, hp)) + "○".repeat(Math.max(0, MAX_HP - hp));
  }

  function showBest() {
    bestNode.textContent = `Beste: ${getBest(BEST_KEY) ?? "—"}`;
  }

  function spawnMeteor() {
    const a = Math.random() * Math.PI * 2;
    const r = rnd(0.45, 0.8);
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 0),
      new THREE.MeshStandardMaterial({ color: pick(METEOR_COLORS), emissive: 0x2a0d00, flatShading: true, roughness: 0.7 })
    );
    const start = new THREE.Vector3(Math.cos(a) * SPAWN_R, Math.sin(a) * SPAWN_R, rnd(-3, 3));
    const target = new THREE.Vector3(rnd(-1.4, 1.4), rnd(-1.4, 1.4), 0);
    mesh.position.copy(start);
    scene.add(mesh);
    const speed = 5 + Math.min(score / 60, 7);
    const vel = target.sub(start).normalize().multiplyScalar(speed);
    const spin = new THREE.Vector3(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2));
    meteors.push({ mesh, vel, r, spin });
  }

  function fire() {
    const dir = new THREE.Vector3(Math.cos(aim), Math.sin(aim), 0);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3dfcff }));
    mesh.position.copy(dir).multiplyScalar(PLANET_R + 0.8);
    scene.add(mesh);
    bolts.push({ mesh, vel: dir.multiplyScalar(38) });
    cooldown = 0.2;
  }

  function burst(pos, color, count) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      mesh.position.copy(pos);
      scene.add(mesh);
      parts.push({ mesh, vel: new THREE.Vector3().randomDirection().multiplyScalar(rnd(3, 9)), life: rnd(0.5, 0.9) });
    }
  }

  function step(dt) {
    if (keys.left) aim += 2.6 * dt;
    if (keys.right) aim -= 2.6 * dt;

    cooldown -= dt;
    if (fireHeld && cooldown <= 0) fire();

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnMeteor();
      spawnTimer = Math.max(0.35, 1.3 - score / 300) * rnd(0.7, 1.3);
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.mesh.position.addScaledVector(m.vel, dt);
      m.mesh.rotation.x += m.spin.x * dt;
      m.mesh.rotation.y += m.spin.y * dt;
      if (m.mesh.position.length() < PLANET_R + m.r * 0.6) {
        burst(m.mesh.position, 0xff7a3d, 14);
        removeMesh(m.mesh);
        meteors.splice(i, 1);
        hp -= 1;
        shake = 1;
        if (hp <= 0) {
          gameOver();
          return;
        }
      }
    }

    for (let b = bolts.length - 1; b >= 0; b--) {
      const bolt = bolts[b];
      bolt.mesh.position.addScaledVector(bolt.vel, dt);
      let hit = false;
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        if (m.mesh.position.distanceTo(bolt.mesh.position) < m.r + 0.35) {
          burst(m.mesh.position, 0x3dfcff, 18);
          removeMesh(m.mesh);
          meteors.splice(i, 1);
          score += 10;
          hit = true;
          break;
        }
      }
      if (hit || bolt.mesh.position.length() > SPAWN_R + 4) {
        removeMesh(bolt.mesh);
        bolts.splice(b, 1);
      }
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(0.94);
      p.mesh.material.opacity = Math.max(0, Math.min(1, p.life));
      if (p.life <= 0) {
        removeMesh(p.mesh);
        parts.splice(i, 1);
      }
    }

    renderHud();
  }

  function begin() {
    clearScene();
    score = 0;
    hp = MAX_HP;
    cooldown = 0;
    spawnTimer = 0.6;
    state = "play";
    renderHud();
  }

  function gameOver() {
    state = "over";
    fireHeld = false;
    const best = getBest(BEST_KEY) ?? 0;
    const isBest = score > best;
    if (isBest) setBest(BEST_KEY, score);
    showBest();
    showOverlay({
      kicker: "GAME OVER",
      title: `Score ${score}`,
      text: isBest ? "Nieuw record!" : `Je beste blijft ${best}.`,
      button: "OPNIEUW",
    });
  }

  function showOverlay(opts) {
    ov?.close();
    ov = overlay(root, { ...opts, onStart: begin });
  }

  /* ---------- input ---------- */
  function aimFromPointer(e) {
    const rect = root.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    aim = Math.atan2(-dy, dx);
  }

  const onPointerMove = (e) => {
    if (state === "play") aimFromPointer(e);
  };
  const onPointerDown = (e) => {
    if (e.target.closest(".game-overlay")) return;
    if (state !== "play") return;
    aimFromPointer(e);
    fireHeld = true;
  };
  const onPointerUp = () => {
    fireHeld = false;
  };
  const onKeyDown = (e) => {
    if (state !== "play") return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    else if (e.code === "Space") fireHeld = true;
    else return;
    e.preventDefault();
  };
  const onKeyUp = (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
    else if (e.code === "Space") fireHeld = false;
  };

  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ---------- loop ---------- */
  const stopLoop = loop((dt) => {
    if (state === "play") step(dt);

    planet.rotation.y += dt * 0.05;
    const dir = new THREE.Vector3(Math.cos(aim), Math.sin(aim), 0);
    turret.position.copy(dir).multiplyScalar(PLANET_R);
    turret.quaternion.setFromUnitVectors(UP, dir);

    shake = Math.max(0, shake - dt * 2.5);
    camera.position.set(rnd(-1, 1) * shake * 0.6, 7 + rnd(-1, 1) * shake * 0.6, CAM_Z);
    camera.lookAt(0, 0, 0);

    composer.render();
  });

  showBest();
  renderHud();
  showOverlay({
    kicker: "3D · VERDEDIGEN",
    title: "Planet Defender",
    text: "Meteorieten razen op je planeet af. Richt met de muis of pijltjes en vuur met klikken of spatie.",
    button: "START",
  });

  return {
    restart: () => {
      ov?.close();
      begin();
    },
    destroy: () => {
      stopLoop();
      ro.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ov?.close();
      clearScene();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
