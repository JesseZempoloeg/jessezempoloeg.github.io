import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { audio } from "../audio.js";
import { overlay, getBest, setBest, formatNumber, clamp, rand } from "./util.js";

const RING_COUNT = 9;
const RING_SPACING = 26;
const ROCK_COUNT = 14;
const SHIP_Z = 0.6;
const SPAN_Z = RING_COUNT * RING_SPACING;

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item">
          <span class="hud-label">Ringen</span>
          <span class="hud-value" data-score>0</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">Beste</span>
          <span class="hud-value" data-best>0</span>
        </div>
      </div>
      <div class="hud-item" style="align-items:flex-end">
        <span class="hud-label">Schepen</span>
        <div class="lives" data-lives></div>
      </div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const livesNode = root.querySelector("[data-lives]");

  const rect = root.getBoundingClientRect();
  let width = Math.max(1, rect.width);
  let height = Math.max(1, rect.height);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050a);
  scene.fog = new THREE.FogExp2(0x04050a, 0.0072);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
  camera.position.set(0, 0, 9.5);
  camera.lookAt(0, 0, -8);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xcfe6ff, 2.4);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const warm = new THREE.DirectionalLight(0xffb27a, 1.2);
  warm.position.set(5, -4, 2);
  scene.add(warm);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.48, 0.55, 0.42);
  composer.addPass(bloom);
  composer.setSize(width, height);

  /* ---------------- ship ---------------- */
  const ship = new THREE.Group();
  ship.position.set(0, 0, SHIP_Z);
  ship.scale.setScalar(1.35);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xe8f6ff,
    emissive: 0x2f8fc4,
    emissiveIntensity: 1.5,
    metalness: 0.55,
    roughness: 0.32,
    flatShading: true,
    transparent: true,
  });
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.78, 4), hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.rotation.z = Math.PI / 4;
  ship.add(hull);

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x9fd8ff,
    emissive: 0x1c6f96,
    emissiveIntensity: 1.1,
    metalness: 0.4,
    roughness: 0.5,
    transparent: true,
  });
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.44, 3), wingMat);
    wing.rotation.x = -Math.PI / 2;
    wing.rotation.z = side * 0.85;
    wing.position.set(side * 0.19, -0.04, 0.14);
    ship.add(wing);
  });

  const glowTex = glowTexture();
  const engine = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x86e2ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
    })
  );
  engine.scale.set(0.7, 0.7, 1);
  engine.position.set(0, 0, 0.52);
  ship.add(engine);
  scene.add(ship);

  /* ---------------- stars ---------------- */
  const starCount = 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = rand(-34, 34);
    starPos[i * 3 + 1] = rand(-20, 20);
    starPos[i * 3 + 2] = rand(-260, 18);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.22,
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
    color: 0xdfe9ff,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------------- rings ---------------- */
  const ringGeo = new THREE.TorusGeometry(1.85, 0.035, 8, 100);
  const haloGeo = new THREE.TorusGeometry(1.85, 0.1, 8, 100);
  const rings = [];
  const ringColors = [0x7fe3ff, 0xffc98a, 0x9dffcf];

  for (let i = 0; i < RING_COUNT; i++) {
    const group = new THREE.Group();
    const color = ringColors[i % ringColors.length];
    const core = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    const halo = new THREE.Mesh(
      haloGeo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(core, halo);
    group.position.set(rand(-1.8, 1.8), rand(-0.8, 0.8), -16 - i * RING_SPACING);
    group.userData = {
      core,
      halo,
      radius: 2.15,
      prevZ: group.position.z,
      flash: 0,
      passed: false,
    };
    rings.push(group);
    scene.add(group);
  }

  /* ---------------- asteroids ---------------- */
  const rockGeo = new THREE.IcosahedronGeometry(0.55, 0);
  const rocks = [];
  for (let i = 0; i < ROCK_COUNT; i++) {
    const rock = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.07, 0.12, 0.24 + Math.random() * 0.16),
        roughness: 0.95,
        metalness: 0.08,
        flatShading: true,
      })
    );
    const size = rand(0.45, 1.15);
    rock.scale.setScalar(size);
    rock.userData = {
      size,
      spin: new THREE.Vector3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6)),
    };
    resetRock(rock, true);
    rocks.push(rock);
    scene.add(rock);
  }

  function resetRock(rock, initial) {
    rock.position.set(
      rand(-6, 6),
      rand(-3.6, 3.6),
      initial ? rand(-240, -20) : rand(-250, -180)
    );
    rock.scale.setScalar(rand(0.45, 1.15));
    rock.userData.size = rock.scale.x;
  }

  /* ---------------- state ---------------- */
  const state = {
    mode: "ready",
    score: 0,
    lives: 3,
    best: getBest("astrodrift") ?? 0,
    speed: 14,
    invuln: 0,
    shake: 0,
    time: 0,
  };

  bestNode.textContent = formatNumber(state.best);
  paintLives();

  function paintLives() {
    livesNode.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = `life${i < state.lives ? "" : " off"}`;
      livesNode.appendChild(dot);
    }
  }

  function paintScore() {
    scoreNode.textContent = formatNumber(state.score);
    bestNode.textContent = formatNumber(state.best);
  }

  /* ---------------- input ---------------- */
  const input = { x: 0, y: 0, keyX: 0, keyY: 0, boost: false };
  const shipPos = { x: 0, y: 0 };

  const onPointer = (event) => {
    const r = root.getBoundingClientRect();
    input.x = clamp(((event.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    input.y = clamp(((event.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  };
  root.addEventListener("pointermove", onPointer, { passive: true });

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " "].includes(k)) {
      event.preventDefault();
    }
    if (k === "arrowleft" || k === "a") input.keyX = -1;
    if (k === "arrowright" || k === "d") input.keyX = 1;
    if (k === "arrowup" || k === "w") input.keyY = -1;
    if (k === "arrowdown" || k === "s") input.keyY = 1;
    if (k === " ") input.boost = true;
  };
  const onKeyUp = (event) => {
    const k = event.key.toLowerCase();
    if (k === "arrowleft" || k === "a") input.keyX = 0;
    if (k === "arrowright" || k === "d") input.keyX = 0;
    if (k === "arrowup" || k === "w") input.keyY = 0;
    if (k === "arrowdown" || k === "s") input.keyY = 0;
    if (k === " ") input.boost = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ---------------- flow ---------------- */
  let modal = null;

  function startRun() {
    state.mode = "playing";
    state.score = 0;
    state.lives = 3;
    state.invuln = 1.1;
    state.shake = 0;
    paintScore();
    paintLives();
    rings.forEach((ring, i) => {
      ring.position.z = -16 - i * RING_SPACING;
      ring.position.x = rand(-2.2, 2.2);
      ring.position.y = rand(-1.1, 1.1);
      ring.userData.prevZ = ring.position.z;
      ring.userData.passed = false;
      ring.userData.flash = 0;
      ring.scale.setScalar(1);
      ring.userData.core.material.opacity = 0.95;
      ring.userData.halo.material.opacity = 0.16;
    });
    rocks.forEach((rock) => resetRock(rock, true));
    ship.position.set(0, 0, SHIP_Z);
    shipPos.x = 0;
    shipPos.y = 0;
    audio.blip();
  }

  function gameOver() {
    state.mode = "over";
    audio.miss();
    if (state.score > state.best) {
      state.best = state.score;
      setBest("astrodrift", state.best);
      audio.win();
    }
    paintScore();
    modal = overlay(root, {
      kicker: "RUIMTEVAART IS HARD",
      title: "Je schip is ruimtepuin",
      text: `Je vloog door <strong>${formatNumber(state.score)}</strong> ringen.`,
      extra: `<div class="ov-stat">
        <div><span>Deze vlucht</span><span>${formatNumber(state.score)}</span></div>
        <div><span>Beste</span><span>${formatNumber(state.best)}</span></div>
      </div>`,
      button: "NIEUWE VLUCHT",
      onStart: startRun,
    });
  }

  function showStart() {
    modal = overlay(root, {
      kicker: "ASTRO DRIFT",
      title: "Vlieg door de ringen",
      text: "Beweeg met je muis of de pijltjes. Houd <strong>spatie</strong> ingedrukt om te versnellen — sneller betekent meer ringen, maar ook meer brokken.",
      extra: `<div class="ov-keys">
        <span class="kbd">MUIS</span>
        <span class="kbd">← ↑ ↓ →</span>
        <span class="kbd">SPATIE = BOOST</span>
      </div>`,
      button: "START DE MOTOR",
      onStart: startRun,
    });
  }

  /* ---------------- loop ---------------- */
  let raf = 0;
  let running = true;
  let lastFrame = performance.now();

  function hitRock(rock) {
    state.lives -= 1;
    state.invuln = 1.8;
    state.shake = 1;
    audio.hit();
    paintLives();
    if (state.lives <= 0) {
      gameOver();
      return;
    }
    rock.position.z = -220;
    rock.position.x = rand(-6, 6);
  }

  function update(dt) {
    state.time += dt;

    const playing = state.mode === "playing";
    const targetSpeed = playing ? Math.min(74, 40 + state.score * 0.75) * (input.boost ? 1.55 : 1) : 15;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * (playing ? 1.6 : 0.8));

    // world scroll
    const dz = state.speed * dt;

    stars.geometry.attributes.position.array.forEach(() => {});
    const pos = stars.geometry.attributes.position.array;
    for (let i = 2; i < pos.length; i += 3) {
      pos[i] += dz;
      if (pos[i] > 4) pos[i] -= 264;
    }
    stars.geometry.attributes.position.needsUpdate = true;

    for (const ring of rings) {
      ring.userData.prevZ = ring.position.z;
      ring.position.z += dz;

      if (ring.userData.flash > 0) {
        ring.userData.flash = Math.max(0, ring.userData.flash - dt * 2.2);
        const f = ring.userData.flash;
        ring.scale.setScalar(1 + f * 0.28);
        ring.userData.core.material.opacity = 0.25 + f * 0.75;
        ring.userData.halo.material.opacity = 0.05 + f * 0.5;
      }

      // rings fade out once they have swept past the ship, so they never
      // turn into giant hoops in front of the camera
      if (ring.position.z > 0.9) {
        const f = clamp(1 - (ring.position.z - 0.9) / 2.4, 0, 1);
        ring.userData.core.material.opacity = Math.min(ring.userData.core.material.opacity, 0.9 * f);
        ring.userData.halo.material.opacity = Math.min(ring.userData.halo.material.opacity, 0.14 * f);
      }

      if (playing && !ring.userData.passed && ring.userData.prevZ < SHIP_Z && ring.position.z >= SHIP_Z) {
        ring.userData.passed = true;
        const dxc = ring.position.x - shipPos.x;
        const dyc = ring.position.y - shipPos.y;
        const dist = Math.hypot(dxc, dyc);
        if (dist < ring.userData.radius * 0.96) {
          state.score += 1;
          if (state.score > state.best) state.best = state.score;
          ring.userData.flash = 1;
          audio.score();
          paintScore();
        } else {
          ring.userData.flash = 0.35;
          audio.step();
        }
      }

      if (ring.position.z > 5) {
        ring.position.z -= SPAN_Z;
        ring.userData.prevZ = ring.position.z;
        ring.userData.passed = false;
        ring.userData.flash = 0;
        ring.scale.setScalar(1);
        ring.userData.core.material.opacity = 0.9;
        ring.userData.halo.material.opacity = 0.14;
        // keep consecutive rings far enough apart to force steering
        ring.position.x = rand(-2.2, 2.2);
        ring.position.y = rand(-1.1, 1.1);
      }
    }

    for (const rock of rocks) {
      rock.position.z += dz;
      rock.rotation.x += rock.userData.spin.x * dt;
      rock.rotation.y += rock.userData.spin.y * dt;
      if (rock.position.z > 5) resetRock(rock, false);

      if (playing && state.invuln <= 0) {
        const near = Math.abs(rock.position.z - SHIP_Z) < 0.85;
        const dist = Math.hypot(rock.position.x - shipPos.x, rock.position.y - shipPos.y);
        if (near && dist < rock.userData.size * 0.75 + 0.34) {
          hitRock(rock);
        }
      }
    }

    if (playing) {
      const wantX = clamp(input.x * 3.5 + input.keyX * 1.2, -3.5, 3.5);
      const wantY = clamp(-input.y * 2.0 + input.keyY * 1.2, -2.0, 2.0);
      const prevX = shipPos.x;
      shipPos.x += (wantX - shipPos.x) * Math.min(1, dt * 7);
      shipPos.y += (wantY - shipPos.y) * Math.min(1, dt * 7);
      ship.position.x = shipPos.x;
      ship.position.y = shipPos.y;

      const velX = (shipPos.x - prevX) / Math.max(dt, 0.001);
      ship.rotation.z += (-clamp(velX * 0.22, -0.7, 0.7) - ship.rotation.z) * Math.min(1, dt * 8);
      ship.rotation.x += (clamp((wantY - shipPos.y) * 0.25, -0.2, 0.2) - ship.rotation.x) * Math.min(1, dt * 6);
      ship.position.y += Math.sin(state.time * 3) * 0.012;

      state.invuln = Math.max(0, state.invuln - dt);
      hullMat.opacity = state.invuln > 0 && Math.floor(state.time * 14) % 2 === 0 ? 0.3 : 1;
      wingMat.opacity = hullMat.opacity;
    } else {
      ship.rotation.z *= 0.94;
      ship.rotation.x *= 0.94;
      ship.position.y = Math.sin(state.time * 1.2) * 0.12;
    }

    engine.scale.setScalar(0.62 + Math.sin(state.time * 22) * 0.04 + (input.boost && playing ? 0.28 : 0));
    engine.material.color.setHex(input.boost && playing ? 0xffd6a8 : 0x86e2ff);

    // camera drift + shake
    state.shake = Math.max(0, state.shake - dt * 2.4);
    const shake = state.shake * state.shake;
    camera.position.x = Math.sin(state.time * 0.7) * 0.16 + rand(-1, 1) * shake * 0.4;
    camera.position.y = Math.cos(state.time * 0.55) * 0.12 + rand(-1, 1) * shake * 0.4;
    camera.lookAt(0, 0, -8);

    bloom.strength = 0.46 + Math.sin(state.time * 1.5) * 0.04 + (input.boost && playing ? 0.12 : 0);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    update(dt);
    composer.render();
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  showStart();

  /* ---------------- resize ---------------- */
  const ro = new ResizeObserver(() => {
    const r = root.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
  });
  ro.observe(root);

  /* ---------------- cleanup ---------------- */
  return {
    restart: () => {
      modal?.close();
      modal = null;
      startRun();
    },
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      root.removeEventListener("pointermove", onPointer);

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            Object.values(m).forEach((v) => {
              if (v && v.isTexture) v.dispose();
            });
            m.dispose();
          });
        }
      });
      composer.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
