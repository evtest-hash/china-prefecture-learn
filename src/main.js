import "./style.css";
import { divisions, LEARNED_ADCODES, PROVINCE_NAMES } from "./data/divisions.js";
import { getThemeButtons, renderThemeButton, handleThemeClick, onThemeChange } from "./lib/theme.js";
import { computeStats, renderStats } from "./lib/stats.js";
import { loadMap, setupResize, renderMap, setRegionClickCallback, setWikiCache, zoomToDivision, zoomToDefault, onChartReady } from "./lib/map.js";
import { loadWikiSummaries, getWikiSummary, getWikiCache } from "./lib/wiki.js";
import * as quiz from "./lib/quiz.js";

const learnedSet = new Set(LEARNED_ADCODES);

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
    </div>
  </header>

  <div id="quiz-overlay" class="quiz-overlay hidden">
    <div class="quiz-container glass" id="quiz-container"></div>
  </div>

  <div id="info-panel" class="info-panel glass hidden">
    <div class="info-panel-handle"></div>
    <div class="info-panel-header">
      <h2 class="info-panel-title" id="info-title"></h2>
      <button class="info-panel-close" id="info-close" type="button" aria-label="关闭">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="info-panel-tags" id="info-tags"></div>
    <div class="info-panel-body" id="info-body"></div>
    <div class="info-panel-footer" id="info-footer"></div>
  </div>
`;

const mapElement = document.querySelector("#map");
const statsStrip = document.querySelector("#stats-strip");
const quizToggleBtn = document.querySelector("#quiz-toggle");
const quizOverlay = document.querySelector("#quiz-overlay");
const quizContainer = document.querySelector("#quiz-container");
const infoPanel = document.querySelector("#info-panel");
const infoTitle = document.querySelector("#info-title");
const infoTags = document.querySelector("#info-tags");
const infoBody = document.querySelector("#info-body");
const infoFooter = document.querySelector("#info-footer");
const infoClose = document.querySelector("#info-close");

// Info panel
let wikiLoaded = false;

function findDivision(adcode) {
  return divisions.find((d) => d.adcode === adcode);
}

function showInfoPanel(adcode, name) {
  if (!wikiLoaded) return;

  const summary = getWikiSummary(adcode);
  const div = findDivision(adcode);
  const isLearned = learnedSet.has(adcode);

  infoTitle.textContent = name;

  // Tags: province + learned status
  let tagsHtml = "";
  if (div && PROVINCE_NAMES[div.provinceAdcode]) {
    tagsHtml += `<span class="info-tag">${PROVINCE_NAMES[div.provinceAdcode]}</span>`;
  }
  tagsHtml += `<span class="info-tag ${isLearned ? "tag-learned" : "tag-unlearned"}">${isLearned ? "✓ 已学习" : "未学习"}</span>`;
  infoTags.innerHTML = tagsHtml;

  if (summary) {
    infoBody.innerHTML = `<p class="info-extract">${summary.extract}</p>`;
    infoFooter.innerHTML = `<a class="info-wiki-link" href="${summary.url}" target="_blank" rel="noopener noreferrer">查看维基百科 →</a>`;
  } else {
    infoBody.innerHTML = `<p class="info-extract info-extract-empty">暂无简介信息</p>`;
    infoFooter.innerHTML = "";
  }

  infoPanel.classList.remove("hidden");
  zoomToDivision(adcode);
}

function hideInfoPanel() {
  infoPanel.classList.add("hidden");
  zoomToDefault();
}

infoClose.addEventListener("click", hideInfoPanel);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !infoPanel.classList.contains("hidden")) {
    hideInfoPanel();
  }
});

setRegionClickCallback((adcode, name) => {
  if (adcode && name) {
    showInfoPanel(adcode, name);
  } else {
    // Clicked on empty area
    if (!infoPanel.classList.contains("hidden")) {
      hideInfoPanel();
    }
  }
});

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

quiz.bindQuizEvents(quizOverlay, () => learnedSet);

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

// Load wiki data
loadWikiSummaries().then(() => {
  wikiLoaded = true;
  setWikiCache(getWikiCache());
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

let wrongAutoNextTimer = null;

function renderQuizOverlay() {
  const state = quiz.getQuizState();
  if (state.active) {
    quizOverlay.classList.remove("quiz-start-overlay");
  } else {
    quizOverlay.classList.add("quiz-start-overlay");
  }

  clearTimeout(wrongAutoNextTimer);
  wrongAutoNextTimer = null;

  quizContainer.innerHTML = quiz.renderQuizUI();
  const input = quizContainer.querySelector("#quiz-answer");
  if (input) input.focus();

  if (state.active && state.answered && state.current) {
    const lastResult = state.results[state.results.length - 1];
    if (lastResult && !lastResult.correct) {
      wrongAutoNextTimer = setTimeout(() => {
        quiz.nextQuestion();
      }, 3000);
    }
  }
}

function renderStatChip(item) {
  return `<span class="stat-chip"><strong>${item.value}</strong> ${item.label}</span>`;
}
