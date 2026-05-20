const TOKEN_KEY = "prefecture-gist-token";
const GIST_ID_KEY = "prefecture-gist-id";
const API = "https://api.github.com/gists";
const FILE_NAME = "prefecture-learned.json";

let uploadTimer = 0;

export function getSyncConfig() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      gistId: localStorage.getItem(GIST_ID_KEY),
    };
  } catch {
    return { token: null, gistId: null };
  }
}

export function saveSyncConfig({ token, gistId }) {
  try {
    if (token !== undefined) localStorage.setItem(TOKEN_KEY, token);
    if (gistId !== undefined) localStorage.setItem(GIST_ID_KEY, gistId);
  } catch {
    // localStorage unavailable
  }
}

export function clearSyncConfig() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(GIST_ID_KEY);
  } catch {
    // ignore
  }
}

export function isSyncConfigured() {
  const { token } = getSyncConfig();
  return !!token;
}

// Auto-download on page load: merge remote into local, return merged set
export async function autoDownload(localSet) {
  const { token } = getSyncConfig();
  if (!token) return null;

  try {
    let gistId = getSyncConfig().gistId;

    // No gist id yet — search user's gists for an existing one
    if (!gistId) {
      gistId = await findExistingGist(token);
      if (gistId) {
        saveSyncConfig({ gistId });
      } else {
        return null; // first device, nothing to download yet
      }
    }

    const remote = await downloadByGistId(gistId, token);
    const merged = mergeLearnedSets([...localSet], remote.learned || []);
    return { merged, gistId };
  } catch {
    return null;
  }
}

// Debounced auto-upload: fires 2s after last change
export function scheduleUpload(learnedArray, onSuccess, onError) {
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    try {
      await uploadLearnedData(learnedArray);
      if (onSuccess) onSuccess();
    } catch (err) {
      if (onError) onError(err.message);
    }
  }, 2000);
}

export async function uploadLearnedData(learnedArray) {
  const { token } = getSyncConfig();
  if (!token) throw new Error("请先设置 GitHub Token");

  const content = JSON.stringify({
    learned: learnedArray,
    syncedAt: new Date().toISOString(),
  });

  const body = {
    description: "中国地级区划学习进度",
    public: false,
    files: { [FILE_NAME]: { content } },
  };

  let gistId = getSyncConfig().gistId;
  let response;

  if (gistId) {
    response = await gistRequest("PATCH", `${API}/${gistId}`, token, body);
  } else {
    // Check if user already has a matching gist
    gistId = await findExistingGist(token);
    if (gistId) {
      saveSyncConfig({ gistId });
      response = await gistRequest("PATCH", `${API}/${gistId}`, token, body);
    } else {
      response = await gistRequest("POST", API, token, body);
      saveSyncConfig({ gistId: response.id });
    }
  }

  return { gistId: response.id, syncedAt: new Date().toISOString() };
}

async function findExistingGist(token) {
  const gists = await gistRequest("GET", `${API}?per_page=100`, token);
  const match = gists.find(
    (g) => g.files && g.files[FILE_NAME]
  );
  return match ? match.id : null;
}

async function downloadByGistId(gistId, token) {
  const response = await gistRequest("GET", `${API}/${gistId}`, token);
  const file = response.files[FILE_NAME] || Object.values(response.files)[0];
  if (!file || !file.content) throw new Error("Gist 中未找到学习数据");
  return JSON.parse(file.content);
}

export function mergeLearnedSets(localArray, remoteArray) {
  return new Set([...localArray, ...remoteArray]);
}

async function gistRequest(method, url, token, body) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401) throw new Error("Token 无效，请检查设置");
  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0") throw new Error("请求频率限制，请稍后再试");
    throw new Error("Token 没有 Gist 权限");
  }
  if (response.status === 404) throw new Error("Gist 不存在，请检查 Gist ID");
  if (!response.ok) throw new Error(`同步失败 (HTTP ${response.status})`);

  return response.json();
}
