/* Shared helpers for all games. */

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

export function getBest(key) {
  const raw = localStorage.getItem(`astra:best:${key}`);
  return raw === null ? null : Number(raw);
}

export function setBest(key, value) {
  localStorage.setItem(`astra:best:${key}`, String(value));
}

export function formatNumber(n) {
  return n.toLocaleString("nl-NL");
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Race clock: m:ss.cc */
export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

/**
 * Modal overlay inside a game stage.
 * opts: { kicker, title, text, extra, button, onStart, onClose }
 */
export function overlay(root, opts) {
  const node = el("div", "game-overlay");
  node.innerHTML = `
    <div class="ov-card">
      ${opts.kicker ? `<p class="ov-kicker">${opts.kicker}</p>` : ""}
      <h3>${opts.title}</h3>
      ${opts.text ? `<p class="ov-text">${opts.text}</p>` : ""}
      ${opts.extra || ""}
      <button class="btn btn-solid" type="button">${opts.button || "SPELEN"}</button>
    </div>`;

  const button = node.querySelector("button");
  const close = () => {
    if (!node.isConnected) return;
    node.remove();
    opts.onClose?.();
  };

  button.addEventListener("click", () => {
    close();
    opts.onStart?.();
  });

  root.appendChild(node);
  requestAnimationFrame(() => button.focus({ preventScroll: true }));

  return { node, close };
}

/** Simple canvas bootstrap that keeps the drawing surface in sync. */
export function setupCanvas(root) {
  const canvas = el("canvas");
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const state = { width: 0, height: 0, dpr: 1 };

  const resize = () => {
    const rect = root.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(1, Math.round(rect.width));
    state.height = Math.max(1, Math.round(rect.height));
    state.dpr = dpr;
    canvas.width = Math.round(state.width * dpr);
    canvas.height = Math.round(state.height * dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  return { canvas, ctx, state, resize, destroy: () => ro.disconnect() };
}

/** requestAnimationFrame loop with delta in seconds, capped for tab-switches. */
export function loop(callback) {
  let running = true;
  let last = performance.now();
  let id = 0;

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    callback(dt);
    id = requestAnimationFrame(frame);
  };

  id = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(id);
  };
}

/** Pointer position within an element, in CSS pixels. */
export function pointerPos(element, event) {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
