import { divisions, PROVINCE_NAMES } from "../data/divisions.js";
import { exportData, importData, loadLearnedSet } from "./storage.js";

let onRefreshCallback = null;
let searchTerm = "";

export function setRefreshCallback(fn) {
  onRefreshCallback = fn;
}

export function renderSidebar() {
  const grouped = groupByProvince();
  const currentSet = loadLearnedSet();

  return `
    <div class="sidebar-header">
      <div class="sidebar-search">
        <input type="text" id="sidebar-search" placeholder="搜索地级区划..." />
      </div>
      <div class="sidebar-actions">
        <button class="sidebar-action-btn" id="btn-export" type="button">导出</button>
        <button class="sidebar-action-btn" id="btn-import" type="button">导入</button>
        <input type="file" id="import-file" accept=".json" hidden />
        <button class="sidebar-action-btn" id="btn-copy-link" type="button">复制同步链接</button>
      </div>
    </div>
    <div class="sync-toast" id="sync-toast" hidden></div>
    <div class="sidebar-groups" id="sidebar-groups">
      ${Object.entries(grouped)
        .map(([adcode, items]) => renderProvinceGroup(adcode, items, currentSet))
        .join("")}
    </div>
  `;
}

function groupByProvince() {
  const map = new Map();
  const filtered = searchTerm
    ? divisions.filter((d) => d.name.includes(searchTerm) || d.province.includes(searchTerm))
    : divisions;

  for (const d of filtered) {
    if (!map.has(d.provinceAdcode)) {
      map.set(d.provinceAdcode, []);
    }
    map.get(d.provinceAdcode).push(d);
  }
  return map;
}

function renderProvinceGroup(provinceAdcode, items, learnedSet) {
  const provinceName = PROVINCE_NAMES[provinceAdcode] || provinceAdcode;
  const learnedCount = items.filter((d) => learnedSet.has(d.adcode)).length;

  return `
    <details class="province-group">
      <summary class="province-summary">
        <span class="province-name">${provinceName}</span>
        <span class="province-count">${learnedCount}/${items.length}</span>
      </summary>
      <div class="province-items">
        ${items.map((d) => renderLearnItem(d, learnedSet)).join("")}
      </div>
    </details>
  `;
}

function renderLearnItem(d, learnedSet) {
  const learned = learnedSet.has(d.adcode);
  return `
    <div class="learn-item ${learned ? "learn-item--learned" : ""}" data-adcode="${d.adcode}">
      <span class="learn-dot"></span>
      <span class="learn-name">${d.name}</span>
    </div>
  `;
}

export function bindSidebarEvents(container, learnedSet) {
  // Search
  const searchInput = container.querySelector("#sidebar-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim();
      refreshSidebar(container);
    });
  }

  // Export
  container.querySelector("#btn-export")?.addEventListener("click", () => {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prefecture-learn-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  const importBtn = container.querySelector("#btn-import");
  const importFile = container.querySelector("#import-file");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        importData(text);
        if (onRefreshCallback) onRefreshCallback();
      } catch (err) {
        alert("导入失败：" + err.message);
      }
      importFile.value = "";
    });
  }

  // Copy sync link
  container.querySelector("#btn-copy-link")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showSyncToast(container, "链接已复制，可在其他设备打开", "success");
    } catch {
      showSyncToast(container, "复制失败", "error");
    }
  });
}

export function syncSidebar(container, learnedSet) {
  const items = container.querySelectorAll("[data-adcode]");
  items.forEach((el) => {
    const learned = learnedSet.has(el.dataset.adcode);
    el.classList.toggle("learn-item--learned", learned);
  });

  // Update province counts
  container.querySelectorAll(".province-summary").forEach((summary) => {
    const group = summary.closest(".province-group");
    if (!group) return;
    const allItems = group.querySelectorAll("[data-adcode]");
    const learnedCount = [...allItems].filter((el) =>
      learnedSet.has(el.dataset.adcode)
    ).length;
    const countEl = summary.querySelector(".province-count");
    if (countEl) countEl.textContent = `${learnedCount}/${allItems.length}`;
  });
}

export function showSyncToastGlobal(container, message, type) {
  showSyncToast(container, message, type);
}

function refreshSidebar(container) {
  const groupsEl = container.querySelector("#sidebar-groups");
  if (!groupsEl) return;
  const grouped = groupByProvince();
  const currentSet = loadLearnedSet();
  groupsEl.innerHTML = Object.entries(grouped)
    .map(([adcode, items]) => renderProvinceGroup(adcode, items, currentSet))
    .join("");
}

let toastTimer = 0;

function showSyncToast(container, message, type) {
  const toast = container.querySelector("#sync-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `sync-toast sync-toast--${type}`;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}
