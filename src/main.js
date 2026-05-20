import "./style.css";
import { divisions, LEARNED_ADCODES } from "./data/divisions.js";
import { loadLearnedSet, saveLearnedSet, toggleDivision } from "./lib/storage.js";
import { getThemeButtons, renderThemeButton, handleThemeClick, onThemeChange } from "./lib/theme.js";
import { computeStats, renderStats } from "./lib/stats.js";
import { loadMap, setupResize, renderMap, setToggleCallback, onChartReady } from "./lib/map.js";
import * as quiz from "./lib/quiz.js";

// Edit mode: local dev (localhost) allows click-to-toggle + localStorage
// Production (GitHub Pages) is read-only, uses LEARNED_ADCODES from repo
const isDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";

let learnedSet;
if (isDev) {
  // Merge repo data with localStorage (localStorage takes priority)
  const stored = loadLearnedSet();
  learnedSet = new Set([...LEARNED_ADCODES, ...stored]);
} else {
  learnedSet = new Set(LEARNED_ADCODES);
}

const stats = computeStats(divisions, learnedSet);
const statItems = renderStats(stats);

const app = document.querySelector("#app");
app.innerHTML = `
  <div id="map" class="map-fullscreen"></div>

  <header class="top-bar glass">
    <div class="top-bar-left">
      <h1 class="top-title">中国地级区划</h1>
      <div class="stats-inline" id="stats-strip">
        ${statItems.map(renderStatChip).join("")}
      </div>
    </div>
    <div class="top-bar-right">
      ${isDev ? `
        <button class="icon-btn" id="export-learned" type="button" title="导出已学习列表">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      ` : ""}
      <button class="icon-btn" id="quiz-toggle" type="button" title="复习模式">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </button>
      <div class="mode-switch" aria-label="显示模式">
        <div class="mode-options">
          ${getThemeButtons().map(renderThemeButton).join("")}
        </div>
      </div>
    </div>
  </header>

  <div id="quiz-overlay" class="quiz-overlay hidden">
    <div class="quiz-container glass" id="quiz-container"></div>
  </div>
`;

const mapElement = document.querySelector("#map");
const statsStrip = document.querySelector("#stats-strip");
const quizToggleBtn = document.querySelector("#quiz-toggle");
const quizOverlay = document.querySelector("#quiz-overlay");
const quizContainer = document.querySelector("#quiz-container");

function refreshUI() {
  const newStats = computeStats(divisions, learnedSet);
  statsStrip.innerHTML = renderStats(newStats).map(renderStatChip).join("");
  renderMap(learnedSet, quiz.getQuizHighlight());
}

// Theme click
app.addEventListener("click", (event) => {
  if (handleThemeClick(event)) {
    renderMap(learnedSet, quiz.getQuizHighlight());
  }
});

// Map click toggle (dev mode only)
if (isDev) {
  setToggleCallback((adcode) => {
    toggleDivision(adcode);
    learnedSet = loadLearnedSet();
    // Merge with repo data for display
    learnedSet = new Set([...LEARNED_ADCODES, ...learnedSet]);
    refreshUI();
  });

  // Export button: generates LEARNED_ADCODES content to copy
  document.querySelector("#export-learned")?.addEventListener("click", () => {
    const allLearned = [...new Set([...LEARNED_ADCODES, ...loadLearnedSet()])].sort();
    const content = `export const LEARNED_ADCODES = [\n${allLearned.map((c) => `  "${c}",`).join("\n")}\n];\n`;

    // Copy to clipboard
    navigator.clipboard.writeText(content).then(() => {
      alert("已复制 LEARNED_ADCODES 到剪贴板，粘贴到 src/data/divisions.js 末尾即可");
    }).catch(() => {
      // Fallback: open in new tab
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      window.open(url);
    });
  });
}

// Quiz
quiz.setCallbacks(
  () => {
    renderQuizOverlay();
    renderMap(learnedSet, quiz.getQuizHighlight());
  },
  () => {
    hideQuizOverlay();
    renderMap(learnedSet);
  },
);

quiz.bindQuizEvents(quizOverlay);

quizToggleBtn.addEventListener("click", () => {
  if (quiz.isQuizActive()) {
    quiz.endQuiz();
  } else {
    showQuizOverlay();
  }
});

// Init map
loadMap(mapElement);
setupResize(mapElement);

onChartReady(() => {
  renderMap(learnedSet);
});

onThemeChange(() => {
  renderMap(learnedSet, quiz.getQuizHighlight());
});

function showQuizOverlay() {
  quizOverlay.classList.remove("hidden");
  quizOverlay.classList.add("quiz-start-overlay");
  quizContainer.innerHTML = quiz.renderQuizUI();
  const input = quizContainer.querySelector("#quiz-answer");
  if (input) input.focus();
}

function hideQuizOverlay() {
  quizOverlay.classList.add("hidden");
  quizOverlay.classList.remove("quiz-start-overlay");
  quizContainer.innerHTML = "";
}

function renderQuizOverlay() {
  const state = quiz.getQuizState();
  if (state.active) {
    quizOverlay.classList.remove("quiz-start-overlay");
  } else {
    quizOverlay.classList.add("quiz-start-overlay");
  }
  quizContainer.innerHTML = quiz.renderQuizUI();
  const input = quizContainer.querySelector("#quiz-answer");
  if (input) input.focus();
}

function renderStatChip(item) {
  return `<span class="stat-chip"><strong>${item.value}</strong> ${item.label}</span>`;
}
