import { divisions, PROVINCE_NAMES } from "../data/divisions.js";
import { setDivision } from "./storage.js";

let quizActive = false;
let quizMode = null; // "province" | "all"
let quizProvinceAdcode = null;
let quizPool = [];
let quizUsed = new Set();
let quizResults = []; // { adcode, name, correct }
let quizCurrent = null;
let quizTotal = 0;
let quizCorrect = 0;
let quizAnswered = false;
let onRenderCallback = null;
let onEndCallback = null;

export function setCallbacks(onRender, onEnd) {
  onRenderCallback = onRender;
  onEndCallback = onEnd;
}

export function isQuizActive() {
  return quizActive;
}

export function getQuizState() {
  return {
    active: quizActive,
    mode: quizMode,
    province: quizProvinceAdcode,
    current: quizCurrent,
    total: quizTotal,
    correct: quizCorrect,
    answered: quizAnswered,
    results: quizResults,
  };
}

export function startQuizProvince(provinceAdcode) {
  const pool = divisions.filter((d) => d.provinceAdcode === provinceAdcode);
  if (pool.length === 0) return;

  quizActive = true;
  quizMode = "province";
  quizProvinceAdcode = provinceAdcode;
  quizPool = shuffle([...pool]);
  quizUsed = new Set();
  quizResults = [];
  quizTotal = 0;
  quizCorrect = 0;
  quizAnswered = false;

  nextQuestion();
}

export function startQuizAll() {
  if (divisions.length === 0) return;

  quizActive = true;
  quizMode = "all";
  quizProvinceAdcode = null;
  quizPool = shuffle([...divisions]);
  quizUsed = new Set();
  quizResults = [];
  quizTotal = 0;
  quizCorrect = 0;
  quizAnswered = false;

  nextQuestion();
}

export function nextQuestion() {
  const next = quizPool.find((d) => !quizUsed.has(d.adcode));

  if (!next) {
    quizCurrent = null;
    if (onRenderCallback) onRenderCallback();
    return;
  }

  quizUsed.add(next.adcode);
  quizCurrent = next;
  quizAnswered = false;

  if (onRenderCallback) onRenderCallback();
}

export function submitAnswer(name) {
  if (!quizActive || !quizCurrent || quizAnswered) return null;

  const normalized = normalize(name);
  const expected = normalize(quizCurrent.name);
  const correct = normalized === expected;

  quizAnswered = true;
  quizTotal += 1;
  if (correct) quizCorrect += 1;

  // Record result
  quizResults.push({
    adcode: quizCurrent.adcode,
    name: quizCurrent.name,
    correct,
  });

  // Mark as learned in localStorage (only affects dev mode)
  if (correct) {
    setDivision(quizCurrent.adcode, true);
  }

  if (onRenderCallback) onRenderCallback();

  return correct;
}

export function skipQuestion() {
  if (!quizActive || !quizCurrent) return;
  quizAnswered = true;
  quizTotal += 1;

  quizResults.push({
    adcode: quizCurrent.adcode,
    name: quizCurrent.name,
    correct: false,
  });

  if (onRenderCallback) onRenderCallback();
}

export function endQuiz() {
  quizActive = false;
  quizMode = null;
  quizProvinceAdcode = null;
  quizPool = [];
  quizUsed = new Set();
  quizResults = [];
  quizCurrent = null;
  quizAnswered = false;

  if (onEndCallback) onEndCallback();
}

export function getHighlightedAdcode() {
  return quizActive && quizCurrent ? quizCurrent.adcode : null;
}

export function getQuizHighlight() {
  if (!quizActive || !quizCurrent) return null;
  return {
    adcode: quizCurrent.adcode,
    provinceAdcode: quizCurrent.provinceAdcode,
  };
}

export function renderQuizUI() {
  if (!quizActive) {
    return renderQuizStartUI();
  }

  // Quiz finished — show detailed summary
  if (!quizCurrent) {
    const pct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
    return `
      <div class="quiz-panel quiz-feedback">
        <div class="quiz-done-title">复习完成</div>
        <div class="quiz-done-score">
          <strong>${quizCorrect}</strong> / ${quizTotal}
          <span class="quiz-done-pct">${pct}%</span>
        </div>
        <div class="quiz-result-list">
          ${quizResults.map((r) => `
            <div class="quiz-result-item ${r.correct ? "result-correct" : "result-wrong"}">
              <span class="quiz-result-icon">${r.correct ? "✓" : "✗"}</span>
              <span class="quiz-result-name">${r.name}</span>
            </div>
          `).join("")}
        </div>
        <div class="quiz-done-actions">
          <button class="quiz-btn quiz-btn-primary" type="button" id="quiz-end">结束</button>
        </div>
      </div>
    `;
  }

  const provinceName = quizCurrent.province;
  const remaining = quizPool.length - quizUsed.size;
  const scoreText = `${quizCorrect}/${quizTotal} · 剩余 ${remaining}`;

  if (quizAnswered) {
    return `
      <div class="quiz-panel quiz-feedback">
        <div class="quiz-score">得分：${scoreText}</div>
        <div class="quiz-answer-reveal">
          正确答案：<strong>${quizCurrent.name}</strong>
        </div>
        <button class="quiz-btn quiz-btn-next" type="button" id="quiz-next">下一题</button>
        <button class="quiz-btn quiz-btn-end" type="button" id="quiz-end">结束复习</button>
      </div>
    `;
  }

  return `
    <div class="quiz-panel">
      <div class="quiz-header">
        <span class="quiz-mode-label">${quizMode === "province" ? provinceName : "全国随机"}</span>
        <span class="quiz-score">得分：${scoreText}</span>
      </div>
      <div class="quiz-prompt">请输入地图上高亮区域的名称</div>
      <div class="quiz-input-row">
        <input type="text" id="quiz-answer" placeholder="输入名称..." autocomplete="off" />
        <button class="quiz-btn" type="button" id="quiz-submit">确认</button>
      </div>
      <div class="quiz-actions">
        <button class="quiz-btn quiz-btn-skip" type="button" id="quiz-skip">跳过</button>
        <button class="quiz-btn quiz-btn-end" type="button" id="quiz-end">结束复习</button>
      </div>
    </div>
  `;
}

function renderQuizStartUI() {
  const provinceEntries = Object.entries(PROVINCE_NAMES);

  return `
    <div class="quiz-panel quiz-start">
      <h3 class="quiz-title">复习模式</h3>
      <div class="quiz-mode-select">
        <button class="quiz-btn quiz-btn-primary" type="button" id="quiz-start-all">全部随机</button>
      </div>
      <div class="quiz-province-list">
        ${provinceEntries.map(([adcode, name]) => `
          <button class="quiz-province-btn" type="button" data-quiz-province="${adcode}">${shortName(name)}</button>
        `).join("")}
      </div>
    </div>
  `;
}

export function bindQuizEvents(container) {
  container.addEventListener("click", (event) => {
    const target = event.target;

    if (target.id === "quiz-start-all") {
      startQuizAll();
      return;
    }

    const provBtn = target.closest("[data-quiz-province]");
    if (provBtn) {
      startQuizProvince(provBtn.dataset.quizProvince);
      return;
    }

    if (target.id === "quiz-submit") {
      if (!quizActive || quizAnswered) return;
      const input = container.querySelector("#quiz-answer");
      if (input && input.value.trim()) {
        const correct = submitAnswer(input.value.trim());
        if (correct) {
          setTimeout(() => nextQuestion(), 800);
        }
      }
      return;
    }

    if (target.id === "quiz-skip") {
      skipQuestion();
      return;
    }

    if (target.id === "quiz-next") {
      nextQuestion();
      return;
    }

    if (target.id === "quiz-end") {
      endQuiz();
      return;
    }
  });

  container.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "quiz-answer") {
      const submitBtn = container.querySelector("#quiz-submit");
      if (submitBtn) submitBtn.click();
    }
  });
}

function shortName(name) {
  return name
    .replace("特别行政区", "")
    .replace("维吾尔自治区", "")
    .replace("壮族自治区", "")
    .replace("回族自治区", "")
    .replace("自治区", "")
    .replace("省", "")
    .replace("市", "");
}

function normalize(name) {
  return name
    .replace(/\s+/g, "")
    .replace(/市$/, "")
    .replace(/地区$/, "")
    .replace(/自治州$/, "")
    .replace(/盟$/, "")
    .replace(/特别行政区$/, "");
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
