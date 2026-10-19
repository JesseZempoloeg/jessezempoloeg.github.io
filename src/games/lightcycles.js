import * as THREE from "three";
import { overlay, getBest, setBest, loop, clamp, lerp } from "./util.js";

const BEST_KEY = "lightcycles";
const N = 40; // arena size in cells
const DIRS = [
  [0, -1], // north
  [1, 0], // east
  [0, 1], // south
  [-1, 0], // west
];
const WALL_H = 1.6;
const CELL_H = 1.1;
const MAX_TRAIL = N * N;

const cellX = (x) => x - N / 2 + 0.5;
const cellZ = (z) => z - N / 2 + 0.5;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Verslagen</span><span class="hud-value" data-kills>0</span></div>
        <div class="hud-item"><span class="hud-label">Stappen</span><span class="hud-value" data-steps>0</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end"><span class="hud-label" data-best>Beste: —</span></div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">PIJLEN / A D: DRAAI · KLIK LINKS/RECHTS OM TE DRAAIEN · NIET IN JE EIGEN SPOOR RIJDEN</p>`;

  const killsNode = root.querySelector("[data-kills]");
  const stepsNode = root.querySelector("[data-steps]");
  const bestNode = root.querySelector("[data-best]");

  /* ---------- three.js scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03020a);
  scene.fog = new THREE.Fog(0x03020a, 30, 70);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

  scene.add(new THREE.AmbientLight(0x8080ff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(10, 20, 6);
  scene.add(sun);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x080618, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(N, N), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(N, N, 0x3dfcff, 0x1a1040);
  grid.position.y = 0.01;
  scene.add(grid);

  // arena border walls
  const borderMat = new THREE.MeshStandardMaterial({ color: 0xff7ab6, emissive: 0xff7ab6, emissiveIntensity: 1.0 });
  const borderGeoH = new THREE.BoxGeometry(N + 0.4, WALL_H, 0.3);
  const borderGeoV = new THREE.BoxGeometry(0.3, WALL_H, N + 0.4);
  const borders = [
    [0, -N / 2 - 0.15, borderGeoH],
    [0, N / 2 + 0.15, borderGeoH],
    [-N / 2 - 0.15, 0, borderGeoV],
    [N / 2 + 0.15, 0, borderGeoV],
  ].map(([x, z, geo]) => {
    const m = new THREE.Mesh(geo, borderMat);
    m.position.set(x, WALL_H / 2, z);
    scene.add(m);
    return m;
  });

  // trails as instanced cubes, one instanced mesh per owner
  const trailGeo = new THREE.BoxGeometry(0.92, CELL_H, 0.92);
  const playerTrailMat = new THREE.MeshStandardMaterial({ color: 0x3dfcff, emissive: 0x3dfcff, emissiveIntensity: 0.9 });
  const aiTrailMat = new THREE.MeshStandardMaterial({ color: 0xff7ab6, emissive: 0xff7ab6, emissiveIntensity: 0.9 });
  const trailMeshes = {
    1: new THREE.InstancedMesh(trailGeo, playerTrailMat, MAX_TRAIL),
    2: new THREE.InstancedMesh(trailGeo, aiTrailMat, MAX_TRAIL),
  };
  for (const m of Object.values(trailMeshes)) {
    m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
  }

  // light cycle heads
  const headGeo = new THREE.BoxGeometry(0.9, 0.6, 1.3);
  const playerHead = new THREE.Mesh(headGeo, playerTrailMat);
  const aiHead = new THREE.Mesh(headGeo, aiTrailMat);
  scene.add(playerHead, aiHead);

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

  /* ---------- grid state ---------- */
  const occ = new Uint8Array(N * N); // 0 empty, 1 player trail, 2 AI trail
  const trailCells = { 1: [], 2: [] };
  const matrix = new THREE.Matrix4();

  function addTrail(owner, x, z) {
    const idx = z * N + x;
    occ[idx] = owner;
    const list = trailCells[owner];
    list.push(idx);
    const mesh = trailMeshes[owner];
    if (list.length > MAX_TRAIL) return;
    matrix.makeTranslation(cellX(x), CELL_H / 2, cellZ(z));
    mesh.setMatrixAt(list.length - 1, matrix);
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
  }

  function clearTrail(owner) {
    for (const idx of trailCells[owner]) occ[idx] = 0;
    trailCells[owner] = [];
    trailMeshes[owner].count = 0;
  }

  const blocked = (x, z) => x < 0 || z < 0 || x >= N || z >= N || occ[z * N + x] !== 0;

  /* ---------- game state ---------- */
  let state = "idle"; // idle | play | over
  let kills = 0;
  let steps = 0;
  let tickTime = 0.11;
  let timer = 0;
  let pendingTurn = 0;
  let ov = null;

  const player = { x: 0, z: 0, d: 0, px: 0, pz: 0 };
  const ai = { x: 0, z: 0, d: 2, px: 0, pz: 0, alive: true };

  function renderHud() {
    killsNode.textContent = String(kills);
    stepsNode.textContent = String(steps);
  }

  function showBest() {
    bestNode.textContent = `Beste: ${getBest(BEST_KEY) ?? "—"} kills`;
  }

  function showOverlay(opts) {
    ov?.close();
    ov = overlay(root, { ...opts, onStart: begin });
  }

  function clearAll() {
    occ.fill(0);
    clearTrail(1);
    clearTrail(2);
  }

  function spawnPlayer() {
    player.x = Math.floor(N / 2);
    player.z = N - 6;
    player.d = 0;
    player.px = player.x;
    player.pz = player.z;
    addTrail(1, player.x, player.z);
  }

  function spawnAI() {
    // pick a free cell far from the player
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 200; tries++) {
      x = Math.floor(Math.random() * (N - 8)) + 4;
      z = Math.floor(Math.random() * (N - 8)) + 4;
      const far = Math.hypot(x - player.x, z - player.z) > 12;
      if (far && occ[z * N + x] === 0) break;
    }
    ai.x = x;
    ai.z = z;
    ai.d = Math.floor(Math.random() * 4);
    ai.px = x;
    ai.pz = z;
    ai.alive = true;
    addTrail(2, x, z);
  }

  function begin() {
    clearAll();
    kills = 0;
    steps = 0;
    tickTime = 0.11;
    timer = 0;
    pendingTurn = 0;
    spawnPlayer();
    spawnAI();
    state = "play";
    renderHud();
  }

  function gameOver() {
    state = "over";
    const best = getBest(BEST_KEY) ?? 0;
    const isBest = kills > best;
    if (isBest) setBest(BEST_KEY, kills);
    showBest();
    showOverlay({
      kicker: "CRASH",
      title: `${kills} kills`,
      text: isBest ? "Nieuw record!" : `Je beste blijft ${best}.`,
      button: "OPNIEUW",
    });
  }

  /* ---------- AI ---------- */
  // how many free cells lie ahead in direction d (capped at 4)
  function clearAhead(d) {
    let k = 0;
    for (let s = 1; s <= 4; s++) {
      const x = ai.x + DIRS[d][0] * s;
      const z = ai.z + DIRS[d][1] * s;
      if (blocked(x, z)) break;
      k++;
    }
    return k;
  }

  function aiThink() {
    const straight = clearAhead(ai.d);
    if (straight >= 4 && Math.random() > 0.06) return;
    const left = (ai.d + 3) % 4;
    const right = (ai.d + 1) % 4;
    const lc = clearAhead(left);
    const rc = clearAhead(right);
    if (lc <= 0 && rc <= 0) return; // trapped, it will crash
    if (lc === rc) ai.d = Math.random() < 0.5 ? left : right;
    else ai.d = lc > rc ? left : right;
  }

  /* ---------- simulation tick ---------- */
  function tick() {
    if (pendingTurn) {
      player.d = (player.d + (pendingTurn > 0 ? 1 : 3)) % 4;
      pendingTurn = 0;
    }
    if (ai.alive) aiThink();

    player.px = player.x;
    player.pz = player.z;
    ai.px = ai.x;
    ai.pz = ai.z;

    const pn = { x: player.x + DIRS[player.d][0], z: player.z + DIRS[player.d][1] };
    const an = { x: ai.x + DIRS[ai.d][0], z: ai.z + DIRS[ai.d][1] };
    const pDead = blocked(pn.x, pn.z) || (pn.x === an.x && pn.z === an.z);
    const aDead = blocked(an.x, an.z) || (pn.x === an.x && pn.z === an.z);

    if (!pDead) {
      player.x = pn.x;
      player.z = pn.z;
      addTrail(1, player.x, player.z);
      steps++;
    }
    if (!aDead) {
      ai.x = an.x;
      ai.z = an.z;
      addTrail(2, ai.x, ai.z);
    }

    if (pDead) {
      state = "over";
      gameOver();
      return;
    }
    if (aDead) {
      kills++;
      clearTrail(2);
      ai.alive = false;
      spawnAI();
    }
    tickTime = Math.max(0.055, 0.11 - steps * 0.0007);
    renderHud();
  }

  /* ---------- input ---------- */
  const onPointerDown = (e) => {
    if (e.target.closest(".game-overlay")) return;
    if (state !== "play") return;
    const rect = root.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    pendingTurn = rel < 0.5 ? -1 : 1;
  };
  const onKeyDown = (e) => {
    if (state !== "play" || e.repeat) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") pendingTurn = -1;
    else if (e.code === "ArrowRight" || e.code === "KeyD") pendingTurn = 1;
    else return;
    e.preventDefault();
  };
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);

  /* ---------- loop ---------- */
  const stopLoop = loop((dt) => {
    if (state === "play") {
      timer += dt;
      while (timer >= tickTime && state === "play") {
        timer -= tickTime;
        tick();
      }
    }

    // visual interpolation between grid cells
    const k = clamp(timer / tickTime, 0, 1);
    const hx = lerp(player.px, player.x, k);
    const hz = lerp(player.pz, player.z, k);
    playerHead.position.set(cellX(hx), CELL_H * 0.5 + 0.3, cellZ(hz));
    playerHead.rotation.y = -player.d * (Math.PI / 2);
    aiHead.visible = ai.alive;
    aiHead.position.set(cellX(lerp(ai.px, ai.x, k)), CELL_H * 0.5 + 0.3, cellZ(lerp(ai.pz, ai.z, k)));
    aiHead.rotation.y = -ai.d * (Math.PI / 2);

    // chase camera behind the player
    const [dx, dz] = DIRS[player.d];
    const cx = playerHead.position.x;
    const cz = playerHead.position.z;
    const f = 1 - Math.exp(-8 * dt);
    const tx = cx - dx * 8;
    const tz = cz - dz * 8;
    camera.position.x = lerp(camera.position.x, tx, f);
    camera.position.y = lerp(camera.position.y, 6, f);
    camera.position.z = lerp(camera.position.z, tz, f);
    camera.lookAt(cx + dx * 2, 0.5, cz + dz * 2);

    renderer.render(scene, camera);
  });

  camera.position.set(0, 6, N - 2);
  camera.lookAt(0, 0.5, N - 8);
  showBest();
  renderHud();
  showOverlay({
    kicker: "3D · ARENA",
    title: "Light Cycles",
    text: "Rijd zo lang mogelijk. Je spoor is een muur, en de cycle van de computer ook. Laat hem crashen om een kill te scoren.",
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
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      ov?.close();
      floor.geometry.dispose();
      floorMat.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      for (const b of borders) b.geometry.dispose();
      borderMat.dispose();
      trailGeo.dispose();
      playerTrailMat.dispose();
      aiTrailMat.dispose();
      headGeo.dispose();
      for (const m of Object.values(trailMeshes)) m.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
