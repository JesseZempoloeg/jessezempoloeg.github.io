/*
 * Daily challenge helpers.
 *
 * Everything is derived from the local date, so every visitor sees the same
 * game on the same day without a server. All functions are pure except the
 * two storage helpers, which fail silently when localStorage is blocked.
 */

const STORAGE_KEY = "astra:daily";

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDateKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** Small deterministic string hash (FNV-1a, 32-bit). */
export function hashString(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Same day and same list always give the same entry. */
export function pickIndex(key, length) {
  if (length <= 0) return 0;
  return hashString(`nova-arcade:${key}`) % length;
}

export function pickDailyGame(games, key = dateKey()) {
  if (!games.length) return null;
  return games[pickIndex(key, games.length)];
}

export function emptyProgress() {
  return { playedOn: null, lastPlayedOn: null, streak: 0, days: 0 };
}

/** Record that the daily game was played. Returns the new progress object. */
export function recordPlay(progress, key = dateKey()) {
  const current = { ...emptyProgress(), ...(progress || {}) };
  if (current.playedOn === key) return current;

  const yesterday = shiftDateKey(key, -1);
  const streak = current.lastPlayedOn === yesterday ? current.streak + 1 : 1;

  return {
    playedOn: key,
    lastPlayedOn: key,
    streak,
    days: (current.days || 0) + 1,
  };
}

/** A streak only counts while it is still alive (today or yesterday). */
export function activeStreak(progress, key = dateKey()) {
  const current = { ...emptyProgress(), ...(progress || {}) };
  if (!current.lastPlayedOn) return 0;
  if (current.lastPlayedOn === key || current.lastPlayedOn === shiftDateKey(key, -1)) {
    return current.streak;
  }
  return 0;
}

export function playedToday(progress, key = dateKey()) {
  return (progress?.playedOn ?? null) === key;
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyProgress();
    return { ...emptyProgress(), ...parsed };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage blocked — the challenge simply resets next visit */
  }
}
