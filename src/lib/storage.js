const STORAGE_KEY = "prefecture-learned";

export function loadLearnedSet() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function saveLearnedSet(set) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable
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

export function setAllDivisions(adcodes, learned) {
  const set = loadLearnedSet();
  for (const code of adcodes) {
    if (learned) {
      set.add(code);
    } else {
      set.delete(code);
    }
  }
  saveLearnedSet(set);
}

export function exportData() {
  const set = loadLearnedSet();
  return JSON.stringify({ learned: [...set], exportedAt: new Date().toISOString() }, null, 2);
}

export function importData(jsonString) {
  const data = JSON.parse(jsonString);
  if (!Array.isArray(data.learned)) throw new Error("Invalid data format");
  const set = new Set(data.learned);
  saveLearnedSet(set);
  return set;
}
