import * as THREE from "three";
import { overlay, getBest, setBest, loop, clamp } from "./util.js";

const BEST_KEY = "voidrunner";
const PLAYER_Z = 4;
const SPAWN_Z = -95;
const MAX_X = 4.2;
const CELL = 1.8;
const COLORS = [0xff3d9a, 0x3dfcff, 0xffe14d, 0x9b6bff];

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Afstand</span><span class="hud-value" data-dist>0 m</span></div>
        <div class="hud-item"><span class="hud-label">Snelheid</span><span class="hud-value" data-speed>0 km/u</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end"><span class="hud-label" data-best>Beste: —</span></div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">PIJLEN / A D OF MUIS: STUREN · WEICH DE BLOKKEN UIT</p>`;

  const distNode = root.querySelector("[data-dist]");
  const speedNode = root.querySelector("[data-speed]");
  const bestNode = root.querySelector("[data-best]");

  /* ---------- three.js scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05020f);
  scene.fog = new THREE.Fog(0x05020f, 30, 120);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  camera.position.set(0, 2.6, PLAYER_Z + 4);
  camera.lookAt(0, 0.5, -30);

  scene.add(new THREE.AmbientLight(0x8080ff, 0.6));
  const glow = new THREE.PointLight(0xff3d9a, 140, 70, 2);
  glow.position.set(0, 4, -12);
  scene.add(glow);

  const grid = new THREE.GridHelper(260, 52, 0x3dfcff, 0x7a2bd6);
  grid.position.y = -1.2;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  /* speed streaks: points that rush toward the camera and wrap around */
  const STREAKS = 1400;
  const streakPos = new Float32Array(STREAKS * 3);
  for (let i = 0; i < STREAKS; i++) {
    streakPos[i * 3] = (Math.random() - 0.5) * 120;
    streakPos[i * 3 + 1] = Math.random() * 40 - 8;
    streakPos[i * 3 + 2] = Math.random() * -220 + 10;
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.PointsMaterial({ color: 0xbfe9ff, size: 0.35, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(streakGeo, streakMat));

  const playerGeo = new THREE.ConeGeometry(0.55, 1.4, 4);
  const player = new THREE.Mesh(
    playerGeo,
    new THREE.MeshStandardMaterial({ color: 0x3dfcff, emissive: 0x0a3a40, metalness: 0.4, roughness: 0.3 })
  );
  player.rotation.x = -Math.PI / 2;
  player.position.set(0, 0, PLAYER_Z);
  scene.add(player);

  const blockGeo = new THREE.BoxGeometry(CELL - 0.2, 1.6, CELL - 0.2);
  const blockMats = COLORS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 })
  );

  function resize() {
    const w = Math.max(1, root.clientWidth);
    const h = Math.max(1, root.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  /* ---------- game state ---------- */
  let state = "idle"; // idle | play | over
  let dist = 0;
  let speed = 20;
  let sinceRow = 0;
  let targetX = 0;
  let px = 0;
  let tilt = 0;
  let ov = null;
  const keys = { left: false, right: false };
  const blocks = []; // { mesh, x, z }

  function clearBlocks() {
    for (const b of blocks) scene.remove(b.mesh);
    blocks.length = 0;
  }

  function spawnRow() {
    // five cells across; three are walls, two are gaps the player can slip through
    const cells = [-2, -1, 0, 1, 2].map((i) => i * CELL);
    const open = new Set();
    while (open.size < 2) open.add(Math.floor(Math.random() * 5));
    cells.forEach((x, i) => {
      if (open.has(i)) return;
      const mesh = new THREE.Mesh(blockGeo, blockMats[Math.floor(Math.random() * blockMats.length)]);
      mesh.position.set(x, 0, SPAWN_Z);
      scene.add(mesh);
      blocks.push({ mesh, x, z: SPAWN_Z });
    });
  }

  function renderHud() {
    distNode.textContent = `${Math.floor(dist)} m`;
    speedNode.textContent = `${Math.round(speed * 3.6)} km/u`;
  }

  function showBest() {
    bestNode.textContent = `Beste: ${getBest(BEST_KEY) ?? "—"} m`;
  }

  function begin() {
    clearBlocks();
    dist = 0;
    speed = 20;
    sinceRow = 6;
    targetX = 0;
    px = 0;
    state = "play";
    renderHud();
  }

  function gameOver() {
    state = "over";
    const score = Math.floor(dist);
    const best = getBest(BEST_KEY) ?? 0;
    const isBest = score > best;
    if (isBest) setBest(BEST_KEY, score);
    showBest();
    showOverlay({
      kicker: "CRASH",
      title: `${score} m`,
      text: isBest ? "Nieuw record!" : `Je beste blijft ${best} m.`,
      button: "OPNIEUW",
    });
  }

  function showOverlay(opts) {
    ov?.close();
    ov = overlay(root, { ...opts, onStart: begin });
  }

  function step(dt) {
    speed = clamp(20 + dist * 0.02, 20, 46);
    dist += speed * dt;

    if (keys.left) targetX -= 9 * dt;
    if (keys.right) targetX += 9 * dt;
    targetX = clamp(targetX, -MAX_X, MAX_X);

    sinceRow += speed * dt;
    if (sinceRow >= 12) {
      spawnRow();
      sinceRow = 0;
    }

    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b.z += speed * dt;
      b.mesh.position.z = b.z;
      b.mesh.rotation.y += dt * 0.6;
      if (Math.abs(b.z - PLAYER_Z) < 0.9 && Math.abs(b.x - px) < CELL * 0.5 + 0.25) {
        gameOver();
        return;
      }
      if (b.z > 12) {
        scene.remove(b.mesh);
        blocks.splice(i, 1);
      }
    }
    renderHud();
  }

  /* ---------- input ---------- */
  const onPointerMove = (e) => {
    if (state !== "play") return;
    const rect = root.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2 * MAX_X;
  };
  const onKeyDown = (e) => {
    if (state !== "play") return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    else return;
    e.preventDefault();
  };
  const onKeyUp = (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  };

  root.addEventListener("pointermove", onPointerMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ---------- loop ---------- */
  const stopLoop = loop((dt) => {
    if (state === "play") step(dt);

    // steer the ship smoothly toward the target and tilt it into the turn
    const prev = px;
    px += (targetX - px) * (1 - Math.exp(-12 * dt));
    tilt += ((px - prev) / Math.max(dt, 0.001) * -0.01 - tilt) * 0.2;
    player.position.x = px;
    player.rotation.z = clamp(tilt, -0.5, 0.5);

    // scroll the grid and streaks toward the camera
    grid.position.z = dist % 5;
    const streakStep = speed * dt * 1.6;
    for (let i = 0; i < STREAKS; i++) {
      streakPos[i * 3 + 2] += streakStep;
      if (streakPos[i * 3 + 2] > 12) streakPos[i * 3 + 2] -= 230;
    }
    streakGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  });

  showBest();
  renderHud();
  showOverlay({
    kicker: "3D · RUNNER",
    title: "Void Runner",
    text: "Duik door de tunnel en glip tussen de blokken door. Hoe verder je komt, hoe sneller het gaat.",
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ov?.close();
      clearBlocks();
      playerGeo.dispose();
      blockGeo.dispose();
      blockMats.forEach((m) => m.dispose());
      streakGeo.dispose();
      streakMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
