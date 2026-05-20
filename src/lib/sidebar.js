import { divisions, PROVINCE_NAMES } from "../data/divisions.js";
import { exportData, importData, loadLearnedSet, setDivision, setAllDivisions } from "./storage.js";

let onRefreshCallback = null;
let searchTerm = "";

export function setRefreshCallback(fn) {
  onRefreshCallback = fn;
}

export function renderSidebar() {
  const grouped = groupByProvince();

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
        .map(([adcode, items]) => renderProvinceGroup(adcode, items))
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

function renderProvinceGroup(provinceAdcode, items) {
  const provinceName = PROVINCE_NAMES[provinceAdcode] || provinceAdcode;

  return `
    <details class="province-group">
      <summary class="province-summary">
        <span class="province-name">${provinceName}</span>
        <span class="province-count">${items.length}</span>
        <button class="province-check-all" data-province-check="${provinceAdcode}" type="button" title="全选/取消全选">全选</button>
      </summary>
      <div class="province-items">
        ${items.map((d) => renderCheckItem(d)).join("")}
      </div>
    </details>
  `;
}

function renderCheckItem(d) {
  return `
    <label class="check-item">
      <input type="checkbox" data-adcode="${d.adcode}" />
      <span class="check-name">${d.name}</span>
    </label>
  `;
}

export function bindSidebarEvents(container, learnedSet) {
  // Checkbox changes
  container.addEventListener("change", (event) => {
    const checkbox = event.target;
    if (!checkbox.dataset.adcode) return;
    setDivision(checkbox.dataset.adcode, checkbox.checked);
    if (onRefreshCallback) onRefreshCallback();
  });

  // Check-all buttons
  container.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-province-check]");
    if (!btn) return;
    event.stopPropagation();
    const adcode = btn.dataset.provinceCheck;
    const group = btn.closest("details");
    if (!group) return;
    const checkboxes = group.querySelectorAll('[data-adcode]');
    const allChecked = [...checkboxes].every((cb) => cb.checked);
    const adcodes = [...checkboxes].map((cb) => cb.dataset.adcode);
    setAllDivisions(adcodes, !allChecked);
    if (onRefreshCallback) onRefreshCallback();
  });

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

  syncSidebar(container, learnedSet);
}

export function syncSidebar(container, learnedSet) {
  const checkboxes = container.querySelectorAll("[data-adcode]");
  checkboxes.forEach((cb) => {
    cb.checked = learnedSet.has(cb.dataset.adcode);
  });
}

export function showSyncToastGlobal(container, message, type) {
  showSyncToast(container, message, type);
}

function refreshSidebar(container) {
  const groupsEl = container.querySelector("#sidebar-groups");
  if (!groupsEl) return;
  const grouped = groupByProvince();
  groupsEl.innerHTML = Object.entries(grouped)
    .map(([adcode, items]) => renderProvinceGroup(adcode, items))
    .join("");

  const currentSet = loadLearnedSet();
  syncSidebar(container, currentSet);
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
