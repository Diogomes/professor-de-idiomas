// ===== Elementos =====
const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const statusEl = document.querySelector("#status");
const languageEl = document.querySelector("#language");
const levelEl = document.querySelector("#level");
const modeEl = document.querySelector("#mode");
const newLessonButton = document.querySelector("#newLesson");
const lessonPlansEl = document.querySelector("#lessonPlans");
const levelTabs = document.querySelectorAll(".level-tab");
const viewTabs = document.querySelectorAll(".view-tab");
const voiceGenderEl = document.querySelector("#voiceGender");
const speechRateEl = document.querySelector("#speechRate");
const aiStatusEl = document.querySelector("#aiStatus");
const progressFillEl = document.querySelector("#progressFill");
const progressLabelEl = document.querySelector("#progressLabel");

// Overlay
const overlayEl = document.querySelector("#lessonOverlay");
const closeLessonBtn = document.querySelector("#closeLesson");
const lessonBadgeEl = document.querySelector("#lessonBadge");
const lessonTitleEl = document.querySelector("#lessonTitle");
const lessonGoalEl = document.querySelector("#lessonGoal");
const lessonImageEl = document.querySelector("#lessonImage");
const videoPosterEl = document.querySelector("#videoPoster");
const watchHereBtn = document.querySelector("#watchHere");
const watchYoutubeLink = document.querySelector("#watchYoutube");
const generateLessonBtn = document.querySelector("#generateLesson");
const practiceChatBtn = document.querySelector("#practiceChat");
const completeLessonBtn = document.querySelector("#completeLesson");
const lessonContentEl = document.querySelector("#lessonContent");
const topicSuggestionsEl = document.querySelector("#topicSuggestions");
const translateButton = document.querySelector("#translateButton");

// ===== Estado =====
const history = [];
let activePlanLevel = "basico";
let availableVoices = [];
let currentLesson = null; // { level, index, data }
let aiAvailable = false;

const languageConfig = {
  japones: { speechLang: "ja-JP", label: "Japones", code: "ja" },
  ingles: { speechLang: "en-US", label: "Ingles", code: "en" },
  espanhol: { speechLang: "es-ES", label: "Espanhol", code: "es" },
  frances: { speechLang: "fr-FR", label: "Frances", code: "fr" },
};

// Assuntos sugeridos para a conversacao, por faixa de nivel.
const conversationTopics = {
  iniciante: [
    "Apresentar-se", "Falar da familia", "Pedir comida", "Falar do tempo",
    "Hobbies e lazer", "Minha rotina diaria", "No mercado", "Pedir direcoes",
  ],
  basico: [
    "Apresentar-se", "Falar da familia", "Pedir comida", "Falar do tempo",
    "Hobbies e lazer", "Minha rotina diaria", "No mercado", "Pedir direcoes",
  ],
  intermediario: [
    "Planejar uma viagem", "Falar do trabalho", "Contar uma historia",
    "Opiniao sobre filmes", "Planos para o futuro", "Falar de saude",
    "Cultura e tradicoes", "Resolver um imprevisto",
  ],
  avancado: [
    "Debate sobre tecnologia", "Atualidades e noticias", "Negociar um acordo",
    "Cultura e identidade", "Meio ambiente", "Entrevista de emprego",
    "Argumentar e convencer", "Humor e ironia",
  ],
};

const femaleHints = ["female", "woman", "maria", "zira", "helena", "sabina", "lucia", "paulina", "ayumi", "haruka", "google"];
const maleHints = ["male", "man", "david", "mark", "daniel", "pablo", "jorge", "ichiro", "keita"];

const curriculum = window.CURRICULUM || { basico: [], intermediario: [], avancado: [] };

// ===== Audio (Web Speech) =====
function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  availableVoices = window.speechSynthesis.getVoices();
}

function findVoice(lang, gender) {
  const voicesForLanguage = availableVoices.filter(
    (voice) => voice.lang && voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())
  );
  const hints = gender === "male" ? maleHints : femaleHints;
  const hinted = voicesForLanguage.find((voice) =>
    hints.some((hint) => voice.name.toLowerCase().includes(hint))
  );
  return hinted || voicesForLanguage[0] || availableVoices[0] || null;
}

function speak(text, { slow = false } = {}) {
  if (!("speechSynthesis" in window)) {
    addMessage("system", "Este navegador nao disponibilizou sintese de voz.");
    return;
  }
  refreshVoices();
  const config = languageConfig[languageEl.value] || languageConfig.ingles;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = config.speechLang;
  const baseRate = Number(speechRateEl.value) || 0.9;
  utterance.rate = slow ? Math.max(0.4, baseRate - 0.35) : baseRate;
  utterance.pitch = voiceGenderEl.value === "male" ? 0.9 : 1.06;
  const voice = findVoice(config.speechLang, voiceGenderEl.value);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// Soletra letra a letra (sonoridade de cada letra/som)
function spell(text) {
  const letters = Array.from(text).filter((ch) => ch.trim());
  if (!letters.length) return;
  const config = languageConfig[languageEl.value] || languageConfig.ingles;
  window.speechSynthesis.cancel();
  letters.forEach((ch, i) => {
    const u = new SpeechSynthesisUtterance(ch);
    u.lang = config.speechLang;
    u.rate = 0.6;
    u.pitch = voiceGenderEl.value === "male" ? 0.9 : 1.06;
    const voice = findVoice(config.speechLang, voiceGenderEl.value);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  });
}

// ===== Chat =====
function addMessage(role, content) {
  const el = document.createElement("article");
  el.className = `message ${role}`;
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = content;
  el.appendChild(body);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const listen = document.createElement("button");
    listen.className = "listen-button";
    listen.type = "button";
    listen.textContent = "Ouvir";
    listen.addEventListener("click", () => speak(content));
    const slow = document.createElement("button");
    slow.className = "listen-button";
    slow.type = "button";
    slow.textContent = "Ouvir devagar";
    slow.addEventListener("click", () => speak(content, { slow: true }));
    actions.append(listen, slow);
    el.appendChild(actions);
  }

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function contextMessage() {
  return `Idioma alvo: ${languageEl.value}. Nivel: ${levelEl.value}. Modo: ${modeEl.value}. Responda como professor particular, em portugues para explicacoes, e termine com um mini exercicio.`;
}

async function sendMessage(content) {
  const userContent = `${contextMessage()}\n\nPedido do aluno: ${content}`;
  history.push({ role: "user", content: userContent });
  addMessage("user", content);

  statusEl.textContent = "Pensando";
  sendButton.disabled = true;
  input.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "professor-idiomas", messages: history.slice(-10) }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const answer = data.message?.content || "Nao recebi uma resposta valida.";
    history.push({ role: "assistant", content: answer });
    addMessage("assistant", answer);
    statusEl.textContent = "Pronto";
  } catch (error) {
    statusEl.textContent = "Erro";
    addMessage("system", `Nao consegui falar com o Ollama. Detalhe: ${error.message}`);
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// ===== Sugestoes de assunto e traducao =====
function topicLevelKey() {
  return conversationTopics[levelEl.value] ? levelEl.value : "basico";
}

function startTopic(topic) {
  switchView("chat");
  sendMessage(
    `Vamos conversar sobre "${topic}". Comece a conversa: diga uma frase no idioma alvo, mostre a traducao em portugues e me faca uma pergunta simples para eu responder. Mantenha as falas curtas e corrija meus erros.`
  );
}

function suggestTopicsAI() {
  switchView("chat");
  sendMessage(
    "Sugira 5 assuntos de conversa adequados ao meu nivel e me pergunte qual deles eu prefiro praticar agora. Liste os assuntos de forma curta e numerada."
  );
}

function renderTopics() {
  if (!topicSuggestionsEl) return;
  topicSuggestionsEl.textContent = "";
  conversationTopics[topicLevelKey()].forEach((topic) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "topic-chip";
    chip.textContent = topic;
    chip.addEventListener("click", () => startTopic(topic));
    topicSuggestionsEl.appendChild(chip);
  });
  const ai = document.createElement("button");
  ai.type = "button";
  ai.className = "topic-chip ai";
  ai.textContent = "💡 Novos assuntos (IA)";
  ai.addEventListener("click", suggestTopicsAI);
  topicSuggestionsEl.appendChild(ai);
}

async function translateInput() {
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  const cfg = languageConfig[languageEl.value] || languageConfig.ingles;
  translateButton.disabled = true;
  const original = translateButton.textContent;
  translateButton.textContent = "Traduzindo...";
  try {
    const r = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, from: "pt", to: cfg.code }),
    });
    const d = await r.json();
    if (!r.ok || !d.translated) throw new Error(d.error || `HTTP ${r.status}`);
    addMessage("assistant", `Traducao (pt → ${cfg.label.toLowerCase()}):\n${d.translated}`);
  } catch (e) {
    addMessage("system", `Nao consegui traduzir: ${e.message}`);
  } finally {
    translateButton.disabled = false;
    translateButton.textContent = original;
  }
}

// ===== Progresso (localStorage) =====
function progressKey(level) {
  return `pdi:progress:${languageEl.value}:${level}`;
}
function getCompleted(level) {
  try {
    return new Set(JSON.parse(localStorage.getItem(progressKey(level)) || "[]"));
  } catch {
    return new Set();
  }
}
function setCompleted(level, set) {
  localStorage.setItem(progressKey(level), JSON.stringify([...set]));
}
function toggleCompleted(level, index) {
  const set = getCompleted(level);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  setCompleted(level, set);
  return set.has(index);
}

function renderProgress() {
  const total = (curriculum[activePlanLevel] || []).length;
  const done = getCompleted(activePlanLevel).size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  progressFillEl.style.width = `${pct}%`;
  progressLabelEl.textContent = `${done} / ${total} concluidas`;
}

// ===== Midia =====
function imageUrl(keyword, lockId) {
  const tags = keyword.trim().split(/\s+/).join(",");
  return `https://loremflickr.com/640/380/${encodeURIComponent(tags)}?lock=${lockId}`;
}
function youtubeSearchUrl(keyword) {
  const query = `${languageConfig[languageEl.value].label} ${keyword} aula para iniciantes`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
function youtubeEmbedUrl(keyword) {
  const query = `${languageConfig[languageEl.value].label} ${keyword} aula`;
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`;
}

// ===== Cache de aula gerada pela IA =====
function lessonCacheKey(level, index) {
  return `pdi:lesson:v2:${languageEl.value}:${level}:${index}`;
}
function loadCachedLesson(level, index) {
  try {
    return JSON.parse(localStorage.getItem(lessonCacheKey(level, index)) || "null");
  } catch {
    return null;
  }
}
function saveCachedLesson(level, index, data) {
  try {
    localStorage.setItem(lessonCacheKey(level, index), JSON.stringify(data));
  } catch {
    /* storage cheio: ignora */
  }
}

// ===== Grade do curriculo =====
function renderLessonPlans() {
  lessonPlansEl.textContent = "";
  const completed = getCompleted(activePlanLevel);
  (curriculum[activePlanLevel] || []).forEach((plan, index) => {
    const card = document.createElement("article");
    card.className = "lesson-card" + (completed.has(index) ? " done" : "");

    const num = index + 1;
    card.innerHTML = `
      <div class="card-top">
        <span class="lesson-number">${num}</span>
        <span class="lesson-check" aria-hidden="true">✓</span>
      </div>
      <h4>${plan.t}</h4>
      <p>${plan.g}</p>
      <span class="lesson-focus">${plan.f}</span>
    `;
    card.addEventListener("click", () => openLesson(activePlanLevel, index));
    lessonPlansEl.appendChild(card);
  });
  renderProgress();
}

// ===== Overlay de aula =====
function openLesson(level, index) {
  const plan = curriculum[level][index];
  currentLesson = { level, index, data: null };

  lessonBadgeEl.textContent = `${level} - aula ${index + 1}`;
  lessonTitleEl.textContent = plan.t;
  lessonGoalEl.textContent = plan.g;

  // Imagem tematica
  lessonImageEl.src = imageUrl(plan.k, level.charCodeAt(0) * 100 + index);
  lessonImageEl.onerror = () => {
    lessonImageEl.removeAttribute("src");
    lessonImageEl.parentElement.classList.add("img-fallback");
    lessonImageEl.parentElement.dataset.label = plan.t;
  };
  lessonImageEl.parentElement.classList.remove("img-fallback");

  // Video
  watchYoutubeLink.href = youtubeSearchUrl(plan.k);
  videoPosterEl.innerHTML = '<span class="play-icon">▶</span><p>Video-aula do tema</p>';
  videoPosterEl.classList.remove("playing");

  // Estado do conteudo
  const cached = loadCachedLesson(level, index);
  if (cached) {
    currentLesson.data = cached;
    renderLessonData(cached);
  } else {
    lessonContentEl.innerHTML = `<div class="empty-content">
      <p>Clique em <strong>Gerar conteudo com IA</strong> para criar vocabulario, explicacao e exercicios desta aula em ${languageConfig[languageEl.value].label.toLowerCase()}.</p>
    </div>`;
  }
  updateCompleteButton();

  overlayEl.hidden = false;
  document.body.classList.add("modal-open");
}

function closeLesson() {
  overlayEl.hidden = true;
  document.body.classList.remove("modal-open");
  window.speechSynthesis && window.speechSynthesis.cancel();
}

function updateCompleteButton() {
  if (!currentLesson) return;
  const done = getCompleted(currentLesson.level).has(currentLesson.index);
  completeLessonBtn.textContent = done ? "Concluida ✓ (desfazer)" : "Marcar como concluida";
  completeLessonBtn.classList.toggle("active", done);
}

// ===== Geracao de conteudo via IA =====
async function generateLesson() {
  if (!currentLesson) return;
  const { level, index } = currentLesson;
  const plan = curriculum[level][index];

  generateLessonBtn.disabled = true;
  generateLessonBtn.textContent = "Gerando...";
  lessonContentEl.innerHTML = `<div class="loading">A IA local esta montando a aula... isso pode levar alguns segundos.</div>`;

  try {
    const res = await fetch("/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: languageEl.value, level, title: plan.t, goal: plan.g }),
    });
    const data = await res.json();
    if (!res.ok || !data.lesson) throw new Error(data.error || `HTTP ${res.status}`);

    currentLesson.data = data.lesson;
    saveCachedLesson(level, index, data.lesson);
    renderLessonData(data.lesson);
  } catch (error) {
    lessonContentEl.innerHTML = `<div class="empty-content error">
      <p>Nao foi possivel gerar o conteudo: ${error.message}</p>
      <p>Verifique se o Ollama esta ativo e tente novamente. Voce ainda pode usar a imagem, o video e o chat.</p>
    </div>`;
  } finally {
    generateLessonBtn.disabled = false;
    generateLessonBtn.textContent = currentLesson.data ? "Regenerar conteudo" : "Gerar conteudo com IA";
  }
}

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?;:'"()。、！？\s]/g, "")
    .trim();
}

function attr(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Respostas aceitas para um exercicio: inclui kana e romaji quando houver.
function acceptableAnswers(exercise) {
  const list = [exercise.answer, exercise.answerKana, exercise.answerRomaji];
  if (Array.isArray(exercise.accept)) list.push(...exercise.accept);
  return list.filter(Boolean).map(normalize);
}

// Texto da resposta mostrando as duas estruturas (kana / romaji) quando existirem.
function answerDisplay(exercise) {
  const parts = [];
  if (exercise.answer) parts.push(exercise.answer);
  if (exercise.answerKana && exercise.answerKana !== exercise.answer) parts.push(exercise.answerKana);
  if (exercise.answerRomaji) parts.push(exercise.answerRomaji);
  return parts.join("  /  ");
}

function renderLessonData(lesson) {
  lessonContentEl.textContent = "";

  if (lesson.intro) {
    const intro = document.createElement("p");
    intro.className = "lesson-intro";
    intro.textContent = lesson.intro;
    lessonContentEl.appendChild(intro);
  }

  // Escrita (japones): hiragana / katakana / kanji
  if (lesson.writing) {
    const w = document.createElement("section");
    w.className = "content-block writing-block";
    const p = document.createElement("p");
    p.textContent = lesson.writing;
    w.innerHTML = `<h5>Como se escreve (hiragana / katakana / kanji)</h5>`;
    w.appendChild(p);
    lessonContentEl.appendChild(w);
  }

  // Vocabulario
  if (Array.isArray(lesson.vocabulary) && lesson.vocabulary.length) {
    const isJa = languageEl.value === "japones";
    const section = document.createElement("section");
    section.className = "content-block";
    section.innerHTML = `<h5>Vocabulario e pronuncia</h5>`;
    const list = document.createElement("div");
    list.className = "vocab-list";

    lesson.vocabulary.forEach((item) => {
      const row = document.createElement("div");
      row.className = "vocab-item";

      const term = item.term || "";
      const kana = item.kana || "";
      const romaji = item.phonetic || "";
      const spellTarget = isJa && kana ? kana : term; // japones: soletra kana a kana

      let head = `<div class="vocab-term"><strong>${term}</strong>`;
      if (isJa && kana && kana !== term) head += ` <span class="kana">${kana}</span>`;
      if (romaji) head += ` <span class="phonetic">[${romaji}]</span>`;
      head += `</div>`;
      if (isJa && item.script) head += `<span class="script-badge">${item.script}</span>`;

      let example = "";
      if (item.example) {
        const exTrans = item.exampleTranslation ? ` <em>— ${item.exampleTranslation}</em>` : "";
        const exReading = isJa
          ? `${item.exampleKana ? `<div class="ex-reading">${item.exampleKana}</div>` : ""}${
              item.exampleRomaji ? `<div class="ex-reading romaji">${item.exampleRomaji}</div>` : ""
            }`
          : "";
        example = `<div class="vocab-example"><span lang="target">${item.example}</span>${exReading}${exTrans}</div>`;
      }

      row.innerHTML = `
        <div class="vocab-main">
          ${head}
          <div class="vocab-translation">${item.translation || ""}</div>
          ${example}
        </div>
        <div class="vocab-audio">
          <button class="audio-chip" type="button" data-speak="${attr(term)}">🔊 Palavra</button>
          <button class="audio-chip" type="button" data-spell="${attr(spellTarget)}">${
            isJa ? "🔡 Kana a kana" : "🔡 Letra a letra"
          }</button>
          ${
            item.example
              ? `<button class="audio-chip" type="button" data-speak="${attr(item.example)}">🔊 Frase</button>`
              : ""
          }
        </div>`;
      list.appendChild(row);
    });
    section.appendChild(list);
    lessonContentEl.appendChild(section);
  }

  // Gramatica / explicacao
  if (lesson.grammar) {
    const g = document.createElement("section");
    g.className = "content-block";
    g.innerHTML = `<h5>Explicacao</h5><p>${lesson.grammar}</p>`;
    lessonContentEl.appendChild(g);
  }

  // Dicas
  if (Array.isArray(lesson.tips) && lesson.tips.length) {
    const t = document.createElement("section");
    t.className = "content-block";
    t.innerHTML = `<h5>Dicas</h5><ul>${lesson.tips.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    lessonContentEl.appendChild(t);
  }

  // Exercicios
  if (Array.isArray(lesson.exercises) && lesson.exercises.length) {
    const ex = document.createElement("section");
    ex.className = "content-block";
    ex.innerHTML = `<h5>Exercicios</h5>`;
    const box = document.createElement("div");
    box.className = "exercises";
    lesson.exercises.forEach((exercise, i) => box.appendChild(renderExercise(exercise, i)));
    ex.appendChild(box);
    lessonContentEl.appendChild(ex);
  }

  // Liga botoes de audio
  lessonContentEl.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => speak(btn.dataset.speak));
  });
  lessonContentEl.querySelectorAll("[data-spell]").forEach((btn) => {
    btn.addEventListener("click", () => spell(btn.dataset.spell));
  });
}

function renderExercise(exercise, i) {
  const card = document.createElement("div");
  card.className = "exercise";
  const type = exercise.type || "multiple_choice";

  if (type === "multiple_choice" && Array.isArray(exercise.options)) {
    card.innerHTML = `<p class="ex-q"><span class="ex-num">${i + 1}</span> ${exercise.question || ""}</p>`;
    const opts = document.createElement("div");
    opts.className = "ex-options";
    exercise.options.forEach((opt, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ex-option";
      b.textContent = opt;
      b.addEventListener("click", () => {
        if (opts.dataset.answered) return;
        opts.dataset.answered = "1";
        const correct = idx === exercise.answerIndex;
        b.classList.add(correct ? "correct" : "wrong");
        if (!correct) {
          const right = opts.children[exercise.answerIndex];
          if (right) right.classList.add("correct");
        }
        showFeedback(card, correct, exercise.explanation);
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);
  } else if (type === "fill_blank") {
    const isJa = languageEl.value === "japones";
    card.innerHTML = `<p class="ex-q"><span class="ex-num">${i + 1}</span> Complete: ${exercise.question || ""}</p>`;
    const wrap = document.createElement("div");
    wrap.className = "ex-input-row";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = isJa ? "Resposta em kana ou romaji" : "Sua resposta";
    const check = document.createElement("button");
    check.type = "button";
    check.className = "ghost";
    check.textContent = "Verificar";
    check.addEventListener("click", () => {
      const ok = acceptableAnswers(exercise).includes(normalize(inp.value));
      inp.classList.toggle("correct", ok);
      inp.classList.toggle("wrong", !ok);
      showFeedback(
        card,
        ok,
        ok
          ? exercise.translation || ""
          : `Resposta: ${answerDisplay(exercise)}${exercise.translation ? " — " + exercise.translation : ""}`
      );
    });
    wrap.append(inp, check);
    card.appendChild(wrap);
  } else if (type === "translate") {
    const isJa = languageEl.value === "japones";
    const ask = isJa ? " (responda em kana e/ou romaji)" : "";
    card.innerHTML = `<p class="ex-q"><span class="ex-num">${i + 1}</span> Traduza${ask}: ${
      exercise.prompt || exercise.question || ""
    }</p>`;
    const wrap = document.createElement("div");
    wrap.className = "ex-input-row";
    const ta = document.createElement("input");
    ta.type = "text";
    ta.placeholder = isJa ? "Sua traducao (kana ou romaji)" : "Sua traducao";
    const check = document.createElement("button");
    check.type = "button";
    check.className = "ghost";
    check.textContent = "Verificar";
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "ghost";
    reveal.textContent = "Ver resposta";
    const addHear = () => {
      if (card.querySelector(".hear-answer")) return;
      const h = document.createElement("button");
      h.type = "button";
      h.className = "audio-chip hear-answer";
      h.textContent = "🔊 Ouvir resposta";
      h.addEventListener("click", () => speak(exercise.answer));
      card.appendChild(h);
    };
    check.addEventListener("click", () => {
      const accepts = acceptableAnswers(exercise);
      const ok = accepts.length > 0 && accepts.includes(normalize(ta.value));
      ta.classList.toggle("correct", ok);
      ta.classList.toggle("wrong", !ok);
      showFeedback(card, ok, ok ? "" : `Resposta sugerida: ${answerDisplay(exercise)}`);
      addHear();
    });
    reveal.addEventListener("click", () => {
      showFeedback(card, null, `Resposta sugerida: ${answerDisplay(exercise)}`);
      addHear();
    });
    wrap.append(ta, check, reveal);
    card.appendChild(wrap);
  } else {
    card.innerHTML = `<p class="ex-q"><span class="ex-num">${i + 1}</span> ${exercise.question || exercise.prompt || ""}</p>`;
  }

  return card;
}

function showFeedback(card, correct, text) {
  let fb = card.querySelector(".ex-feedback");
  if (!fb) {
    fb = document.createElement("p");
    fb.className = "ex-feedback";
    card.appendChild(fb);
  }
  fb.classList.remove("ok", "no", "neutral");
  if (correct === true) fb.classList.add("ok");
  else if (correct === false) fb.classList.add("no");
  else fb.classList.add("neutral");
  const prefix = correct === true ? "Correto! " : correct === false ? "Quase la. " : "";
  fb.textContent = prefix + (text || "");
}

// ===== Acoes do overlay =====
watchHereBtn.addEventListener("click", () => {
  if (!currentLesson) return;
  const plan = curriculum[currentLesson.level][currentLesson.index];
  videoPosterEl.classList.add("playing");
  videoPosterEl.innerHTML = `<iframe src="${youtubeEmbedUrl(plan.k)}" title="Video-aula"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen referrerpolicy="origin"></iframe>`;
});

practiceChatBtn.addEventListener("click", () => {
  if (!currentLesson) return;
  const plan = curriculum[currentLesson.level][currentLesson.index];
  input.value = `Quero praticar a aula "${plan.t}" de ${languageEl.value} (nivel ${currentLesson.level}). Objetivo: ${plan.g} Conduza uma conversa guiada com correcao.`;
  closeLesson();
  switchView("chat");
  input.focus();
});

completeLessonBtn.addEventListener("click", () => {
  if (!currentLesson) return;
  toggleCompleted(currentLesson.level, currentLesson.index);
  updateCompleteButton();
  renderLessonPlans();
});

generateLessonBtn.addEventListener("click", generateLesson);
closeLessonBtn.addEventListener("click", closeLesson);
overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) closeLesson();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !overlayEl.hidden) closeLesson();
});

// ===== Navegacao =====
function switchView(view) {
  viewTabs.forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  document.querySelector("#view-trilha").classList.toggle("active", view === "trilha");
  document.querySelector("#view-chat").classList.toggle("active", view === "chat");
  if (view === "chat") renderTopics();
}
viewTabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));

levelTabs.forEach((button) => {
  button.addEventListener("click", () => {
    activePlanLevel = button.dataset.planLevel;
    levelTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    renderLessonPlans();
  });
});

languageEl.addEventListener("change", () => {
  renderLessonPlans();
  renderTopics();
});

levelEl.addEventListener("change", renderTopics);
translateButton.addEventListener("click", translateInput);

// ===== Chat: submit =====
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) return;
  input.value = "";
  sendMessage(content);
});

newLessonButton.addEventListener("click", () => {
  switchView("chat");
  input.value = `Monte uma aula curta de ${languageEl.value} para nivel ${levelEl.value}.`;
  input.focus();
});

// ===== Health / status da IA =====
async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const d = await r.json();
    aiAvailable = !!d.ollamaOk;
    if (d.ollamaOk) {
      aiStatusEl.textContent = `IA local ativa (${d.models.length} modelo(s))`;
      aiStatusEl.classList.add("ok");
    } else {
      aiStatusEl.textContent = "IA local offline - inicie o Ollama";
      aiStatusEl.classList.add("off");
    }
  } catch {
    aiStatusEl.textContent = "Servidor sem resposta";
    aiStatusEl.classList.add("off");
  }
}

// ===== Inicializacao =====
if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

renderLessonPlans();
renderTopics();
checkHealth();

addMessage(
  "assistant",
  "Bem-vindo ao laboratorio de idiomas da Gigaverse 3D. Use a Trilha de aulas para seguir as 50 aulas graduais de cada nivel (com imagem, video, audio e exercicios), ou escolha um assunto sugerido abaixo para comecar uma conversa guiada. Tambem da para escrever em portugues e tocar em Traduzir."
);
