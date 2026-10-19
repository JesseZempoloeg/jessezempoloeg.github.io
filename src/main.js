import "./style.css";
import { HeroScene } from "./hero.js";
import { audio } from "./audio.js";
import { games } from "./games/index.js";
import { el, getBest, formatNumber } from "./games/util.js";
import { pickDailyGame, loadProgress, saveProgress, recordPlay, playedToday, activeStreak } from "./daily.js";

/* ---------------- hero ---------------- */
const heroScene = new HeroScene(document.getElementById("hero-canvas"));

/* ---------------- game grid ---------------- */
const grid = document.getElementById("game-grid");

/* Mix two #rrggbb colors. t=0 gives a, t=1 gives b. */
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/* A small generated planet per game. Each card gets its own id prefix, so the SVG defs don't clash. */
function planetArt(game, index) {
  const id = `pl-${game.id}`;
  const light = mixHex(game.tint, "#ffffff", 0.5);
  const dark = mixHex(game.tint, "#05060a", 0.7);
  const deep = "#05060a";
  const CX = 80;
  const CY = 50;
  const R = 30;
  const variant = index % 3; // 0 = moon, 1 = ring, 2 = bare planet

  const stars = Array.from({ length: 34 }, (_, i) => {
    const x = (i * 47 + index * 31) % 160;
    const y = (i * 23 + index * 17) % 100;
    const r = i % 7 === 0 ? 0.9 : 0.4;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${(0.25 + (i % 4) * 0.15).toFixed(2)}"/>`;
  }).join("");

  const ringBack = variant === 1
    ? `<ellipse cx="${CX}" cy="${CY}" rx="52" ry="11" transform="rotate(-16 ${CX} ${CY})" fill="none" stroke="${game.tint}" stroke-width="1.4" opacity="0.3"/>`
    : "";
  const ringFront = variant === 1
    ? `<g clip-path="url(#${id}-front)"><ellipse cx="${CX}" cy="${CY}" rx="52" ry="11" transform="rotate(-16 ${CX} ${CY})" fill="none" stroke="${game.tint}" stroke-width="1.8" opacity="0.9"/></g>`
    : "";
  const moon = variant === 0
    ? `<circle cx="124" cy="26" r="4.5" fill="${dark}" stroke="${light}" stroke-opacity="0.6" stroke-width="0.6"/>`
    : "";

  return `
    <svg class="planet" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="${id}-body" cx="34%" cy="30%" r="72%">
          <stop offset="0" stop-color="${light}"/>
          <stop offset="0.4" stop-color="${game.tint}"/>
          <stop offset="0.8" stop-color="${dark}"/>
          <stop offset="1" stop-color="${deep}"/>
        </radialGradient>
        <radialGradient id="${id}-glow">
          <stop offset="0.6" stop-color="${game.tint}" stop-opacity="0.38"/>
          <stop offset="1" stop-color="${game.tint}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id}-shine">
          <stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="${id}-clip"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
        <clipPath id="${id}-front"><rect x="0" y="${CY}" width="160" height="100"/></clipPath>
        <pattern id="${id}-tex" width="24" height="100" patternUnits="userSpaceOnUse">
          <path d="M5 0 C11 22 -1 40 7 58 S14 84 6 100" fill="none" stroke="${dark}" stroke-width="3" opacity="0.45"/>
          <path d="M17 0 C12 18 22 46 16 66 S20 88 15 100" fill="none" stroke="${light}" stroke-width="1.2" opacity="0.25"/>
        </pattern>
        <filter id="${id}-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${index + 2}" result="n"/>
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.5 -0.55"/>
        </filter>
      </defs>
      ${stars}
      ${ringBack}
      <circle cx="${CX}" cy="${CY}" r="${R + 14}" fill="url(#${id}-glow)"/>
      ${moon}
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#${id}-body)"/>
      <g clip-path="url(#${id}-clip)">
        <g class="planet-texture"><rect x="-24" y="0" width="240" height="100" fill="url(#${id}-tex)"/></g>
        <rect x="${CX - R}" y="${CY - R}" width="${R * 2}" height="${R * 2}" filter="url(#${id}-grain)" opacity="0.22"/>
        <ellipse cx="${CX - 11}" cy="${CY - 12}" rx="10" ry="6" fill="url(#${id}-shine)" transform="rotate(-25 ${CX - 11} ${CY - 12})"/>
      </g>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${light}" stroke-opacity="0.35" stroke-width="0.8"/>
      ${ringFront}
    </svg>`;
}

function bestLabel(game) {
  const best = getBest(game.id);
  if (best === null) return "NOG NIET GESPEELD";
  const prefix = game.bestPrefix || "BEST";
  const suffix = game.bestSuffix ? ` ${game.bestSuffix}` : "";
  const value = game.formatBest ? game.formatBest(best) : formatNumber(best);
  return `${prefix} ${value}${suffix}`;
}

function refreshBests() {
  grid.querySelectorAll("[data-best]").forEach((node) => {
    const game = games.find((g) => g.id === node.dataset.best);
    if (game) node.textContent = bestLabel(game);
  });
}

function buildCard(game, index) {
  const card = el("button", "card");
  card.type = "button";
  card.style.setProperty("--tint", game.tint);
  card.style.setProperty("--i", String(index));
  card.dataset.game = game.id;
  card.dataset.reveal = "";
  card.setAttribute("aria-label", `${game.title} spelen`);
  card.innerHTML = `
    <div class="card-art">
      <span class="orbit"></span>
      <span class="orbit b"></span>
      ${planetArt(game, index)}
      <span class="card-glyph" aria-hidden="true">${game.glyph}</span>
    </div>
    <div class="card-body">
      <span class="card-kicker">${game.kicker}</span>
      <h3>${game.title}</h3>
      <p>${game.tagline}</p>
      <div class="card-foot">
        <span class="card-best" data-best="${game.id}"></span>
        <span class="card-play">SPELEN</span>
      </div>
    </div>`;

  card.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
    card.style.setProperty("--my", `${(py + 0.5) * 100}%`);
    card.style.transform = `perspective(1000px) rotateY(${px * 4.5}deg) rotateX(${-py * 4.5}deg) translateY(-4px)`;
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
  card.addEventListener("click", () => openGame(game.id));

  return card;
}

games.forEach((game, index) => grid.appendChild(buildCard(game, index)));

refreshBests();

/* ---------------- daily challenge ---------------- */
const dailyGame = pickDailyGame(games);
const dailyName = document.getElementById("daily-name");
const dailyState = document.getElementById("daily-state");
const dailyPlay = document.getElementById("daily-play");
const dailyCardSlot = document.getElementById("daily-card");

function refreshDaily() {
  const progress = loadProgress();
  const done = playedToday(progress);
  const streak = activeStreak(progress);
  if (!done) {
    dailyState.textContent = "Nog niet gespeeld vandaag";
  } else if (streak > 1) {
    dailyState.textContent = `Vandaag gespeeld · reeks van ${streak} dagen`;
  } else {
    dailyState.textContent = "Vandaag gespeeld";
  }
  dailyState.classList.toggle("is-done", done);
}

if (dailyGame) {
  dailyName.textContent = dailyGame.title;
  dailyCardSlot.appendChild(buildCard(dailyGame, games.indexOf(dailyGame)));

  const todayCard = grid.querySelector(`[data-game="${dailyGame.id}"]`);
  if (todayCard) {
    todayCard.classList.add("is-today");
    todayCard.appendChild(el("span", "card-today", "VANDAAG"));
  }

  dailyPlay.addEventListener("click", () => {
    openGame(dailyGame.id);
    audio.blip();
  });

  refreshDaily();
}

/* ---------------- game shell ---------------- */
const shell = document.getElementById("game-shell");
const stage = document.getElementById("game-stage");
const titleNode = document.getElementById("game-title");
const metaNode = document.getElementById("game-meta");
const closeBtn = document.getElementById("game-close");
const restartBtn = document.getElementById("game-restart");

let current = null;
let opening = false;

async function openGame(id) {
  const game = games.find((g) => g.id === id);
  if (!game || opening) return;
  opening = true;

  titleNode.textContent = game.title;
  metaNode.textContent = game.kicker;
  stage.innerHTML = "";
  shell.hidden = false;
  shell.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  void shell.offsetHeight;
  shell.classList.add("ready");
  heroScene.stop();

  try {
    // let the stage get its real size before the game measures it. rAF can be
    // paused in a background tab, so a timer is the fallback.
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      requestAnimationFrame(() => requestAnimationFrame(done));
      setTimeout(done, 300);
    });

    const module = await game.load();
    current = { id, instance: module.mount(stage, { audio }) };
    restartBtn.hidden = false;
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<div class="game-overlay"><div class="ov-card">
      <p class="ov-kicker">ER GING IETS MIS</p>
      <h3>Deze wereld wilde niet openen</h3>
      <p class="ov-text">Probeer het nog eens. Details staan in de console.</p>
    </div></div>`;
  } finally {
    opening = false;
  }

  closeBtn.focus({ preventScroll: true });
}

function closeGame() {
  if (!current && shell.hidden) return;
  const finished = current?.id ?? null;
  try {
    current?.instance?.destroy?.();
  } catch (err) {
    console.error(err);
  }
  current = null;

  // playing today's game keeps the streak alive
  if (finished && dailyGame && finished === dailyGame.id) {
    saveProgress(recordPlay(loadProgress()));
    refreshDaily();
  }
  stage.innerHTML = "";
  shell.classList.remove("ready");
  shell.hidden = true;
  shell.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  refreshBests();
  heroScene.start();
  audio.blip();
}

closeBtn.addEventListener("click", closeGame);
restartBtn.addEventListener("click", () => {
  current?.instance?.restart?.();
  audio.blip();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !shell.hidden) {
    event.preventDefault();
    closeGame();
  }
});

/* ---------------- sound toggle ---------------- */
const soundBtn = document.getElementById("sound-toggle");
function paintSound() {
  soundBtn.textContent = audio.enabled ? "GELUID AAN" : "GELUID UIT";
  soundBtn.setAttribute("aria-pressed", String(audio.enabled));
}
paintSound();

soundBtn.addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  paintSound();
  if (audio.enabled) audio.blip();
});

/* ---------------- hero CTA ---------------- */
document.getElementById("hero-play").addEventListener("click", () => {
  document.getElementById("games").scrollIntoView({ behavior: "smooth", block: "start" });
  audio.blip();
});

/* ---------------- scroll effects ---------------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(node) {
  const target = games.length;
  if (reduceMotion) {
    node.textContent = String(target);
    return;
  }
  const start = performance.now();
  const duration = 1200;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const node = entry.target;
      node.classList.add("is-in");
      if (node.hasAttribute("data-count")) countUp(node);
      revealObserver.unobserve(node);
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll("[data-reveal]").forEach((node) => revealObserver.observe(node));

const progressBar = document.querySelector(".scroll-progress");
const heroTitleNode = document.querySelector(".hero-title");
let scrollQueued = false;

function onScroll() {
  scrollQueued = false;
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  if (!reduceMotion && heroTitleNode && y < window.innerHeight) {
    heroTitleNode.style.transform = `translate3d(0, ${y * 0.3}px, 0)`;
    heroTitleNode.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.7)));
  }
}

window.addEventListener(
  "scroll",
  () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(onScroll);
  },
  { passive: true }
);
onScroll();

/* Cursor glow: eases toward the pointer on desktop, skipped for reduced motion. */
const cursorGlow = document.querySelector(".cursor-glow");
const finePointer = window.matchMedia("(pointer: fine)").matches;
if (cursorGlow && finePointer && !reduceMotion) {
  const GLOW_HALF = 210;
  let gx = 0;
  let gy = 0;
  let tx = 0;
  let ty = 0;
  let glowQueued = false;

  const paintGlow = () => {
    glowQueued = false;
    gx += (tx - gx) * 0.18;
    gy += (ty - gy) * 0.18;
    cursorGlow.style.transform = `translate3d(${gx - GLOW_HALF}px, ${gy - GLOW_HALF}px, 0)`;
    if (Math.abs(tx - gx) > 0.5 || Math.abs(ty - gy) > 0.5) {
      glowQueued = true;
      requestAnimationFrame(paintGlow);
    }
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cursorGlow.classList.add("is-on");
      if (!glowQueued) {
        glowQueued = true;
        requestAnimationFrame(paintGlow);
      }
    },
    { passive: true }
  );
}
