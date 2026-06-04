import "./style.css";
import { divisions, LEARNED_ADCODES } from "./data/divisions.js";
import { getThemeButtons, renderThemeButton, handleThemeClick, onThemeChange } from "./lib/theme.js";
import { computeStats, renderStats } from "./lib/stats.js";
import { loadMap, setupResize, renderMap, onChartReady } from "./lib/map.js";
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
