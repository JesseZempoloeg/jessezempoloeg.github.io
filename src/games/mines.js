import { audio } from "../audio.js";
import { overlay, getBest, setBest, setupCanvas, loop, formatClock } from "./util.js";

const COLS = 10;
const ROWS = 10;
const MINES = 14;
const LONG_PRESS = 340;

const NUMBER_COLORS = {
  1: "#8fd8ff",
  2: "#8ef5b0",
  3: "#ff9d6e",
  4: "#c9a7ff",
  5: "#ffe14d",
  6: "#3dfcff",
  7: "#ffb3e6",
  8: "#f4efe6",
};

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value" data-time>0:00.00</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>—</span></div>
      </div>
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Vlaggen over</span><span class="hud-value accent" data-flags>${MINES}</span></div>
      </div>
    </div>`;

  const timeNode = root.querySelector("[data-time]");
  const bestNode = root.querySelector("[data-best]");
  const flagsNode = root.querySelector("[data-flags]");

  const { canvas, ctx, state } = setupCanvas(root);

  let cells = [];
  let status = "intro"; // intro | playing | won | lost
  let startedAt = 0;
  let elapsed = 0;
  let flags = 0;
  let hover = null;
  let modal = null;
  let shakeUntil = 0;
  let pulse = 0;
  let best = getBest("mines");

  const paintBest = () => {
    bestNode.textContent = best === null ? "—" : formatClock(best / 100);
  };
  paintBest();

  /* ---------------- board ---------------- */

  function reset() {
    modal?.close();
    modal = null;
    cells = Array.from({ length: ROWS * COLS }, () => ({ mine: false, around: 0, open: false, flag: false }));
    status = "intro";
    startedAt = 0;
    elapsed = 0;
    flags = 0;
    hover = null;
    timeNode.textContent = "0:00.00";
    flagsNode.textContent = String(MINES);
  }

  const at = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? null : cells[y * COLS + x]);

  function neighbours(x, y) {
    const list = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const cell = at(x + dx, y + dy);
        if (cell) list.push(cell);
      }
    }
    return list;
  }

  function plant(safeX, safeY) {
    let placed = 0;
    while (placed < MINES) {
      const x = Math.floor(Math.random() * COLS);
      const y = Math.floor(Math.random() * ROWS);
      // first click always opens a pocket of empty cells
      if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
      const cell = at(x, y);
      if (!cell || cell.mine) continue;
      cell.mine = true;
      placed++;
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = at(x, y);
        cell.around = neighbours(x, y).filter((n) => n.mine).length;
      }
    }
  }

  function open(x, y) {
    const cell = at(x, y);
    if (!cell || cell.open || cell.flag || status === "won" || status === "lost") return false;

    if (status === "intro") {
      plant(x, y);
      status = "playing";
      startedAt = performance.now();
    }

    if (cell.mine) {
      cell.open = true;
      lose();
      return true;
    }

    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const node = at(cx, cy);
      if (!node || node.open || node.flag || node.mine) continue;
      node.open = true;
      if (node.around === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            stack.push([cx + dx, cy + dy]);
          }
        }
      }
    }

    audio.step();
    checkWin();
    return true;
  }

  function toggleFlag(x, y) {
    const cell = at(x, y);
    if (!cell || cell.open || status === "won" || status === "lost") return;
    if (status === "intro") return;
    cell.flag = !cell.flag;
    flags += cell.flag ? 1 : -1;
    flagsNode.textContent = String(Math.max(0, MINES - flags));
    audio.blip();
  }

  function hiddenLeft() {
    return cells.filter((c) => !c.open && !c.mine).length;
  }

  function checkWin() {
    if (hiddenLeft() > 0) return;
    status = "won";
    const ms = performance.now() - startedAt;
    elapsed = ms;
    const centi = Math.round(ms / 10);
    const record = best === null || centi < best;
    if (record) {
      best = centi;
      setBest("mines", centi);
      paintBest();
    }
    timeNode.textContent = formatClock(centi / 100);
    audio.win();
    modal = overlay(root, {
      kicker: record ? "NIEUW RECORD" : "VELD VRIJ",
      title: "Alle vakjes open",
      text: "Je ruimde het mijnenveld zonder er één te raken.",
      extra: `<div class="ov-stat">
        <div><span>Tijd</span><span>${formatClock(centi / 100)}</span></div>
        <div><span>Beste</span><span>${best === null ? "—" : formatClock(best / 100)}</span></div>
      </div>`,
      button: "OPNIEUW",
      onStart: reset,
    });
  }

  function lose() {
    status = "lost";
    shakeUntil = performance.now() + 320;
    audio.hit();
    for (const cell of cells) if (cell.mine) cell.open = true;
    modal = overlay(root, {
      kicker: "BOEM",
      title: "Een mijn",
      text: "Volgende keer beter tellen. Je kunt het veld ook markeren met vlaggen.",
      extra: `<div class="ov-keys"><span class="kbd">VASTHOUDEN = VLAG</span></div>`,
      button: "OPNIEUW",
      onStart: reset,
    });
  }

  /* ---------------- layout ---------------- */

  function geometry() {
    const pad = Math.min(state.width, state.height) * 0.08;
    const avail = Math.min(state.width - pad * 2, state.height - pad * 2);
    const cell = Math.floor(Math.max(18, avail / COLS));
    const size = cell * COLS;
    return {
      cell,
      size,
      x: (state.width - size) / 2,
      y: (state.height - size) / 2,
    };
  }

  function cellAt(px, py) {
    const g = geometry();
    const x = Math.floor((px - g.x) / g.cell);
    const y = Math.floor((py - g.y) / g.cell);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
  }

  /* ---------------- drawing ---------------- */

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawMine(cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = "#ff9d6e";
    ctx.fillStyle = "#ff9d6e";
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    const g = geometry();
    const now = performance.now();
    pulse += 0.016;

    ctx.clearRect(0, 0, state.width, state.height);

    const shaking = now < shakeUntil;
    const shake = shaking ? Math.sin(now / 18) * 5 : 0;

    // soft board glow
    const grad = ctx.createRadialGradient(state.width / 2, state.height / 2, 0, state.width / 2, state.height / 2, g.size * 0.9);
    grad.addColorStop(0, "rgba(143,216,255,0.07)");
    grad.addColorStop(1, "rgba(143,216,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.translate(shake, 0);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = at(x, y);
        const px = g.x + x * g.cell;
        const py = g.y + y * g.cell;
        const s = g.cell - 3;
        const isHover = hover && hover.x === x && hover.y === y && !cell.open;

        if (cell.open) {
          if (cell.mine) {
            ctx.fillStyle = "rgba(255,157,110,0.16)";
            roundRect(px + 1.5, py + 1.5, s, s, 4);
            ctx.fill();
            drawMine(px + g.cell / 2, py + g.cell / 2, g.cell * 0.5);
          } else {
            ctx.fillStyle = "rgba(143,216,255,0.05)";
            roundRect(px + 1.5, py + 1.5, s, s, 4);
            ctx.fill();
            ctx.strokeStyle = "rgba(143,216,255,0.07)";
            ctx.lineWidth = 1;
            ctx.stroke();
            if (cell.around > 0) {
              ctx.fillStyle = NUMBER_COLORS[cell.around] || "#f4efe6";
              ctx.font = `${Math.round(g.cell * 0.56)}px ui-sans-serif, system-ui, sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(cell.around), px + g.cell / 2, py + g.cell / 2 + 1);
            }
          }
          continue;
        }

        // closed tile
        ctx.fillStyle = isHover ? "rgba(143,216,255,0.24)" : "rgba(255,255,255,0.085)";
        roundRect(px + 1.5, py + 1.5, s, s, 4);
        ctx.fill();
        ctx.strokeStyle = isHover ? "rgba(143,216,255,0.75)" : "rgba(255,255,255,0.17)";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (cell.flag) {
          const cx = px + g.cell / 2;
          const cy = py + g.cell / 2;
          ctx.strokeStyle = "rgba(244,239,230,0.7)";
          ctx.lineWidth = Math.max(1.2, g.cell * 0.05);
          ctx.beginPath();
          ctx.moveTo(cx - g.cell * 0.1, cy - g.cell * 0.24);
          ctx.lineTo(cx - g.cell * 0.1, cy + g.cell * 0.24);
          ctx.stroke();
          ctx.fillStyle = "#8fd8ff";
          ctx.beginPath();
          ctx.moveTo(cx - g.cell * 0.1, cy - g.cell * 0.24);
          ctx.lineTo(cx + g.cell * 0.22, cy - g.cell * 0.11);
          ctx.lineTo(cx - g.cell * 0.1, cy + g.cell * 0.02);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /* ---------------- input ---------------- */

  let pressTimer = 0;
  let pressed = null;
  let moved = false;

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const clearPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = 0;
    pressed = null;
  };

  const onPointerDown = (event) => {
    if (event.button === 2) return;
    const point = localPoint(event);
    const hit = cellAt(point.x, point.y);
    if (!hit) return;
    pressed = hit;
    moved = false;
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      if (pressed && !moved) {
        toggleFlag(pressed.x, pressed.y);
        clearPress();
      }
    }, LONG_PRESS);
  };

  const onPointerMove = (event) => {
    const point = localPoint(event);
    const hit = cellAt(point.x, point.y);
    hover = hit;
    if (pressed && (!hit || hit.x !== pressed.x || hit.y !== pressed.y)) moved = true;
  };

  const onPointerUp = (event) => {
    const point = localPoint(event);
    const hit = cellAt(point.x, point.y);
    const wasLong = !pressed || moved;
    clearPress();
    if (!hit) return;
    if (event.button === 2) return;
    if (wasLong) return;
    open(hit.x, hit.y);
  };

  const onContextMenu = (event) => {
    event.preventDefault();
    const point = localPoint(event);
    const hit = cellAt(point.x, point.y);
    if (hit) toggleFlag(hit.x, hit.y);
  };

  const onLeave = () => {
    hover = null;
    clearPress();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("contextmenu", onContextMenu);

  const stop = loop(() => {
    if (status === "playing") {
      timeNode.textContent = formatClock((performance.now() - startedAt) / 1000);
    }
    draw();
  });

  reset();
  modal = overlay(root, {
    kicker: "MIJNENVELD",
    title: "Tien bij tien, veertien mijnen",
    text: "Klik om een vakje te openen. Houd vast of rechtermuisklik om een vlag te zetten. De eerste klik is altijd veilig.",
    extra: `<div class="ov-keys"><span class="kbd">KLIK</span><span class="kbd">VASTHOUDEN</span></div>`,
    button: "BEGIN",
    onStart: () => {
      modal = null;
      audio.blip();
    },
  });

  return {
    restart: reset,
    destroy: () => {
      stop();
      clearPress();
      modal?.close();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("contextmenu", onContextMenu);
    },
  };
}
