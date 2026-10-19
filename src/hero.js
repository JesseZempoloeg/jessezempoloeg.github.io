import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const NEON = [0xff3d9a, 0x3dfcff, 0xffe14d, 0x7dff5a, 0x9b6bff, 0xff7a3d, 0x4d8dff, 0xff4d6d];

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
function glowTexture() {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const EMBLEMS = [
  () => new THREE.TorusGeometry(0.28, 0.1, 16, 40),
  () => new THREE.OctahedronGeometry(0.36),
  () => new THREE.ConeGeometry(0.3, 0.6, 4),
  () => new THREE.TorusKnotGeometry(0.22, 0.07, 90, 12),
  () => new THREE.DodecahedronGeometry(0.33),
  () => new THREE.BoxGeometry(0.42, 0.42, 0.42),
  () => new THREE.CylinderGeometry(0.1, 0.3, 0.6, 6),
  () => new THREE.IcosahedronGeometry(0.36, 0),
];

/* ------------------------------------------------------------------
   Scene
   ------------------------------------------------------------------ */
export class HeroScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
    this.bursts = [];
    this.running = false;
    this.ok = this.init();
    if (this.ok) {
      this.resize();
      this.bind();
      this.start();
    }
  }

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (err) {
      console.warn("WebGL niet beschikbaar — statische achtergrond gebruikt.", err);
      return false;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05020f);
    this.scene.fog = new THREE.Fog(0x05020f, 24, 72);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 2.2, 17);

    this.scene.add(new THREE.AmbientLight(0x7a6cff, 0.4));
    this.coreLight = new THREE.PointLight(0x3dfcff, 80, 40, 2);
    this.coreLight.position.set(0, 1.2, 4);
    this.scene.add(this.coreLight);
    const sideLight = new THREE.PointLight(0xff3d9a, 60, 40, 2);
    sideLight.position.set(-9, 4, 6);
    this.scene.add(sideLight);

    this.glow = glowTexture();
    this.buildGrid();
    this.buildCore();
    this.buildRings();
    this.buildTiles();
    this.buildParticles();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.18));
    this.composer.addPass(new OutputPass());
    return true;
  }

  buildGrid() {
    // neon floor that scrolls toward the viewer
    this.grid = new THREE.GridHelper(160, 64, 0x3dfcff, 0x7a2bd6);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.34;
    this.grid.material.depthWrite = false;
    this.grid.position.y = -5.4;
    this.scene.add(this.grid);
  }

  buildCore() {
    this.core = new THREE.Group();
    this.core.position.set(0, 1.2, 0);

    this.coreBody = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.4, 5),
      new THREE.MeshStandardMaterial({
        color: 0x140833,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x3a0f6e,
        emissiveIntensity: 0.7,
        flatShading: true,
      })
    );

    this.coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.6, 2),
      new THREE.MeshBasicMaterial({ color: 0x3dfcff, wireframe: true, transparent: true, opacity: 0.32 })
    );

    this.shellMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(0x3dfcff) },
        uB: { value: new THREE.Color(0xff3d9a) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uA;
        uniform vec3 uB;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + vN.y * 6.0);
          vec3 col = mix(uA, uB, pulse);
          gl_FragColor = vec4(col, fres * 0.95);
        }
      `,
    });
    this.coreShell = new THREE.Mesh(new THREE.SphereGeometry(3.1, 64, 48), this.shellMat);

    this.core.add(this.coreBody, this.coreWire, this.coreShell);
    this.scene.add(this.core);
  }

  buildRings() {
    this.rings = [];
    [
      { r: 4.4, tilt: 1.2, roll: 0.3, color: 0x3dfcff, speed: 0.35 },
      { r: 5.8, tilt: 0.5, roll: 1.4, color: 0xff3d9a, speed: -0.25 },
      { r: 7.2, tilt: 1.45, roll: -0.7, color: 0xffe14d, speed: 0.18 },
    ].forEach(({ r, tilt, roll, color, speed }) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.03, 8, 260),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
      );
      ring.rotation.set(tilt, 0, roll);
      ring.userData.speed = speed;
      this.core.add(ring);
      this.rings.push(ring);
    });
  }

  buildTiles() {
    // eight floating 3D "game cards", each with its own emblem
    this.tiles = NEON.map((color, i) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(1.25, 1.25, 0.22, 4, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x0c0716, metalness: 0.6, roughness: 0.35 })
      );
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25, 1.25, 0.22)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })
      );
      const emblem = new THREE.Mesh(
        EMBLEMS[i](),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.3 })
      );
      emblem.position.z = 0.22;
      group.add(body, edges, emblem);
      this.scene.add(group);
      return {
        group,
        emblem,
        angle: (i / NEON.length) * Math.PI * 2,
        phase: i * 0.8,
        spin: 0.6 + (i % 3) * 0.3,
      };
    });
  }

  buildParticles() {
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 14 + Math.random() * 38;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      color.setHex(NEON[(Math.random() * NEON.length) | 0]);
      const b = 0.55 + Math.random() * 0.45;
      colors[i * 3] = color.r * b;
      colors[i * 3 + 1] = color.g * b;
      colors[i * 3 + 2] = color.b * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.2,
      map: this.glow,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  /** Expanding neon shockwave from the core, spawned on click. */
  burst() {
    if (!this.ok || prefersReduced) return;
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 96),
      new THREE.MeshBasicMaterial({
        color: NEON[(Math.random() * NEON.length) | 0],
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    mesh.position.copy(this.core.position);
    this.scene.add(mesh);
    this.bursts.push({ mesh, life: 0 });
  }

  bind() {
    this.onPointer = (e) => {
      this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", this.onPointer, { passive: true });

    this.onDown = () => this.burst();
    window.addEventListener("pointerdown", this.onDown, { passive: true });

    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);

    this.onVisibility = () => {
      if (document.hidden) this.stop();
      else this.start();
    };
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  resize() {
    if (!this.renderer) return;
    const w = document.documentElement.clientWidth || window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;

    // pull the camera back on narrow screens so the whole scene still reads
    const narrow = Math.min(1, w / 1100);
    this.camera.position.z = 17 + (1 - narrow) * 8;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (!this.ok || this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  frame(dt) {
    const t = performance.now() * 0.001;
    const k = prefersReduced ? 0 : 1;

    this.pointer.x += (this.target.x - this.pointer.x) * 0.05;
    this.pointer.y += (this.target.y - this.pointer.y) * 0.05;
    this.camera.position.x = this.pointer.x * 2.4;
    this.camera.position.y = 2.2 - this.pointer.y * 1.2;
    this.camera.lookAt(0, 0.6, 0);

    // core: breathing body, counter-rotating wireframe, pulsing shell
    const pulse = 1 + Math.sin(t * 2) * 0.035 * k;
    this.coreBody.rotation.y += dt * 0.15 * k;
    this.coreWire.rotation.y -= dt * 0.12 * k;
    this.coreWire.rotation.x += dt * 0.05 * k;
    this.coreBody.scale.setScalar(pulse);
    this.coreWire.scale.setScalar(pulse);
    this.shellMat.uniforms.uTime.value = t;
    this.coreLight.intensity = 70 + Math.sin(t * 2) * 25;

    for (const ring of this.rings) ring.rotation.z += dt * ring.userData.speed * k;

    // floating game tiles orbit the core
    for (const tile of this.tiles) {
      const a = tile.angle + t * 0.08 * k;
      tile.group.position.set(
        Math.cos(a) * 8.6,
        1.2 + Math.sin(a * 2 + tile.phase) * 0.9,
        Math.sin(a) * 3.4 - 1
      );
      tile.group.rotation.y = -Math.sin(a) * 0.55;
      tile.group.rotation.z = Math.sin(t * 0.7 + tile.phase) * 0.06;
      tile.emblem.rotation.x += dt * tile.spin * k;
      tile.emblem.rotation.y += dt * tile.spin * 1.3 * k;
    }

    // scrolling neon grid (the cell size is 160 / 64 = 2.5)
    this.grid.position.z = (t * 2.2 * k) % 2.5;
    this.particles.rotation.y = t * 0.015 * k;

    // click shockwaves
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life += dt;
      const s = 1 + b.life * 14;
      b.mesh.scale.set(s, s, s);
      b.mesh.material.opacity = Math.max(0, 1 - b.life * 1.3);
      if (b.life > 0.8) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.bursts.splice(i, 1);
      }
    }

    this.composer.render();
  }
}
