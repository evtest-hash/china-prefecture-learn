import "./style.css";
import { divisions, PROVINCE_NAMES } from "./data/divisions.js";
import { loadLearnedSet, saveLearnedSet, toggleDivision } from "./lib/storage.js";
import { getThemeButtons, renderThemeButton, handleThemeClick, onThemeChange } from "./lib/theme.js";
import { computeStats, renderStats } from "./lib/stats.js";
import { loadMap, setupResize, renderMap, setToggleCallback, onChartReady } from "./lib/map.js";
import { renderSidebar, bindSidebarEvents, syncSidebar, setRefreshCallback as setSidebarRefresh, showSyncToastGlobal } from "./lib/sidebar.js";
import { getOrCreateId, fetchProgress, mergeWithLocal, scheduleUpload } from "./lib/sync.js";
import * as quiz from "./lib/quiz.js";

// Ensure sync ID is set up early
getOrCreateId();

let learnedSet = loadLearnedSet();
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
      <button class="icon-btn" id="quiz-toggle" type="button" title="复习模式">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </button>
      <div class="mode-switch" aria-label="显示模式">
        <div class="mode-options">
          ${getThemeButtons().map(renderThemeButton).join("")}
        </div>
      </div>
      <button class="icon-btn" id="drawer-toggle" type="button" title="列表">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
    </div>
  </header>

  <aside class="drawer glass" id="drawer">
    <div class="drawer-header">
      <h2 class="drawer-title">地级区划列表</h2>
      <button class="icon-btn icon-btn-sm" id="drawer-close" type="button" title="关闭">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="drawer-body" id="sidebar-container">
      ${renderSidebar()}
    </div>
  </aside>

  <div class="drawer-backdrop" id="drawer-backdrop"></div>

  <div id="quiz-overlay" class="quiz-overlay hidden">
    <div class="quiz-container glass" id="quiz-container"></div>
  </div>
`;

const mapElement = document.querySelector("#map");
const sidebarContainer = document.querySelector("#sidebar-container");
const statsStrip = document.querySelector("#stats-strip");
const quizToggleBtn = document.querySelector("#quiz-toggle");
const quizOverlay = document.querySelector("#quiz-overlay");
const quizContainer = document.querySelector("#quiz-container");
const drawer = document.querySelector("#drawer");
const drawerToggle = document.querySelector("#drawer-toggle");
const drawerClose = document.querySelector("#drawer-close");
const drawerBackdrop = document.querySelector("#drawer-backdrop");

// Drawer toggle
function openDrawer() {
  drawer.classList.add("open");
  drawerBackdrop.classList.add("active");
}
function closeDrawer() {
  drawer.classList.remove("open");
  drawerBackdrop.classList.remove("active");
}
drawerToggle.addEventListener("click", openDrawer);
drawerClose.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (quiz.isQuizActive()) {
      quiz.endQuiz();
    } else if (drawer.classList.contains("open")) {
      closeDrawer();
    }
  }
});

// Theme click
app.addEventListener("click", (event) => {
  if (handleThemeClick(event)) {
    renderMap(learnedSet, quiz.getQuizHighlight());
  }
});

// Map toggle callback
setToggleCallback((adcode) => {
  toggleDivision(adcode);
  refreshAll();
});

// Sidebar events
setSidebarRefresh(refreshAll);
bindSidebarEvents(sidebarContainer, learnedSet);

// Quiz
quiz.setCallbacks(
  () => {
    learnedSet = loadLearnedSet();
    const newStats = computeStats(divisions, learnedSet);
    statsStrip.innerHTML = renderStats(newStats).map(renderStatChip).join("");
    renderQuizOverlay();
    renderMap(learnedSet, quiz.getQuizHighlight());
  },
  () => {
    learnedSet = loadLearnedSet();
    const newStats = computeStats(divisions, learnedSet);
    statsStrip.innerHTML = renderStats(newStats).map(renderStatChip).join("");
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

  // Auto-download and merge on page load
  fetchProgress().then((remoteData) => {
    const merged = mergeWithLocal(learnedSet, remoteData);
    if (merged.size !== learnedSet.size) {
      saveLearnedSet(merged);
      learnedSet = merged;
      refreshUI();
    }
  });
});

onThemeChange(() => {
  renderMap(learnedSet, quiz.getQuizHighlight());
});

function refreshAll() {
  learnedSet = loadLearnedSet();
  refreshUI();

  scheduleUpload(
    [...learnedSet],
    () => showSyncToastGlobal(sidebarContainer, "已同步", "success"),
    (msg) => showSyncToastGlobal(sidebarContainer, msg, "error"),
  );
}

function refreshUI() {
  const newStats = computeStats(divisions, learnedSet);
  const items = renderStats(newStats);
  statsStrip.innerHTML = items.map(renderStatChip).join("");
  syncSidebar(sidebarContainer, learnedSet);
  renderMap(learnedSet, quiz.getQuizHighlight());
}

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
  // When quiz is active (not start screen), remove backdrop so map is visible
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
