/* ── Constantes ───────────────────────────────────────────── */
const MAX_TABLE      = 20;
const MAX_MULTIPLIER = 10;
const STORAGE_KEY    = "tabuada-jp-v2";

/* ── Estado ───────────────────────────────────────────────── */
const state = {
  screen:          "home",
  selectedTable:   1,
  currentQuestion: null,
  quizLocked:      false,
  examAnswers:     [],   // "ok" | "fail" | null
  voiceLang:       "pt-BR",   // "pt-BR" | "en-US"
  exam: { active: false, index: 0, total: 10, correct: 0, questions: [] }
};

/* ── Progresso ────────────────────────────────────────────── */
const defaultProgress = { attempts: 0, correct: 0, bestExam: 0, completedExams: 0, stars: 0 };

function getProgress() {
  try { return { ...defaultProgress, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; }
  catch { return { ...defaultProgress }; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

function trackAnswer(isCorrect) {
  const p = getProgress();
  p.attempts += 1;
  if (isCorrect) { p.correct += 1; p.stars += 1; }
  saveProgress(p);
}

function trackExam(score) {
  const p = getProgress();
  p.completedExams += 1;
  p.bestExam = Math.max(p.bestExam, score);
  p.stars   += score;
  saveProgress(p);
}

function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  speak("Progresso apagado. Bora do começo, João Pedro!");
  render();
}

/* ── Voz ──────────────────────────────────────────────────── */
let cachedVoice = null;

function getVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  if (lang === "en-US") {
    return voices.find(v => v.lang === "en-US")
        ?? voices.find(v => v.lang?.toLowerCase().startsWith("en"))
        ?? null;
  }
  // pt-BR (padrão)
  return voices.find(v => v.lang === "pt-BR")
      ?? voices.find(v => v.lang?.toLowerCase() === "pt-br")
      ?? voices.find(v => v.lang?.toLowerCase().startsWith("pt"))
      ?? null;
}

function ensureVoices() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
}

function toggleVoiceLang() {
  state.voiceLang = state.voiceLang === "pt-BR" ? "en-US" : "pt-BR";
  cachedVoice = null;
  const msg = state.voiceLang === "pt-BR"
    ? "Voz em português brasileiro ativada!"
    : "American English voice activated!";
  speak(msg);
  render();
}

function mulText(a, b) {
  if (state.voiceLang === "en-US")
    return `${a} times ${b} equals ${a * b}`;
  return `${a} vezes ${b} é igual a ${a * b}`;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const trySpeak = () => {
    const u  = new SpeechSynthesisUtterance(text);
    u.lang   = state.voiceLang;
    u.rate   = 0.82;
    u.pitch  = 1.1;
    u.volume = 1;
    const voice = getVoice(state.voiceLang);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => trySpeak();
  } else {
    trySpeak();
  }
}

/* ── Confete ──────────────────────────────────────────────── */
(function confettiEngine() {
  const canvas = document.getElementById("confetti-canvas");
  const ctx    = canvas.getContext("2d");
  let particles = [], animId = null;

  const COLORS = ["#7c3aed","#fbbf24","#f472b6","#22c55e","#60a5fa","#fb923c"];

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener("resize", resize);
  resize();

  function make(n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x:    Math.random() * canvas.width,
        y:    Math.random() * canvas.height * .4 - canvas.height * .2,
        r:    Math.random() * 9 + 4,
        dx:   (Math.random() - .5) * 5,
        dy:   Math.random() * 4 + 2,
        rot:  Math.random() * 360,
        drot: (Math.random() - .5) * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1
      });
    }
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > .01);
    if (!particles.length) { cancelAnimationFrame(animId); animId = null; return; }

    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      p.rot += p.drot; p.dy += .12;
      p.life -= .008;

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      ctx.restore();
    });

    animId = requestAnimationFrame(loop);
  }

  window.burstConfetti = function(n = 120) {
    make(n);
    if (!animId) animId = requestAnimationFrame(loop);
  };
})();

/* ── Questões ─────────────────────────────────────────────── */
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr)   { return [...arr].sort(() => Math.random() - .5); }

function makeQ() {
  const a = rnd(1, MAX_TABLE), b = rnd(1, MAX_MULTIPLIER), answer = a * b;
  const opts = new Set([answer]);
  while (opts.size < 4) {
    const w = answer + rnd(-15, 15);
    if (w > 0 && w !== answer) opts.add(w);
  }
  return { a, b, answer, options: shuffle([...opts]) };
}

/* ── Navegação ────────────────────────────────────────────── */
function go(screen) {
  window.speechSynthesis?.cancel();
  state.screen      = screen;
  state.quizLocked  = false;

  if (screen === "train") {
    state.currentQuestion = makeQ();
    state.exam.active     = false;
  } else if (screen === "exam") {
    state.exam = {
      active: true, index: 0, total: 10, correct: 0,
      questions: Array.from({ length: 10 }, makeQ)
    };
    state.examAnswers    = Array(10).fill(null);
    state.currentQuestion = state.exam.questions[0];
    speak("Prova iniciada. Responda com calma, João Pedro.");
  }

  render();
}

function selectTable(n) { state.selectedTable = n; render(); }

function hearTable(n) {
  const text = Array.from({ length: MAX_MULTIPLIER }, (_, i) =>
    mulText(n, i + 1)).join(". ");
  speak(`Tabuada do ${n}. ${text}.`);
}

/* ── Resposta ─────────────────────────────────────────────── */
function answer(choice) {
  if (state.quizLocked || !state.currentQuestion) return;
  state.quizLocked = true;

  const q         = state.currentQuestion;
  const isCorrect = choice === q.answer;
  trackAnswer(isCorrect);

  /* Feedback visual nos botões */
  document.querySelectorAll("[data-ans]").forEach(btn => {
    const v = Number(btn.dataset.ans);
    btn.disabled = true;
    if (v === q.answer)              btn.classList.add("correct");
    if (v === choice && !isCorrect)  btn.classList.add("wrong");
  });

  const fb = document.querySelector("#feedback");
  if (fb) {
    fb.textContent = isCorrect
      ? `🎉 Muito bem, João Pedro! ${q.a} × ${q.b} = ${q.answer}`
      : `💡 Quase! A resposta é ${q.answer}. (${q.a} × ${q.b})`;
    fb.className = `feedback ${isCorrect ? "good" : "bad"}`;
  }

  if (isCorrect) {
    speak(`Isso aí! ${mulText(q.a, q.b)}.`);
    burstConfetti(isCorrect && state.screen !== "exam" ? 80 : 50);
  } else {
    speak(`Quase. ${mulText(q.a, q.b)}.`);
  }

  if (state.screen === "exam") {
    if (isCorrect) state.exam.correct += 1;
    state.examAnswers[state.exam.index] = isCorrect ? "ok" : "fail";

    setTimeout(() => {
      const next = state.exam.index + 1;
      if (next >= state.exam.total) {
        finishExam();
      } else {
        state.exam.index      = next;
        state.currentQuestion = state.exam.questions[next];
        state.quizLocked      = false;
        render();
      }
    }, 1400);
  } else {
    setTimeout(() => {
      state.currentQuestion = makeQ();
      state.quizLocked      = false;
      render();
    }, 1500);
  }
}

function finishExam() {
  const score = state.exam.correct;
  trackExam(score);
  state.screen     = "result";
  state.quizLocked = false;

  if (score >= 9) {
    speak(`Perfeito! Você acertou ${score} de 10! João Pedro é demais!`);
    burstConfetti(200);
  } else if (score >= 7) {
    speak(`Muito bom! Você acertou ${score} de 10. Continue assim!`);
    burstConfetti(100);
  } else {
    speak(`Você acertou ${score} de 10. Bora treinar mais um pouco!`);
  }

  render();
}

/* ── Render helpers ───────────────────────────────────────── */
function renderHeader() {
  const online   = navigator.onLine ? "🟢 Online" : "🟡 Offline";
  const isBR     = state.voiceLang === "pt-BR";
  const flagActive   = isBR  ? "🇧🇷" : "🇺🇸";
  const flagInactive = isBR  ? "🇺🇸" : "🇧🇷";
  const langLabel    = isBR  ? "Português BR" : "English US";
  return `
    <section class="hero">
      <div class="hero-badge">📚 3ª Série · Tabuada com voz e jogos</div>
      <h1>Tabuada do<br><span>João Pedro</span></h1>
      <p>Estude, escute, treine e faça provas. Funciona no iPhone mesmo sem internet depois do primeiro acesso.</p>
      <div class="hero-pills">
        <button class="pill pill-lang" onclick="toggleVoiceLang()" title="Trocar idioma da voz">
          ${flagActive} ${langLabel} <span class="pill-switch">${flagInactive}</span>
        </button>
        <span class="pill">⭐ Progresso salvo</span>
        <span class="pill">📱 Instala no iPhone</span>
        <span class="pill">${online}</span>
      </div>
    </section>`;
}

function renderNav() {
  const items = [
    ["home",     "🏠", "Início"],
    ["study",    "📖", "Estudar"],
    ["listen",   "🔊", "Ouvir"],
    ["train",    "🎯", "Treinar"],
    ["progress", "⭐", "Progresso"]
  ];
  return `<nav class="nav">${items.map(([s, icon, label]) => `
    <button class="nav-btn${state.screen === s ? " active" : ""}" onclick="go('${s}')">
      <span class="nav-icon">${icon}</span>${label}
    </button>`).join("")}</nav>`;
}

function tableBtns() {
  return `<div class="table-selector">${
    Array.from({ length: MAX_TABLE }, (_, i) => {
      const n = i + 1;
      return `<button class="tbl-btn${state.selectedTable === n ? " sel" : ""}" onclick="selectTable(${n})">${n}</button>`;
    }).join("")
  }</div>`;
}

function mulList(n) {
  return `<div class="mul-list">${
    Array.from({ length: MAX_MULTIPLIER }, (_, i) => {
      const b = i + 1, r = n * b, text = mulText(n, b);
      return `<div class="mul-row">
        <div class="mul-text">${n} × ${b} = <em>${r}</em></div>
        <button class="sound-btn" onclick="speak('${text}')">🔊</button>
      </div>`;
    }).join("")
  }</div>`;
}

/* ── Telas ────────────────────────────────────────────────── */
function renderHome() {
  const p = getProgress();
  return `
    <div class="grid grid-2">
      <article class="card home-card">
        <div><div class="hc-icon hc-purple">📖</div>
          <h2>Estudar</h2><p>Tabuada do 1 ao 20 com letras grandes e botão de som.</p></div>
        <div class="btn-row"><button class="btn btn-purple" onclick="go('study')">Começar →</button></div>
      </article>
      <article class="card home-card">
        <div><div class="hc-icon hc-yellow">🔊</div>
          <h2>Ouvir</h2><p>Clique e escuta qualquer tabuada inteira em voz alta.</p></div>
        <div class="btn-row"><button class="btn btn-yellow" onclick="go('listen')">Ouvir →</button></div>
      </article>
      <article class="card home-card">
        <div><div class="hc-icon hc-pink">🎯</div>
          <h2>Treinar</h2><p>O app pergunta e João Pedro escolhe a resposta certa.</p></div>
        <div class="btn-row"><button class="btn btn-purple" onclick="go('train')">Treinar →</button></div>
      </article>
      <article class="card home-card">
        <div><div class="hc-icon hc-green">🏆</div>
          <h2>Prova</h2><p>10 perguntas aleatórias com pontuação e recompensas.</p></div>
        <div class="btn-row"><button class="btn btn-yellow" onclick="go('exam')">Fazer prova →</button></div>
      </article>
    </div>

    <div class="grid grid-3" style="margin-top:14px">
      <article class="card stat-card">
        <span class="stat-num">${p.correct}</span>
        <span class="stat-label">acertos</span>
      </article>
      <article class="card stat-card">
        <span class="stat-num">${p.attempts}</span>
        <span class="stat-label">tentativas</span>
      </article>
      <article class="card stat-card">
        <span class="stat-num">${p.stars}⭐</span>
        <span class="stat-label">estrelas</span>
      </article>
    </div>

    <div class="install-box" style="margin-top:14px">
      <strong>📱 Para instalar no iPhone:</strong><br>
      Abra no Safari → toque em Compartilhar ↑ → "Adicionar à Tela de Início".
      Depois abre igual a um app, mesmo sem internet!
    </div>`;
}

function renderStudy() {
  const n = state.selectedTable;
  return `
    <article class="card">
      <h2>Escolha a tabuada</h2>
      <p>Toque em um número para estudar.</p>
      ${tableBtns()}
    </article>
    <article class="card" style="margin-top:14px">
      <h2>Tabuada do ${n}</h2>
      <div class="btn-row">
        <button class="btn btn-purple" onclick="hearTable(${n})">🔊 Ouvir toda</button>
        <button class="btn btn-ghost"  onclick="window.speechSynthesis.cancel()">⏹ Parar</button>
      </div>
      ${mulList(n)}
    </article>`;
}

function renderListen() {
  const n = state.selectedTable;
  return `
    <article class="card">
      <h2>Ouvir a tabuada</h2>
      <p>Escolha uma tabuada e ouça tudo de uma vez.</p>
      ${tableBtns()}
      <div class="btn-row">
        <button class="btn btn-purple" onclick="hearTable(${n})">🔊 Ouvir tabuada do ${n}</button>
        <button class="btn btn-ghost"  onclick="window.speechSynthesis.cancel()">⏹ Parar voz</button>
      </div>
    </article>
    <article class="card" style="margin-top:14px">
      <h2>Linha por linha</h2>
      ${mulList(n)}
    </article>`;
}

function renderQuiz(title, subtitle) {
  const q = state.currentQuestion || makeQ();
  state.currentQuestion = q;

  const isExam = state.screen === "exam";
  const examBar = isExam ? `
    <div class="exam-bar">
      <div class="exam-dots">${state.examAnswers.map((a, i) => {
        let cls = i < state.exam.index ? (a === "ok" ? "done-ok" : "done-fail")
                : i === state.exam.index ? "current" : "";
        return `<div class="dot ${cls}"></div>`;
      }).join("")}</div>
      <div class="exam-score">${state.exam.correct} ✓</div>
    </div>` : "";

  return `
    <article class="card quiz-wrap">
      <h2>${title}</h2><p>${subtitle}</p>
      ${examBar}
      <div class="question-label">${q.a} × ${q.b}</div>
      <p class="q-sub">Qual é o resultado?</p>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="speak('Quanto é ${q.a} vezes ${q.b}?')">🔊 Ouvir</button>
      <div class="answers">
        ${q.options.map(o => `
          <button class="ans-btn" data-ans="${o}" onclick="answer(${o})">${o}</button>
        `).join("")}
      </div>
      <div id="feedback" class="feedback" style="display:none"></div>
    </article>`;
}

function renderResult() {
  const score = state.exam.correct;
  const stars  = score >= 9 ? "⭐⭐⭐" : score >= 7 ? "⭐⭐" : "⭐";
  const msg    = score >= 9 ? "Excelente! João Pedro mandou muito bem!"
               : score >= 7 ? "Muito bom! Falta pouco para ser craque."
               : score >= 5 ? "Bom começo. Vamos treinar mais um pouco!"
               :              "Não desista. Cada treino melhora!";
  return `
    <article class="card quiz-wrap">
      <h2>Resultado da prova 🏆</h2>
      <div class="result-score">${score}/10</div>
      <div class="stars-row">${stars}</div>
      <p style="margin-top:10px;font-size:18px;font-weight:800">${msg}</p>
      <div class="btn-row" style="justify-content:center;margin-top:20px">
        <button class="btn btn-purple" onclick="go('exam')">Fazer outra prova</button>
        <button class="btn btn-ghost"  onclick="go('train')">Treinar mais</button>
      </div>
    </article>`;
}

function renderProgress() {
  const p = getProgress();
  const pct = p.attempts > 0 ? Math.round(p.correct / p.attempts * 100) : 0;
  return `
    <div class="grid grid-3">
      ${[
        [p.correct,         "acertos"],
        [p.attempts,        "tentativas"],
        [`${pct}%`,         "aproveitamento"],
        [`${p.bestExam}/10`,"melhor prova"],
        [p.completedExams,  "provas feitas"],
        [`${p.stars}⭐`,    "estrelas"],
      ].map(([v, l]) => `
        <article class="card stat-card">
          <span class="stat-num">${v}</span>
          <span class="stat-label">${l}</span>
        </article>`).join("")}
    </div>
    <article class="card" style="margin-top:14px">
      <h2>Continue assim, João Pedro! 💪</h2>
      <p>Treinar um pouquinho todo dia é o segredo para sua cabeça ficar rápida nas contas.</p>
      <div class="btn-row">
        <button class="btn btn-purple" onclick="speak('Parabéns, João Pedro! Você está evoluindo muito. Continue treinando sua tabuada!')">🔊 Ouvir incentivo</button>
        <button class="btn btn-danger" onclick="if(confirm('Apagar todo o progresso?')) resetProgress()">🗑 Apagar progresso</button>
      </div>
    </article>`;
}

function renderContent() {
  if (state.screen === "home")     return renderHome();
  if (state.screen === "study")    return renderStudy();
  if (state.screen === "listen")   return renderListen();
  if (state.screen === "train")    return renderQuiz("Modo Treino 🎯", "Escolha a resposta certa. Se errar, o app explica.");
  if (state.screen === "exam")     return renderQuiz("Prova Oficial 🏆", "Responda 10 perguntas e veja sua pontuação.");
  if (state.screen === "result")   return renderResult();
  if (state.screen === "progress") return renderProgress();
  return renderHome();
}

/* ── Render principal ─────────────────────────────────────── */
function render() {
  document.querySelector("#app").innerHTML = `
    <main class="app-shell">
      ${renderHeader()}
      ${renderNav()}
      <div style="animation:slideUp .3s ease both">
        ${renderContent()}
      </div>
      <p class="footer">Feito com carinho para João Pedro estudar tabuada 💜</p>
    </main>`;

  /* Mostrar feedback box somente quando tiver conteúdo */
  const fb = document.querySelector("#feedback");
  if (fb) fb.style.display = fb.textContent.trim() ? "block" : "none";
}

/* ── Service Worker + init ────────────────────────────────── */
window.addEventListener("online",  render);
window.addEventListener("offline", render);
ensureVoices();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

render();
