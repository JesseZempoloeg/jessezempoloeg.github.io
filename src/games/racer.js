import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { overlay, getBest, setBest, clamp, loop, formatClock } from "./util.js";

const LAPS = 3;
const ROAD_HALF = 4.2;
const MAX_SPEED = 64;
const BEST_KEY = "racer";
const UP = new THREE.Vector3(0, 1, 0);

/* A closed, gently undulating loop through polar control points (never self-intersects). */
function buildTrack() {
  const pts = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 130 + 40 * Math.sin(3 * a) + 18 * Math.cos(5 * a + 1);
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 2) * 7, Math.sin(a) * r * 0.72));
  }
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
}

function sideOffset(curve, t, offset) {
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const right = new THREE.Vector3().crossVectors(tan, UP).normalize();
  return { p, tan, right, point: p.clone().addScaledVector(right, offset) };
}

function buildRoad(curve, segs) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const l = sideOffset(curve, t, -ROAD_HALF).point;
    const r = sideOffset(curve, t, ROAD_HALF).point;
    pos.push(l.x, l.y - 0.05, l.z, r.x, r.y - 0.05, r.z);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function neonEdge(curve, offset, color, segs = 400) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const { point } = sideOffset(curve, i / segs, offset);
    pts.push(new THREE.Vector3(point.x, point.y + 0.08, point.z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
}

function makeCar(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.6,
    roughness: 0.3,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 3.4), paint);
  body.position.y = 0.9;
  g.add(body);
  const glass = new THREE.MeshStandardMaterial({ color: 0x080a12, metalness: 0.9, roughness: 0.05 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 1.6), glass);
  cabin.position.set(0, 1.25, -0.2);
  g.add(cabin);
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2d55 });
  [-0.62, 0.62].forEach((x) => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), tail);
    light.position.set(x, 0.95, -1.72);
    g.add(light);
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x15171f, roughness: 0.9 });
  [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]].forEach(([sx, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 0.95, 0.4, z);
    g.add(w);
  });
  return g;
}

export function mount(root, { audio } = {}) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value" data-time>0:00.00</span></div>
        <div class="hud-item"><span class="hud-label">Ronde</span><span class="hud-value" data-lap>1/${LAPS}</span></div>
        <div class="hud-item"><span class="hud-label">Positie</span><span class="hud-value" data-pos>1/3</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end">
        <span class="hud-label">Snelheid</span>
        <span class="hud-value" data-speed>0 km/u</span>
        <span class="hud-label" data-best style="margin-top:6px">Beste: —</span>
      </div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">PIJLEN / A D STUREN · S REMMEN · TELEFOON: LINKS / RECHTS TIKKEN</p>`;

  const timeNode = root.querySelector("[data-time]");
  const lapNode = root.querySelector("[data-lap]");
  const posNode = root.querySelector("[data-pos]");
  const speedNode = root.querySelector("[data-speed]");
  const bestNode = root.querySelector("[data-best]");

  const curve = buildTrack();
  const L = curve.getLength();

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const rect = root.getBoundingClientRect();
  let width = Math.max(1, rect.width);
  let height = Math.max(1, rect.height);
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03030a);
  scene.fog = new THREE.FogExp2(0x0a0820, 0.0042);

  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 2000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xbfd8ff, 2.2);
  sun.position.set(-80, 120, 60);
  scene.add(sun);

  /* scenery: stars and a distant gas giant */
  const starPos = [];
  for (let i = 0; i < 2600; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(500 + Math.random() * 600);
    starPos.push(v.x, v.y, v.z);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })
  );
  scene.add(stars);
  const giant = new THREE.Mesh(
    new THREE.SphereGeometry(180, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xd9a066, emissive: 0x3a1d08, roughness: 0.9 })
  );
  giant.position.set(-520, 180, -620);
  scene.add(giant);

  /* track */
  const road = new THREE.Mesh(
    buildRoad(curve, 500),
    new THREE.MeshStandardMaterial({ color: 0x14152a, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide })
  );
  scene.add(road);
  scene.add(neonEdge(curve, -ROAD_HALF - 0.2, 0x39e6ff));
  scene.add(neonEdge(curve, ROAD_HALF + 0.2, 0xff4fd8));

  const PAD_FRACS = [0.18, 0.46, 0.73];
  const padMat = new THREE.MeshBasicMaterial({ color: 0x7cff9a, transparent: true, opacity: 0.85 });
  PAD_FRACS.forEach((f) => {
    const { p, tan } = sideOffset(curve, f, 0);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 6), padMat);
    pad.position.copy(p).add(new THREE.Vector3(0, 0.12, 0));
    pad.lookAt(pad.position.clone().add(tan));
    scene.add(pad);
  });
  const PAD_S = PAD_FRACS.map((f) => f * L);

  /* cars */
  const holder = new THREE.Group();
  const playerCar = makeCar(0x39e6ff);
  holder.add(playerCar);
  scene.add(holder);

  const rivals = [0xff8a4c, 0xffe066].map((color, i) => ({
    car: makeCar(color),
    s: 0,
    x: i === 0 ? -1.8 : 1.8,
    base: 46 + i * 5,
    wob: Math.random() * 6,
  }));
  rivals.forEach((r) => scene.add(r.car));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.5, 0.35));
  composer.setSize(width, height);

  /* state */
  let s = 0;
  let v = 0;
  let x = 0;
  let steer = 0;
  let boostT = 0;
  let time = 0;
  let running = false;
  let camPos = null;
  let touchSteer = 0;
  let ov = null;
  const keys = { left: false, right: false, brake: false };

  function place(obj, dist, lateral) {
    const t = (((dist % L) + L) % L) / L;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3().crossVectors(tan, UP).normalize();
    obj.position.copy(p).addScaledVector(right, lateral);
    obj.lookAt(obj.position.clone().add(tan));
    return { tan, right, pos: obj.position };
  }

  function wrapDelta(a, b) {
    let d = (((a % L) + L) % L) - b;
    if (d > L / 2) d -= L;
    if (d < -L / 2) d += L;
    return d;
  }

  function showStart() {
    ov?.close();
    ov = overlay(root, {
      kicker: "3D · RACE",
      title: "Nebula Rush",
      text: `${LAPS} rondes over de melkweg. Pak de groene boost-strips voor extra snelheid. Haal rivalen in!`,
      button: "START",
      onStart: startRace,
    });
  }

  function reset() {
    s = 0;
    v = 0;
    x = 0;
    steer = 0;
    boostT = 0;
    time = 0;
    running = false;
    rivals.forEach((r, i) => (r.s = -(i + 1) * 9));
  }

  function startRace() {
    ov?.close();
    ov = null;
    running = true;
    audio?.blip();
  }

  function finish() {
    running = false;
    const cs = Math.round(time * 100);
    const prev = getBest(BEST_KEY);
    const isBest = prev === null || cs < prev;
    if (isBest) setBest(BEST_KEY, cs);
    audio?.win();
    ov?.close();
    ov = overlay(root, {
      kicker: "FINISH",
      title: `Tijd: ${formatClock(time)}`,
      text: isBest ? "Nieuw record! De melkweg staat op zijn kop." : "Goed gereden. Probeer de boost-strips nog beter te pakken.",
      button: "OPNIEUW",
      onStart: () => {
        reset();
        startRace();
      },
    });
    updateBest();
  }

  function updateBest() {
    const best = getBest(BEST_KEY);
    bestNode.textContent = best === null ? "Beste: —" : `Beste: ${formatClock(best / 100)}`;
  }

  /* input */
  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.brake = true;
    if (e.key.startsWith("Arrow")) e.preventDefault();
  };
  const onKeyUp = (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.brake = false;
  };
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return;
    const r = root.getBoundingClientRect();
    touchSteer = e.clientX < r.left + r.width / 2 ? -1 : 1;
  };
  const onPointerUp = () => {
    touchSteer = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);

  /* sizing */
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

  /* update */
  function update(dt) {
    if (running) {
      time += dt;
      const offRoad = Math.abs(x) > ROAD_HALF;
      let target = keys.brake ? 12 : MAX_SPEED * (boostT > 0 ? 1.25 : 1);
      if (offRoad) target *= 0.55;
      v += (target - v) * Math.min(1, dt * (target > v ? 0.7 : 2.5));

      const steerIn = clamp((keys.left ? -1 : 0) + (keys.right ? 1 : 0) + touchSteer, -1, 1);
      steer += (steerIn - steer) * Math.min(1, dt * 10);
      x = clamp(x + steer * dt * (5 + v * 0.07), -(ROAD_HALF + 1.6), ROAD_HALF + 1.6);

      s += v * dt;
      boostT -= dt;
      PAD_S.forEach((sp) => {
        if (Math.abs(wrapDelta(s, sp)) < 4 && Math.abs(x) < ROAD_HALF) boostT = 1.4;
      });

      rivals.forEach((r, i) => {
        r.s += (r.base + Math.sin(time * 0.7 + r.wob) * 3) * dt;
      });

      const ahead = rivals.filter((r) => r.s > s).length;
      posNode.textContent = `${ahead + 1}/${rivals.length + 1}`;
      lapNode.textContent = `${Math.min(LAPS, Math.floor(s / L) + 1)}/${LAPS}`;

      if (s >= LAPS * L) finish();
    }

    const car = place(holder, s, x);
    playerCar.rotation.z = -steer * 0.14;
    rivals.forEach((r) => place(r.car, r.s, r.x));

    const desired = car.pos
      .clone()
      .addScaledVector(car.tan, -9.5)
      .addScaledVector(UP, 3.8)
      .addScaledVector(car.right, x * 0.25);
    if (!camPos) camPos = desired.clone();
    camPos.lerp(desired, 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(car.pos.clone().addScaledVector(car.tan, 6).addScaledVector(UP, 1));

    stars.rotation.y += dt * 0.004;
    giant.rotation.y += dt * 0.01;
    speedNode.textContent = `${Math.round(v * 3.6)} km/u`;
    timeNode.textContent = formatClock(time);
  }

  reset();
  updateBest();
  showStart();

  const stopLoop = loop((dt) => {
    update(dt);
    composer.render();
  });

  return {
    restart: () => {
      reset();
      camPos = null;
      showStart();
    },
    destroy: () => {
      stopLoop();
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
      ov?.close();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
