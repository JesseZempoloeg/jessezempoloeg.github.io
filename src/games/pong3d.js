import * as THREE from "three";
import { overlay, getBest, setBest, loop, clamp, lerp, rand } from "./util.js";

const BEST_KEY = "pong3d";
const WIN_SCORE = 5;
const HALF_W = 4.6; // arena half-width (x)
const PZ = 7.3; // player paddle plane (z)
const AZ = -7.3; // computer paddle plane (z)
const PADDLE_HALF = 1.3;
const BALL_R = 0.3;
const MAX_SPEED = 19;
const AI_SPEED = 7.2;
const SERVE_DELAY = 0.9;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Jij</span><span class="hud-value" data-you>0</span></div>
        <div class="hud-item"><span class="hud-label">Computer</span><span class="hud-value" data-ai>0</span></div>
        <div class="hud-item"><span class="hud-label">Rally</span><span class="hud-value" data-rally>0</span></div>
      </div>
      <div class="hud-item" style="align-items:flex-end"><span class="hud-label" data-best>Beste: —</span></div>
    </div>
    <p style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;font-size:12px;letter-spacing:.18em;opacity:.7;pointer-events:none;text-align:center;white-space:nowrap">MUIS / PIJLEN / A D: PADDLE · EERSTE NAAR ${WIN_SCORE} WINT</p>`;

  const youNode = root.querySelector("[data-you]");
  const aiNode = root.querySelector("[data-ai]");
  const rallyNode = root.querySelector("[data-rally]");
  const bestNode = root.querySelector("[data-best]");

  /* ---------- three.js scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05040f);
  scene.fog = new THREE.Fog(0x05040f, 22, 40);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 11, 14);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x8080ff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 12, 6);
  scene.add(key);

  // arena floor with neon grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2 + 1, PZ * 2 + 3),
    new THREE.MeshStandardMaterial({ color: 0x0b0a1f, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(HALF_W * 2, 14, 0x3dfcff, 0x2a1a5a);
  grid.position.y = 0.01;
  grid.scale.set(1, 1, (PZ * 2 + 3) / (HALF_W * 2));
  scene.add(grid);

  // side rails and end lines
  const railMat = new THREE.MeshStandardMaterial({ color: 0xff7ab6, emissive: 0xff7ab6, emissiveIntensity: 0.9 });
  const railGeo = new THREE.BoxGeometry(0.15, 0.2, PZ * 2 + 3);
  for (const x of [-HALF_W, HALF_W]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(x, 0.1, 0);
    scene.add(rail);
  }
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x3dfcff, emissive: 0x3dfcff, emissiveIntensity: 0.8 });
  const centerLine = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2, 0.05, 0.06), lineMat);
  centerLine.position.set(0, 0.03, 0);
  scene.add(centerLine);

  // paddles
  const paddleGeo = new THREE.BoxGeometry(PADDLE_HALF * 2, 0.4, 0.4);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x3dfcff, emissive: 0x3dfcff, emissiveIntensity: 0.7 });
  const aiMat = new THREE.MeshStandardMaterial({ color: 0xff7ab6, emissive: 0xff7ab6, emissiveIntensity: 0.7 });
  const playerPaddle = new THREE.Mesh(paddleGeo, playerMat);
  playerPaddle.position.set(0, 0.2, PZ);
  scene.add(playerPaddle);
  const aiPaddle = new THREE.Mesh(paddleGeo, aiMat);
  aiPaddle.position.set(0, 0.2, AZ);
  scene.add(aiPaddle);

  // ball
  const ballGeo = new THREE.SphereGeometry(BALL_R, 24, 16);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 1.1 });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  scene.add(ball);
  const ballLight = new THREE.PointLight(0xffd166, 6, 9, 1.5);
  scene.add(ballLight);

  // trail
  const TRAIL = 14;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.6 })
  );
  scene.add(trail);
  const trailHist = [];

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
  let state = "idle"; // idle | serve | play | over
  let youScore = 0;
  let aiScore = 0;
  let rally = 0;
  let serveTimer = 0;
  let serveTowardPlayer = true;
  let targetX = 0; // where the player wants the paddle
  let playerX = 0;
  let aiX = 0;
  let keyDir = 0;
  let bx = 0;
  let bz = 0;
  let vx = 0;
  let vz = 0;
  let startBest = 0;
  let ov = null;

  function renderHud() {
    youNode.textContent = String(youScore);
    aiNode.textContent = String(aiScore);
    rallyNode.textContent = String(rally);
  }

  function showBest() {
    bestNode.textContent = `Beste: ${getBest(BEST_KEY) ?? "—"} slagen`;
  }

  function showOverlay(opts) {
    ov?.close();
    ov = overlay(root, { ...opts, onStart: begin });
  }

  function resetBall(towardPlayer) {
    bx = 0;
    bz = 0;
    vx = 0;
    vz = 0;
    rally = 0;
    serveTowardPlayer = towardPlayer;
    serveTimer = SERVE_DELAY;
    state = "serve";
    renderHud();
  }

  function serve() {
    const speed = 9;
    bx = 0;
    bz = 0;
    vx = rand(-3.5, 3.5);
    vz = (serveTowardPlayer ? 1 : -1) * speed;
    state = "play";
  }

  function registerHit() {
    rally++;
    if (rally > (getBest(BEST_KEY) ?? 0)) setBest(BEST_KEY, rally);
  }

  function begin() {
    startBest = getBest(BEST_KEY) ?? 0;
    youScore = 0;
    aiScore = 0;
    playerX = 0;
    targetX = 0;
    aiX = 0;
    trailHist.length = 0;
    resetBall(Math.random() < 0.5);
  }

  function gameOver() {
    state = "over";
    const youWon = youScore > aiScore;
    const best = getBest(BEST_KEY) ?? 0;
    const isBest = best > startBest;
    showBest();
    showOverlay({
      kicker: youWon ? "GEWONNEN" : "VERLOREN",
      title: `${youScore} - ${aiScore}`,
      text: isBest ? `Nieuw record: ${best} slagen op rij!` : `Je beste rally blijft ${best}.`,
      button: "OPNIEUW",
    });
  }

  function point(forPlayer) {
    if (forPlayer) youScore++;
    else aiScore++;
    renderHud();
    if (youScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
      gameOver();
      return;
    }
    resetBall(!forPlayer);
  }

  /* ---------- input ---------- */
  const onPointerMove = (e) => {
    if (state === "over") return;
    const rect = root.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    targetX = clamp((rel - 0.5) * HALF_W * 2, -HALF_W + PADDLE_HALF, HALF_W - PADDLE_HALF);
  };
  const onKeyDown = (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keyDir = -1;
    else if (e.code === "ArrowRight" || e.code === "KeyD") keyDir = 1;
    else return;
    e.preventDefault();
  };
  const onKeyUp = (e) => {
    if ((e.code === "ArrowLeft" || e.code === "KeyA") && keyDir === -1) keyDir = 0;
    if ((e.code === "ArrowRight" || e.code === "KeyD") && keyDir === 1) keyDir = 0;
  };
  root.addEventListener("pointermove", onPointerMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ---------- simulation ---------- */
  function bounceOff(paddleX, dir) {
    const offset = bx - paddleX;
    const speed = Math.min(MAX_SPEED, Math.hypot(vx, vz) + 0.5);
    vz = dir * Math.max(Math.abs(vz), speed * 0.8);
    vx = clamp(vx + offset * 4.2, -9, 9);
    const scale = speed / Math.hypot(vx, vz);
    vx *= scale;
    vz *= scale;
  }

  function step(dt) {
    // player paddle follows target (pointer or keys)
    targetX = clamp(targetX + keyDir * 12 * dt, -HALF_W + PADDLE_HALF, HALF_W - PADDLE_HALF);
    playerX = lerp(playerX, targetX, 1 - Math.exp(-16 * dt));

    // computer paddle tracks the ball with a speed limit
    const aiTarget = clamp(bx, -HALF_W + PADDLE_HALF, HALF_W - PADDLE_HALF);
    const aiStep = AI_SPEED * dt;
    aiX += clamp(aiTarget - aiX, -aiStep, aiStep);

    if (state === "serve") {
      serveTimer -= dt;
      if (serveTimer <= 0) serve();
      return;
    }

    bx += vx * dt;
    bz += vz * dt;

    if (Math.abs(bx) > HALF_W - BALL_R) {
      bx = clamp(bx, -(HALF_W - BALL_R), HALF_W - BALL_R);
      vx = -vx;
    }

    // player paddle plane
    if (bz >= PZ - BALL_R && vz > 0) {
      if (Math.abs(bx - playerX) <= PADDLE_HALF + BALL_R) {
        bz = PZ - BALL_R;
        registerHit();
        bounceOff(playerX, -1);
        renderHud();
      } else if (bz > PZ + 1.6) {
        point(false);
        return;
      }
    }

    // computer paddle plane
    if (bz <= AZ + BALL_R && vz < 0) {
      if (Math.abs(bx - aiX) <= PADDLE_HALF + BALL_R) {
        bz = AZ + BALL_R;
        registerHit();
        bounceOff(aiX, 1);
        renderHud();
      } else if (bz < AZ - 1.6) {
        point(true);
        return;
      }
    }
  }

  /* ---------- loop ---------- */
  const stopLoop = loop((dt) => {
    if (state === "serve" || state === "play") step(dt);

    playerPaddle.position.x = playerX;
    aiPaddle.position.x = aiX;
    ball.position.set(bx, 0.35, bz);
    ballLight.position.set(bx, 1.4, bz);

    // trail history
    trailHist.unshift(new THREE.Vector3(bx, 0.35, bz));
    if (trailHist.length > TRAIL) trailHist.pop();
    for (let i = 0; i < TRAIL; i++) {
      const p = trailHist[Math.min(i, trailHist.length - 1)] ?? ball.position;
      trailPos[i * 3] = p.x;
      trailPos[i * 3 + 1] = p.y;
      trailPos[i * 3 + 2] = p.z;
    }
    trailGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  });

  renderHud();
  showBest();
  showOverlay({
    kicker: "3D · PONG",
    title: "Pong 3D",
    text: `Verdedig je kant met de muis of de pijltjes. De eerste die ${WIN_SCORE} punten haalt wint. Probeer de langste rally.`,
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
      floor.geometry.dispose();
      floor.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      railGeo.dispose();
      railMat.dispose();
      lineMat.dispose();
      centerLine.geometry.dispose();
      paddleGeo.dispose();
      playerMat.dispose();
      aiMat.dispose();
      ballGeo.dispose();
      ballMat.dispose();
      trailGeo.dispose();
      trail.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
