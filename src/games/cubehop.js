import * as THREE from "three";
import { overlay, getBest, setBest, loop, clamp, lerp } from "./util.js";

const BEST_KEY = "cubehop";
const COLX = 1.9; // distance between columns
const ROWZ = 2.0; // distance between rows
const TILE = 1.6;
const BASE_Y = 0.7; // cube height while standing on a tile
const HOP_TIME = 0.26;
const CRUMBLE_DELAY = 0.12;
const AHEAD = 14; // rows generated in front of the player
const KEEP_BEHIND = 6; // rows kept behind the player

const hueFor = (i) => (0.55 + i * 0.045) % 1;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Stappen</span><span class="hud-value" data-steps>0</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end"><span class="hud-label" data-best>Beste: —</span></div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">PIJLEN / A D: RICHTING · SPATIE / KLIK: SPRING · KLIK LINKS/RECHTS OM TE STUREN</p>`;

  const stepsNode = root.querySelector("[data-steps]");
  const bestNode = root.querySelector("[data-best]");

  /* ---------- three.js scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070512);
  scene.fog = new THREE.Fog(0x070512, 18, 46);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

  scene.add(new THREE.AmbientLight(0x9090ff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 10, 6);
  scene.add(sun);

  const tileGeo = new THREE.BoxGeometry(TILE, 0.5, TILE);
  const cubeGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffd166,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const player = new THREE.Mesh(cubeGeo, cubeMat);
  scene.add(player);

  const rows = new Map(); // index -> { tiles: Map(col -> mesh), mat }
  const crumbling = []; // { mesh, vy, wait }

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

  function makeRow(i) {
    const color = new THREE.Color().setHSL(hueFor(i), 0.9, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color().setHSL(hueFor(i), 1, 0.4),
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const tiles = new Map();
    for (const col of [-1, 0, 1]) {
      // the centre tile always exists, so there is always a reachable path
      if (col !== 0 && Math.random() < 0.3) continue;
      const mesh = new THREE.Mesh(tileGeo, mat);
      mesh.position.set(col * COLX, 0, -i * ROWZ);
      scene.add(mesh);
      tiles.set(col, mesh);
    }
    rows.set(i, { tiles, mat });
  }

  function disposeRow(r) {
    for (const mesh of r.tiles.values()) scene.remove(mesh);
    r.mat.dispose();
  }

  function ensureRows() {
    for (let i = 0; i <= row + AHEAD; i++) if (!rows.has(i)) makeRow(i);
  }

  function cleanRows() {
    for (const [i, r] of rows) {
      if (i < row - KEEP_BEHIND) {
        disposeRow(r);
        rows.delete(i);
      }
    }
  }

  /* ---------- game state ---------- */
  let state = "idle"; // idle | play | over
  let row = 0;
  let col = 0;
  let hop = null; // { t, fromX, fromZ, toX, toZ, col, ok }
  let falling = false;
  let vy = 0;
  let px = 0;
  let py = BASE_Y;
  let pz = 0;
  let keyDir = 0;
  let ov = null;

  function renderHud() {
    stepsNode.textContent = String(row);
  }

  function showBest() {
    bestNode.textContent = `Beste: ${getBest(BEST_KEY) ?? "—"}`;
  }

  function clearAll() {
    for (const r of rows.values()) disposeRow(r);
    rows.clear();
    for (const c of crumbling) scene.remove(c.mesh);
    crumbling.length = 0;
  }

  function begin() {
    clearAll();
    row = 0;
    col = 0;
    hop = null;
    falling = false;
    vy = 0;
    px = 0;
    py = BASE_Y;
    pz = 0;
    ensureRows();
    state = "play";
    renderHud();
  }

  function gameOver() {
    state = "over";
    const best = getBest(BEST_KEY) ?? 0;
    const isBest = row > best;
    if (isBest) setBest(BEST_KEY, row);
    showBest();
    showOverlay({
      kicker: "GEVALLEN",
      title: `${row} stappen`,
      text: isBest ? "Nieuw record!" : `Je beste blijft ${best}.`,
      button: "OPNIEUW",
    });
  }

  function showOverlay(opts) {
    ov?.close();
    ov = overlay(root, { ...opts, onStart: begin });
  }

  function tryHop(dir) {
    if (state !== "play" || hop || falling) return;
    const target = clamp(col + dir, -1, 1);
    const next = rows.get(row + 1);
    const ok = next ? next.tiles.has(target) : false;
    hop = {
      t: 0,
      fromX: col * COLX,
      fromZ: -row * ROWZ,
      toX: target * COLX,
      toZ: -(row + 1) * ROWZ,
      col: target,
      ok,
    };
  }

  /* ---------- input ---------- */
  const onPointerDown = (e) => {
    if (e.target.closest(".game-overlay")) return;
    const rect = root.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    tryHop(rel < 0.4 ? -1 : rel > 0.6 ? 1 : 0);
  };
  const onKeyDown = (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keyDir = -1;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keyDir = 1;
    else if (e.code === "Space") {
      e.preventDefault();
      tryHop(keyDir);
      return;
    } else return;
    e.preventDefault();
  };
  const onKeyUp = (e) => {
    if ((e.code === "ArrowLeft" || e.code === "KeyA") && keyDir === -1) keyDir = 0;
    if ((e.code === "ArrowRight" || e.code === "KeyD") && keyDir === 1) keyDir = 0;
  };
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ---------- update ---------- */
  function updatePlayer(dt) {
    if (hop) {
      hop.t = Math.min(1, hop.t + dt / HOP_TIME);
      const k = hop.t;
      px = lerp(hop.fromX, hop.toX, k);
      pz = lerp(hop.fromZ, hop.toZ, k);
      py = BASE_Y + Math.sin(Math.PI * k) * 1.1;
      if (k >= 1) {
        const landed = hop;
        hop = null;
        if (landed.ok) {
          // the tile we just left crumbles behind us
          const prev = rows.get(row);
          const prevTile = prev?.tiles.get(col);
          if (prev && prevTile) {
            prev.tiles.delete(col);
            crumbling.push({ mesh: prevTile, vy: 0, wait: CRUMBLE_DELAY });
          }
          row += 1;
          col = landed.col;
          ensureRows();
          cleanRows();
          renderHud();
        } else {
          falling = true;
          vy = 0;
        }
      }
    } else if (falling) {
      vy -= 26 * dt;
      py += vy * dt;
      if (py < -12) gameOver();
    } else {
      py = BASE_Y;
      px = col * COLX;
      pz = -row * ROWZ;
    }
  }

  function updateCrumbling(dt) {
    for (let i = crumbling.length - 1; i >= 0; i--) {
      const c = crumbling[i];
      if (c.wait > 0) {
        c.wait -= dt;
        continue;
      }
      c.vy -= 30 * dt;
      c.mesh.position.y += c.vy * dt;
      if (c.mesh.position.y < -20) {
        scene.remove(c.mesh);
        crumbling.splice(i, 1);
      }
    }
  }

  /* ---------- loop ---------- */
  const stopLoop = loop((dt) => {
    if (state === "play") {
      updatePlayer(dt);
      updateCrumbling(dt);
    }

    player.position.set(px, py, pz);
    player.rotation.y += dt * 0.6;

    // smooth follow camera, slightly behind and above the cube
    const k = 1 - Math.exp(-5 * dt);
    camera.position.x = lerp(camera.position.x, px * 0.5, k);
    camera.position.y = lerp(camera.position.y, py + 6, k);
    camera.position.z = lerp(camera.position.z, pz + 9, k);
    camera.lookAt(px * 0.5, py - 1, pz - 2);

    renderer.render(scene, camera);
  });

  ensureRows();
  showBest();
  renderHud();
  showOverlay({
    kicker: "3D · SPRINGEN",
    title: "Cube Hop",
    text: "Spring van tegel naar tegel. Tegels storten in zodra je ervan af springt, dus kies je pad goed.",
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
      window.removeEventListener("keyup", onKeyUp);
      ov?.close();
      clearAll();
      tileGeo.dispose();
      cubeGeo.dispose();
      cubeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
