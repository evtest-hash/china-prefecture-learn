import { LEARNED_ADCODES } from "../data/divisions.js";

const STORAGE_KEY = "prefecture-learned";

export function loadLearnedSet() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveLearnedSet(set) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function toggleDivision(adcode) {
  const set = loadLearnedSet();
  if (set.has(adcode)) {
    set.delete(adcode);
  } else {
    set.add(adcode);
  }
  saveLearnedSet(set);
  return set.has(adcode);
}

export function setDivision(adcode, learned) {
  const set = loadLearnedSet();
  if (learned) {
    set.add(adcode);
  } else {
    set.delete(adcode);
  }
  saveLearnedSet(set);
}

export function mergedLearnedSet() {
  return new Set([...LEARNED_ADCODES, ...loadLearnedSet()]);
}
