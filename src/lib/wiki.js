let cache = null;

export async function loadWikiSummaries() {
  if (cache) return cache;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}wiki-summaries.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
    return cache;
  } catch {
    cache = {};
    return cache;
  }
}

export function getWikiSummary(adcode) {
  if (!cache) return null;
  return cache[adcode] || null;
}

export function getWikiCache() {
  return cache;
}
