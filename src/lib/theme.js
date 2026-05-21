const THEME_STORAGE_KEY = "prefecture-theme-mode";
const DEFAULT_THEME_MODE = "system";
const root = document.documentElement;
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const themeModeButtons = [
  { id: "light", label: "昼" },
  { id: "dark", label: "夜" },
];

const validThemeModes = new Set([DEFAULT_THEME_MODE, ...themeModeButtons.map((b) => b.id)]);

let themeMode = readStoredThemeMode();
let onThemeChangeCallback = null;
let cachedChartTheme = null;

applyThemeState({ persist: false });

export function onThemeChange(fn) {
  onThemeChangeCallback = fn;
}

export function getThemeButtons() {
  return themeModeButtons;
}

export function renderThemeButton(option) {
  return `
    <button
      class="mode-button"
      type="button"
      data-theme-mode="${option.id}"
      aria-pressed="${String(option.id === themeMode)}"
    >
      ${option.label}
    </button>
  `;
}

export function handleThemeClick(event) {
  const themeBtn = event.target.closest("[data-theme-mode]");
  if (themeBtn) {
    setThemeMode(themeBtn.dataset.themeMode);
    return true;
  }

  return false;
}

function setThemeMode(nextMode) {
  if (!validThemeModes.has(nextMode)) return;
  themeMode = themeMode === nextMode ? DEFAULT_THEME_MODE : nextMode;
  applyThemeState();
}

function applyThemeState({ persist = true } = {}) {
  const resolved = resolveThemeMode(themeMode);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  cachedChartTheme = null;

  if (persist) {
    writeStoredChoice(THEME_STORAGE_KEY, themeMode);
  }

  syncControlState();

  if (onThemeChangeCallback) {
    requestAnimationFrame(onThemeChangeCallback);
  }
}

function syncControlState() {
  const resolved = resolveThemeMode(themeMode);
  document.querySelectorAll("[data-theme-mode]").forEach((button) => {
    const active = button.dataset.themeMode === resolved;
    button.setAttribute("aria-pressed", String(active));
  });
}

function resolveThemeMode(mode) {
  if (mode === DEFAULT_THEME_MODE) {
    return systemThemeQuery.matches ? "dark" : "light";
  }
  return mode;
}

export function readChartTheme() {
  if (cachedChartTheme) return cachedChartTheme;
  const styles = getComputedStyle(root);
  cachedChartTheme = {
    tooltipBackground: readToken(styles, "--chart-tooltip-bg"),
    tooltipBorder: readToken(styles, "--chart-tooltip-border"),
    tooltipText: readToken(styles, "--chart-tooltip-text"),
    mapBase: readToken(styles, "--chart-map-base"),
    mapBorder: readToken(styles, "--chart-map-border"),
    mapHover: readToken(styles, "--chart-map-hover"),
    mapActive: readToken(styles, "--chart-map-active"),
    quizHighlight: readToken(styles, "--chart-quiz-highlight"),
    quizGlow: readToken(styles, "--chart-quiz-glow"),
  };
  return cachedChartTheme;
}

function readStoredThemeMode() {
  return readStoredChoice(THEME_STORAGE_KEY, validThemeModes, DEFAULT_THEME_MODE);
}

function readStoredChoice(key, validValues, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return validValues.has(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredChoice(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function readToken(styles, name) {
  return styles.getPropertyValue(name).trim();
}

// Bind system theme change
(function bindSystemThemeChange() {
  const handleChange = () => {
    if (themeMode !== DEFAULT_THEME_MODE) return;
    applyThemeState({ persist: false });
  };
  if (typeof systemThemeQuery.addEventListener === "function") {
    systemThemeQuery.addEventListener("change", handleChange);
  } else if (typeof systemThemeQuery.addListener === "function") {
    systemThemeQuery.addListener(handleChange);
  }
})();
