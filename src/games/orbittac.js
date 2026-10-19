import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { getBest, setBest, loop, overlay } from "./util.js";

const BEST_KEY = "orbittac";
const CELL = 2.4;
const AI_DELAY = 0.7;
const AI_MISTAKE = 0.22;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const cellPos = (i) => new THREE.Vector3(((i % 3) - 1) * CELL, 0, (Math.floor(i / 3) - 1) * CELL);
const emptyCells = (b) => b.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);

function winnerOf(b) {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a], line: [a, c, d] };
  }
  return null;
}

/* Full minimax: the computer never loses, so it is beatable only by its own mistakes. */
function minimax(b, isAI, depth) {
  const w = winnerOf(b);
  if (w) return { score: w.mark === "O" ? 10 - depth : depth - 10 };
  const empties = emptyCells(b);
  if (!empties.length) return { score: 0 };
  let best = { score: isAI ? -Infinity : Infinity };
  for (const i of empties) {
    b[i] = isAI ? "O" : "X";
    const r = minimax(b, !isAI, depth + 1);
    b[i] = null;
    if (isAI ? r.score > best.score : r.score < best.score) best = { score: r.score, move: i };
  }
  return best;
}

function aiMove(board) {
  const empties = emptyCells(board);
  if (Math.random() < AI_MISTAKE) return empties[Math.floor(Math.random() * empties.length)];
  return minimax(board.slice(), true, 0).move;
}

export function mount(root, { audio } = {}) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Jij (X)</span><span class="hud-value" data-you>0</span></div>
        <div class="hud-item"><span class="hud-label">Computer (O)</span><span class="hud-value" data-ai>0</span></div>
        <div class="hud-item"><span class="hud-label">Gelijk</span><span class="hud-value" data-draw>0</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end">
        <span class="hud-label">Reeks</span>
        <span class="hud-value" data-streak>0</span>
        <span class="hud-label" data-best style="margin-top:6px">Beste reeks: 0</span>
      </div>
    </div>
    <p data-status style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:13px;letter-spacing:.2em;opacity:.85;pointer-events:none;text-align:center;white-space:nowrap">JOUW BEURT · KLIK EEN VAK · SLEEP OM te draaien</p>`;

  const youNode = root.querySelector("[data-you]");
  const aiNode = root.querySelector("[data-ai]");
  const drawNode = root.querySelector("[data-draw]");
  const streakNode = root.querySelector("[data-streak]");
  const bestNode = root.querySelector("[data-best]");
  const statusNode = root.querySelector("[data-status]");

  const rect = root.getBoundingClientRect();
  let width = Math.max(1, rect.width);
  let height = Math.max(1, rect.height);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040b);
  scene.fog = new THREE.FogExp2(0x03040b, 0.02);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 300);
  camera.position.set(0, 11, 12);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.target.set(0, 0, 0);
  controls.minDistance = 9;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.46;

  scene.add(new THREE.AmbientLight(0x8898ff, 0.6));
  const key = new THREE.PointLight(0x9fb4ff, 180, 60);
  key.position.set(-6, 12, 6);
  scene.add(key);

  /* background: starfield, a distant ice planet and an orbit ring */
  const starPos = [];
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(90 + Math.random() * 120);
    starPos.push(v.x, v.y, v.z);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })
  );
  scene.add(stars);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(20, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x3f7fb8, emissive: 0x0b2238, roughness: 0.8 })
  );
  planet.position.set(-45, 22, -70);
  scene.add(planet);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9.5, 0.04, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xc9a7ff, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = Math.PI / 2 - 0.35;
  scene.add(ring);

  /* the floating board */
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 3 + 0.8, 0.3, CELL * 3 + 0.8),
    new THREE.MeshStandardMaterial({ color: 0x0c1028, metalness: 0.8, roughness: 0.25 })
  );
  slab.position.y = -0.2;
  scene.add(slab);

  const railMat = new THREE.MeshBasicMaterial({ color: 0x39e6ff });
  [-0.5, 0.5].forEach((k) => {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, CELL * 3), railMat);
    v.position.set(k * CELL, 0.08, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(CELL * 3, 0.07, 0.07), railMat);
    h.position.set(0, 0.08, k * CELL);
    scene.add(h);
  });

  /* shared geometry and materials for marks */
  const barGeo = new THREE.BoxGeometry(0.26, 0.26, 2.9);
  const ringGeo = new THREE.TorusGeometry(0.75, 0.14, 16, 48);
  const xMat = new THREE.MeshStandardMaterial({ color: 0xffa04d, emissive: 0xff6a1a, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.3 });
  const oMat = new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x2ad6ff, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.3 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 8);

  /* clickable pads, one per cell */
  const pads = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6a7cff,
      emissive: 0x3b4bff,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(CELL - 0.3, 0.1, CELL - 0.3), mat);
    pad.position.copy(cellPos(i)).setY(0.06);
    pad.userData.index = i;
    scene.add(pad);
    pads.push(pad);
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.7, 0.45, 0.25));
  composer.setSize(width, height);

  /* state */
  let board = Array(9).fill(null);
  let marks = [];
  let lineObj = null;
  let over = false;
  let aiTimer = 0;
  let ov = null;
  let you = 0;
  let ai = 0;
  let draws = 0;
  let streak = 0;
  let hovered = -1;
  let downAt = null;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pickPad(event) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pads, false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  function setHover(i) {
    if (hovered === i) return;
    if (hovered >= 0) pads[hovered].material.opacity = 0.16;
    hovered = i;
    if (i >= 0 && !board[i]) pads[i].material.opacity = 0.5;
  }

  function updateHud() {
    youNode.textContent = String(you);
    aiNode.textContent = String(ai);
    drawNode.textContent = String(draws);
    streakNode.textContent = String(streak);
    const best = getBest(BEST_KEY) ?? 0;
    bestNode.textContent = `Beste reeks: ${best}`;
  }

  function setStatus(text) {
    statusNode.textContent = text;
  }

  function placeMark(i, mark) {
    board[i] = mark;
    const group = new THREE.Group();
    if (mark === "X") {
      [Math.PI / 4, -Math.PI / 4].forEach((rot) => {
        const bar = new THREE.Mesh(barGeo, xMat);
        bar.rotation.y = rot;
        group.add(bar);
      });
    } else {
      const o = new THREE.Mesh(ringGeo, oMat);
      o.rotation.x = Math.PI / 2;
      group.add(o);
    }
    group.position.copy(cellPos(i)).setY(0.6);
    group.scale.setScalar(0.001);
    scene.add(group);
    marks.push({ obj: group, t: 0 });
    pads[i].material.opacity = 0.16;
    audio?.blip();
  }

  function drawWinLine(line) {
    const a = cellPos(line[0]);
    const c = cellPos(line[2]);
    const dir = new THREE.Vector3().subVectors(c, a);
    const len = dir.length() + 1.4;
    lineObj = new THREE.Mesh(lineGeo, lineMat);
    lineObj.scale.set(1, len, 1);
    lineObj.position.copy(a).add(c).multiplyScalar(0.5).setY(0.9);
    lineObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    scene.add(lineObj);
  }

  function endRound(mark, line) {
    over = true;
    if (mark === "X") {
      you++;
      streak++;
      if (streak > (getBest(BEST_KEY) ?? 0)) setBest(BEST_KEY, streak);
      audio?.win();
    } else if (mark === "O") {
      ai++;
      streak = 0;
      audio?.miss();
    } else {
      draws++;
      audio?.step();
    }
    if (line) drawWinLine(line);
    updateHud();
    const title = mark === "X" ? "Jij wint!" : mark === "O" ? "De computer wint" : "Gelijkspel";
    const text = mark === "X" ? "Mooi gespeeld. Kan je de reeks vasthouden?" : mark === "O" ? "De computer las je zet. Revanche?" : "Niemand won. Het bord is vol.";
    setStatus("RONDE VOORBIJ · NOG EEN RONDE");
    ov?.close();
    showRoundEnd(title, text);
  }

  function showRoundEnd(title, text) {
    ov = overlay(root, {
      kicker: "RONDE VOORBIJ",
      title,
      text,
      button: "NOG EEN RONDE",
      onClose: () => {
        ov = null;
      },
      onStart: resetBoard,
    });
  }

  function checkEnd() {
    const w = winnerOf(board);
    if (w) {
      endRound(w.mark, w.line);
      return true;
    }
    if (!emptyCells(board).length) {
      endRound(null, null);
      return true;
    }
    return false;
  }

  function humanMove(i) {
    if (over || aiTimer || board[i]) return;
    placeMark(i, "X");
    if (checkEnd()) return;
    setStatus("DE COMPUTER DENKT NA…");
    aiTimer = window.setTimeout(() => {
      aiTimer = 0;
      if (over) return;
      placeMark(aiMove(board), "O");
      if (!checkEnd()) setStatus("JOUW BEURT · KLIK EEN VAK");
    }, AI_DELAY * 1000);
  }

  function resetBoard() {
    marks.forEach((m) => scene.remove(m.obj));
    marks = [];
    if (lineObj) {
      scene.remove(lineObj);
      lineObj = null;
    }
    board = Array(9).fill(null);
    over = false;
    setStatus("JOUW BEURT · KLIK EEN VAK · SLEEP OM te draaien");
  }

  /* input: a click is a pointer-up close to its pointer-down, so orbit drags are ignored */
  const onPointerDown = (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved < 6) humanMove(pickPad(e));
  };
  const onPointerMove = (e) => {
    if (e.pointerType === "mouse") setHover(pickPad(e));
  };
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);

  const ro = new ResizeObserver(() => {
    const r = root.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  ro.observe(root);

  updateHud();

  const stopLoop = loop((dt) => {
    const now = performance.now() / 1000;
    marks.forEach((m) => {
      m.t = Math.min(1, m.t + dt * 2.8);
      const e = 1 - Math.pow(1 - m.t, 3);
      m.obj.scale.setScalar(Math.max(0.001, e));
    });
    pads.forEach((p, i) => {
      if (!board[i] && i !== hovered) p.material.opacity = 0.16 + Math.sin(now * 2 + i) * 0.03;
    });
    if (lineObj) lineObj.material.color.setHSL((now * 0.2) % 1, 0.9, 0.7);
    ring.rotation.z += dt * 0.12;
    stars.rotation.y += dt * 0.01;
    controls.update();
    composer.render();
  });

  return {
    restart: () => {
      streak = 0;
      if (lineObj) {
        scene.remove(lineObj);
        lineObj = null;
      }
      window.clearTimeout(aiTimer);
      aiTimer = 0;
      ov?.close();
      ov = null;
      resetBoard();
      updateHud();
    },
    destroy: () => {
      stopLoop();
      window.clearTimeout(aiTimer);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      controls.dispose();
      ov?.close();
      barGeo.dispose();
      ringGeo.dispose();
      lineGeo.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
