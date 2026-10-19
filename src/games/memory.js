import { audio } from "../audio.js";
import { overlay, getBest, setBest, formatNumber, formatTime } from "./util.js";

const SYMBOLS = ["✦", "✧", "★", "☾", "☉", "♄", "♃", "♀"];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mount(root) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-group">
        <div class="hud-item"><span class="hud-label">Zetten</span><span class="hud-value" data-moves>0</span></div>
        <div class="hud-item"><span class="hud-label">Tijd</span><span class="hud-value" data-time>0:00</span></div>
        <div class="hud-item"><span class="hud-label">Beste</span><span class="hud-value" data-best>—</span></div>
      </div>
    </div>
    <div class="memory-wrap">
      <div class="memory-grid" data-grid></div>
    </div>`;

  const grid = root.querySelector("[data-grid]");
  const movesNode = root.querySelector("[data-moves]");
  const timeNode = root.querySelector("[data-time]");
  const bestNode = root.querySelector("[data-best]");

  let moves = 0;
  let matched = 0;
  let flipped = [];
  let lock = false;
  let started = false;
  let startTime = 0;
  let elapsed = 0;
  let timer = null;
  let modal = null;
  let cards = [];

  const best = getBest("memory");
  bestNode.textContent = best === null ? "—" : `${formatNumber(best)} ZETTEN`;

  function paint() {
    movesNode.textContent = formatNumber(moves);
    timeNode.textContent = formatTime(elapsed);
  }

  function buildDeck() {
    grid.innerHTML = "";
    cards = [];
    const deck = shuffle([...SYMBOLS, ...SYMBOLS]);
    deck.forEach((symbol, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "mcard";
      card.dataset.index = String(index);
      card.setAttribute("aria-label", "Onbekende kaart");
      card.innerHTML = `
        <span class="mface back"></span>
        <span class="mface front">${symbol}</span>`;
      card.addEventListener("click", () => flip(index));
      grid.appendChild(card);
      cards.push({ symbol, node: card, matched: false });
    });
  }

  function flip(index) {
    const card = cards[index];
    if (!card || card.matched || lock) return;
    if (card.node.classList.contains("flipped")) return;

    if (!started) {
      started = true;
      startTime = performance.now();
      timer = window.setInterval(() => {
        elapsed = (performance.now() - startTime) / 1000;
        timeNode.textContent = formatTime(elapsed);
      }, 250);
    }

    card.node.classList.add("flipped");
    card.node.setAttribute("aria-label", card.symbol);
    audio.blip();
    flipped.push(index);

    if (flipped.length < 2) return;

    moves += 1;
    paint();
    const [a, b] = flipped;
    const first = cards[a];
    const second = cards[b];

    if (first.symbol === second.symbol) {
      first.matched = true;
      second.matched = true;
      first.node.classList.add("matched");
      second.node.classList.add("matched");
      first.node.disabled = true;
      second.node.disabled = true;
      matched += 1;
      flipped = [];
      audio.eat();

      if (matched === SYMBOLS.length) win();
    } else {
      lock = true;
      window.setTimeout(() => {
        first.node.classList.remove("flipped");
        second.node.classList.remove("flipped");
        first.node.setAttribute("aria-label", "Onbekende kaart");
        second.node.setAttribute("aria-label", "Onbekende kaart");
        flipped = [];
        lock = false;
        audio.step();
      }, 720);
    }
  }

  function win() {
    window.clearInterval(timer);
    timer = null;
    audio.win();
    const previous = getBest("memory");
    let record = false;
    if (previous === null || moves < previous) {
      setBest("memory", moves);
      bestNode.textContent = `${formatNumber(moves)} ZETTEN`;
      record = true;
    }
    window.setTimeout(() => {
      modal = overlay(root, {
        kicker: record ? "NIEUW RECORD" : "ALLE STERREN GEVONDEN",
        title: "De hemel is compleet",
        text: `Je had <strong>${moves}</strong> zetten nodig en deed er <strong>${formatTime(elapsed)}</strong> over.`,
        extra: `<div class="ov-stat">
          <div><span>Zetten</span><span>${moves}</span></div>
          <div><span>Tijd</span><span>${formatTime(elapsed)}</span></div>
        </div>`,
        button: "NOG EEN KEER",
        onStart: reset,
      });
    }, 520);
  }

  function reset() {
    modal?.close();
    modal = null;
    window.clearInterval(timer);
    timer = null;
    moves = 0;
    matched = 0;
    flipped = [];
    lock = false;
    started = false;
    elapsed = 0;
    paint();
    buildDeck();
  }

  reset();

  modal = overlay(root, {
    kicker: "CONSTELLATION",
    title: "Vind de paren",
    text: "Draai twee kaarten om. Vind je een paar, dan blijven ze open. Hoe minder zetten, hoe beter.",
    button: "BEGIN",
    onStart: () => {
      modal = null;
      audio.blip();
    },
  });

  return {
    restart: reset,
    destroy: () => {
      window.clearInterval(timer);
      modal?.close();
    },
  };
}
