import * as THREE from "three";
import { overlay, getBest, setBest, loop, clamp } from "./util.js";

const BEST_KEY = "neonstack";
const H = 0.5; // height of one layer
const START_W = 4.8;
const DEPTH = 4.8;
const SWING = 6.5; // how far the moving block travels left and right
const PERFECT = 0.07; // alignment tolerance for a perfect drop

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Verdiepingen</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Perfect</span><span class="hud-value" data-perfect>0</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end"><span class="hud-label" data-best>Beste: —</span></div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">SPATIE / KLIK: LAAT VALLEN · RAAK DE PRECIEZE MIDDEN</p>`;

  const scoreNode = root.querySelector("[data-score]");
  const perfectNode = root.querySelector("[data-perfect]");
  const bestNode = root.querySelector("[data-best]");

  /* ---------- three.js scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06030f);
  scene.fog = new THREE.Fog(0x06030f, 26, 60);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(9, 6, 11);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8080ff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(6, 12, 8);
  scene.add(key);

  const boxGeo = new THREE.BoxGeometry(1, H, DEPTH); // width is set with scale.x
  const meshes = []; // every mesh we create, so destroy can dispose them

  function makeBlock(x, y, w, hue) {
    const color = new THREE.Color().setHSL(hue, 1, 0.55);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(x, y, 0);
    mesh.scale.x = w;
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }

  const floor = new THREE.GridHelper(120, 60, 0xff3d9a, 0x3dfcff);
  floor.position.y = -0.6;
  floor.material.transparent = true;
  floor.material.opacity = 0.3;
  scene.add(floor);

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
  let placed = []; // { mesh, x, w } from the base upward
  let moving = null; // { mesh, w }
  let phase = 0;
  let perfects = 0;
  let camY = 0;
  let ov = null;
  const falling = []; // { mesh, vy, vx }

  function clearAll() {
    for (const m of meshes) {
      scene.remove(m);
      m.material.dispose();
    }
    meshes.length = 0;
    placed = [];
    moving = null;
    falling.length = 0;
  }

  function hueFor(n) {
    return (n * 0.07) % 1;
  }

  function spawnMoving() {
    const n = placed.length;
    const w = placed[n - 1].w;
    const mesh = makeBlock(0, n * H + H / 2, w, hueFor(n));
    moving = { mesh, w };
  }

  function renderHud() {
    scoreNode.textContent = String(Math.max(0, placed.length - 1));
    perfectNode.textContent = String(perfects);
  }

  function showBest() {
    bestNode.textContent = `Beste: ${getBest(BEST_KEY) ?? "—"}`;
  }

  function begin() {
    clearAll();
    perfects = 0;
    phase = 0;
    camY = 0;
    placed.push({ mesh: makeBlock(0, H / 2, START_W, 0), x: 0, w: START_W });
    spawnMoving();
    state = "play";
    renderHud();
  }

  function gameOver() {
    state = "over";
    const score = Math.max(0, placed.length - 1);
    const best = getBest(BEST_KEY) ?? 0;
    const isBest = score > best;
    if (isBest) setBest(BEST_KEY, score);
    showBest();
    showOverlay({
      kicker: "MIS",
      title: `${score} verdiepingen`,
      text: isBest ? "Nieuw record!" : `Je beste blijft ${best}.`,
      button: "OPNIEUW",
    });
  }

  function showOverlay(opts) {
    ov?.close();
    ov = overlay(root, { ...opts, onStart: begin });
  }

  function drop() {
    if (state !== "play" || !moving) return;
    const top = placed[placed.length - 1];
    const x = moving.mesh.position.x;
    const w = moving.w;
    const diff = x - top.x;
    const left = Math.max(top.x - top.w / 2, x - w / 2);
    const right = Math.min(top.x + top.w / 2, x + w / 2);
    const overlapW = right - left;

    if (overlapW <= 0) {
      // missed completely: the whole block falls away
      falling.push({ mesh: moving.mesh, vy: 0, vx: diff * 0.2 });
      moving = null;
      gameOver();
      return;
    }

    if (Math.abs(diff) < PERFECT) {
      // perfect alignment: keep the full width and snap to the tower
      perfects++;
      moving.mesh.position.x = top.x;
      placed.push({ mesh: moving.mesh, x: top.x, w });
    } else {
      // cut away the part that hangs over the edge
      const newX = (left + right) / 2;
      const cutW = w - overlapW;
      const cutCenter = diff > 0 ? (right + (x + w / 2)) / 2 : (x - w / 2 + left) / 2;
      moving.mesh.position.x = newX;
      moving.mesh.scale.x = overlapW;
      placed.push({ mesh: moving.mesh, x: newX, w: overlapW });
      if (cutW > 0.01) {
        const cutMesh = makeBlock(cutCenter, moving.mesh.position.y, cutW, hueFor(placed.length));
        falling.push({ mesh: cutMesh, vy: 0, vx: diff > 0 ? 1.5 : -1.5 });
      }
    }
    moving = null;
    spawnMoving();
    renderHud();
  }

  /* ---------- input ---------- */
  const onPointerDown = (e) => {
    if (e.target.closest(".game-overlay")) return;
    drop();
  };
  const onKeyDown = (e) => {
    if (e.code !== "Space") return;
    e.preventDefault();
    drop();
  };
  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);

  /* ---------- loop ---------- */
  const stopLoop = loop((dt) => {
    if (state === "play" && moving) {
      const score = placed.length - 1;
      phase += dt * (1.6 + score * 0.06);
      const x = Math.sin(phase) * SWING;
      moving.mesh.position.x = clamp(x, -SWING, SWING);
    }

    // let the cut pieces fall away
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy -= 18 * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.rotation.z += f.vx * dt * 0.5;
      if (f.mesh.position.y < -20) {
        scene.remove(f.mesh);
        f.mesh.material.dispose();
        meshes.splice(meshes.indexOf(f.mesh), 1);
        falling.splice(i, 1);
      }
    }

    // follow the tower upward
    const topY = (placed.length || 1) * H;
    camY += (Math.max(2, topY - 1) - camY) * (1 - Math.exp(-4 * dt));
    camera.position.set(9, camY + 6, 11);
    camera.lookAt(0, camY, 0);

    renderer.render(scene, camera);
  });

  showBest();
  renderHud();
  showOverlay({
    kicker: "3D · STAPELEN",
    title: "Neon Stack",
    text: "Laat de blokken op elkaar vallen. Raak je de precieze middenlijn, dan blijft de volle breedte staan.",
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
      clearAll();
      boxGeo.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
