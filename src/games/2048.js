import { audio } from "../audio.js";
import { overlay, getBest, setBest, formatNumber } from "./util.js";

const SIZE = 4;
const CELL = 21.5;
const STEP = 23.5;
const PAD = 3.75;

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Score</span><span class="hud-value" data-score>0</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>0</span></div>
      </div>
    </div>
    <div class="g2048">
      <div class="board2048" data-board></div>
    </div>`;

  const scoreNode = root.querySelector("[data-score]");
  const bestNode = root.querySelector("[data-best]");
  const board = root.querySelector("[data-board]");

  let nextId = 1;
  let tiles = [];
  let score = 0;
  let best = getBest("2048") ?? 0;
  let won = false;
  let over = false;
  let modal = null;
  let locked = false;

  bestNode.textContent = formatNumber(best);

  // board cells
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell2048";
      cell.style.left = `${PAD + c * STEP}%`;
      cell.style.top = `${PAD + r * STEP}%`;
      board.appendChild(cell);
    }
  }

  const nodes = new Map();

  function valueClass(value) {
    if (value > 2048) return "vbeyond";
    return `v${value}`;
  }

  function updateScore() {
    scoreNode.textContent = formatNumber(score);
    if (score > best) best = score;
    bestNode.textContent = formatNumber(best);
  }

  function render() {
    const alive = new Set();

    for (const tile of tiles) {
      alive.add(tile.id);
      let node = nodes.get(tile.id);
      if (!node) {
        node = document.createElement("div");
        nodes.set(tile.id, node);
        board.appendChild(node);
      }
      node.style.left = `${PAD + tile.c * STEP}%`;
      node.style.top = `${PAD + tile.r * STEP}%`;
      node.textContent = tile.value;
      node.className = `tile2048 ${valueClass(tile.value)}${tile.isNew ? " new" : ""}${tile.merged ? " merged" : ""}`;

      if (tile.isNew || tile.merged) {
        const isNew = tile.isNew;
        const isMerged = tile.merged;
        tile.isNew = false;
        tile.merged = false;
        window.setTimeout(() => {
          if (isNew) node.classList.remove("new");
          if (isMerged) node.classList.remove("merged");
        }, 260);
      }
    }

    for (const [id, node] of nodes) {
      if (!alive.has(id)) {
        node.remove();
        nodes.delete(id);
      }
    }
  }

  function emptyCells() {
    const list = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!tiles.some((t) => t.r === r && t.c === c)) list.push({ r, c });
      }
    }
    return list;
  }

  function addRandom() {
    const cells = emptyCells();
    if (!cells.length) return;
    const cell = cells[Math.floor(Math.random() * cells.length)];
    tiles.push({
      id: nextId++,
      value: Math.random() < 0.9 ? 2 : 4,
      r: cell.r,
      c: cell.c,
      isNew: true,
      merged: false,
    });
  }

  function at(r, c) {
    return tiles.find((t) => t.r === r && t.c === c);
  }

  function lineCoords(dir) {
    const lines = [];
    if (dir === "left" || dir === "right") {
      for (let r = 0; r < SIZE; r++) {
        const line = [];
        for (let i = 0; i < SIZE; i++) {
          const c = dir === "left" ? i : SIZE - 1 - i;
          line.push({ r, c });
        }
        lines.push(line);
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        const line = [];
        for (let i = 0; i < SIZE; i++) {
          const r = dir === "up" ? i : SIZE - 1 - i;
          line.push({ r, c });
        }
        lines.push(line);
      }
    }
    return lines;
  }

  function move(dir) {
    if (over) return;
    let changed = false;
    const removed = new Set();

    for (const line of lineCoords(dir)) {
      const items = [];
      for (const coord of line) {
        const tile = at(coord.r, coord.c);
        if (tile) items.push(tile);
      }

      const result = [];
      for (let i = 0; i < items.length; i++) {
        const tile = items[i];
        const next = items[i + 1];
        if (next && next.value === tile.value) {
          tile.value *= 2;
          tile.merged = true;
          score += tile.value;
          removed.add(next.id);
          i++;
          changed = true;
        }
        result.push(tile);
      }

      result.forEach((tile, index) => {
        const target = line[index];
        if (tile.r !== target.r || tile.c !== target.c) changed = true;
        tile.r = target.r;
        tile.c = target.c;
      });
    }

    if (removed.size) {
      tiles = tiles.filter((t) => !removed.has(t.id));
      for (const id of removed) {
        const node = nodes.get(id);
        if (node) {
          node.remove();
          nodes.delete(id);
        }
      }
    }

    if (!changed) return;

    audio.step();
    addRandom();
    updateScore();
    render();

    if (!won && tiles.some((t) => t.value >= 2048)) {
      won = true;
      audio.win();
      modal = overlay(root, {
        kicker: "JE HEBT HET GEDAAN",
        title: "2048",
        text: "De mythische tegel. Ga je door voor 4096?",
        button: "DOORGAAN",
        onStart: () => {
          modal = null;
        },
      });
      return;
    }

    if (isStuck()) {
      over = true;
      setBest("2048", best);
      modal = overlay(root, {
        kicker: "BORD VOL",
        title: "Geen zet meer mogelijk",
        text: `Je eindigde met <strong>${formatNumber(score)}</strong> punten.`,
        extra: `<div class="ov-stat">
          <div><span>Score</span><span>${formatNumber(score)}</span></div>
          <div><span>Beste</span><span>${formatNumber(best)}</span></div>
        </div>`,
        button: "OPNIEUW",
        onStart: reset,
      });
    }
  }

  function isStuck() {
    if (emptyCells().length) return false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const tile = at(r, c);
        const right = at(r, c + 1);
        const down = at(r + 1, c);
        if (right && right.value === tile.value) return false;
        if (down && down.value === tile.value) return false;
      }
    }
    return true;
  }

  function reset() {
    modal?.close();
    modal = null;
    tiles = [];
    score = 0;
    won = false;
    over = false;
    locked = false;
    for (const node of nodes.values()) node.remove();
    nodes.clear();
    addRandom();
    addRandom();
    updateScore();
    render();
    audio.blip();
  }

  reset();
  modal = overlay(root, {
    kicker: "2048",
    title: "Schuif naar de mythe",
    text: "Beweeg met de pijltjes, WASD of een veeg. Tegels met hetzelfde getal smelten samen.",
    extra: `<div class="ov-keys">
      <span class="kbd">← ↑ ↓ →</span><span class="kbd">WASD</span><span class="kbd">VEEG</span>
    </div>`,
    button: "BEGIN",
    onStart: () => {
      modal = null;
      audio.blip();
    },
  });

  const onKeyDown = (event) => {
    const k = event.key.toLowerCase();
    if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) return;
    event.preventDefault();
    if (k === "arrowleft" || k === "a") move("left");
    if (k === "arrowright" || k === "d") move("right");
    if (k === "arrowup" || k === "w") move("up");
    if (k === "arrowdown" || k === "s") move("down");
  };
  window.addEventListener("keydown", onKeyDown);

  let start = null;
  const onPointerDown = (event) => {
    start = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.hypot(dx, dy) < 26) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  };
  board.addEventListener("pointerdown", onPointerDown);
  board.addEventListener("pointerup", onPointerUp);

  return {
    restart: reset,
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown);
      board.removeEventListener("pointerdown", onPointerDown);
      board.removeEventListener("pointerup", onPointerUp);
      modal?.close();
    },
  };
}
