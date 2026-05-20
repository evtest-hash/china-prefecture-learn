const SYNC_ID_KEY = "prefecture-sync-id";
const API_URL = "/api/progress";

let uploadTimer = 0;

export function getOrCreateId() {
  const params = new URLSearchParams(window.location.search);
  const urlId = params.get("id");

  if (urlId) {
    try { localStorage.setItem(SYNC_ID_KEY, urlId); } catch { /* ignore */ }
    return urlId;
  }

  try {
    const stored = localStorage.getItem(SYNC_ID_KEY);
    if (stored) {
      window.history.replaceState(null, "", `?id=${stored}`);
      return stored;
    }
  } catch { /* ignore */ }

  const id = crypto.randomUUID();
  try { localStorage.setItem(SYNC_ID_KEY, id); } catch { /* ignore */ }
  window.history.replaceState(null, "", `?id=${id}`);
  return id;
}

export async function fetchProgress() {
  const id = getOrCreateId();
  try {
    const res = await fetch(`${API_URL}?id=${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function uploadProgress(learnedArray) {
  const id = getOrCreateId();
  try {
    const res = await fetch(`${API_URL}?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learned: learnedArray }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function mergeWithLocal(localSet, remoteData) {
  if (!remoteData || !Array.isArray(remoteData.learned)) return localSet;
  return new Set([...localSet, ...remoteData.learned]);
}

export function scheduleUpload(learnedArray, onSuccess, onError) {
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    const ok = await uploadProgress(learnedArray);
    if (ok) {
      if (onSuccess) onSuccess();
    } else {
      if (onError) onError("同步失败");
    }
  }, 2000);
}
