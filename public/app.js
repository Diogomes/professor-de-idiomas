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

// Mapa central idioma -> locale/voz (BCP-47). Fonte unica do TTS.
// "latin": escrita latina (sem necessidade de romanizacao). pt-BR fica
// reservado caso um dia se queira ler explicacoes (hoje, nao se le PT).
const languageConfig = {
  japones: { speechLang: "ja-JP", label: "Japones", code: "ja", latin: false },
  ingles: { speechLang: "en-US", label: "Ingles", code: "en", latin: true },
  espanhol: { speechLang: "es-ES", label: "Espanhol", code: "es", latin: true },
  frances: { speechLang: "fr-FR", label: "Frances", code: "fr", latin: true },
  portugues: { speechLang: "pt-BR", label: "Portugues", code: "pt", latin: true },
};

function targetConfig() {
  return languageConfig[languageEl.value] || languageConfig.ingles;
}

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

// Fala uma sequencia de textos SEMPRE no locale do idioma-alvo selecionado.
// Usada para falar apenas os campos do idioma-alvo (nunca os campos em PT).
function speakSequence(texts, { slow = false } = {}) {
  const clean = (texts || []).map((t) => (t || "").trim()).filter(Boolean);
  if (!clean.length || !("speechSynthesis" in window)) return;
  refreshVoices();
  const config = targetConfig();
  const baseRate = Number(speechRateEl.value) || 0.9;
  const voice = findVoice(config.speechLang, voiceGenderEl.value);
  window.speechSynthesis.cancel();
  clean.forEach((text) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = config.speechLang;
    u.rate = slow ? Math.max(0.4, baseRate - 0.35) : baseRate;
    u.pitch = voiceGenderEl.value === "male" ? 0.9 : 1.06;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  });
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== Chat =====
// Botoes de audio que falam APENAS textos do idioma-alvo (em sequencia).
function buildAudioActions(targetTexts) {
  const clean = (targetTexts || []).filter(Boolean);
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const listen = document.createElement("button");
  listen.className = "listen-button";
  listen.type = "button";
  listen.textContent = "🔊 Ouvir";
  listen.addEventListener("click", () => speakSequence(clean));
  const slow = document.createElement("button");
  slow.className = "listen-button";
  slow.type = "button";
  slow.textContent = "🐢 Devagar";
  slow.addEventListener("click", () => speakSequence(clean, { slow: true }));
  actions.append(listen, slow);
  return actions;
}

// Mensagem simples (texto). Audio opcional, falado SOMENTE se audioText for um
// texto no idioma-alvo. Mensagens em PT (sistema, boas-vindas) ficam sem audio.
function addMessage(role, content, { audioText = null } = {}) {
  const el = document.createElement("article");
  el.className = `message ${role}`;
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = content;
  el.appendChild(body);
  if (audioText) el.appendChild(buildAudioActions([audioText]));
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Mensagem estruturada do tutor: separa idioma-alvo (escrita nativa, com audio)
// da explicacao/traducao em PT-BR (sem audio).
function addTutorMessage(fields) {
  const f = fields || {};
  const lang = targetConfig().label;
  const el = document.createElement("article");
  el.className = "message assistant tutor";

  const hasAlvo = f.alvo && f.alvo.trim();
  const hasPergunta = f.pergunta_alvo && f.pergunta_alvo.trim();

  // Bloco da frase no idioma-alvo
  if (hasAlvo) {
    const block = document.createElement("div");
    block.className = "tutor-target";
    block.innerHTML = `<span class="tt-label">${lang}</span>
      <p class="tt-alvo" lang="target">${escapeHtml(f.alvo)}</p>
      ${f.leitura && f.leitura.trim() ? `<p class="tt-reading">${escapeHtml(f.leitura)}</p>` : ""}`;
    block.appendChild(buildAudioActions([f.alvo])); // audio so do alvo (escrita nativa)
    el.appendChild(block);
  }

  // Traducao em PT (sem audio)
  if (f.traducao_pt && f.traducao_pt.trim()) {
    const tr = document.createElement("p");
    tr.className = "tutor-pt";
    tr.innerHTML = `<span class="tt-tag">PT</span> ${escapeHtml(f.traducao_pt)}`;
    el.appendChild(tr);
  }

  // Explicacao didatica em PT (sem audio)
  if (f.explicacao_pt && f.explicacao_pt.trim()) {
    const ex = document.createElement("p");
    ex.className = "tutor-explain";
    ex.textContent = f.explicacao_pt;
    el.appendChild(ex);
  }

  // Pergunta no idioma-alvo (com audio) + traducao em PT
  if (hasPergunta) {
    const block = document.createElement("div");
    block.className = "tutor-target question";
    block.innerHTML = `<span class="tt-label">Pergunta - ${lang}</span>
      <p class="tt-alvo" lang="target">${escapeHtml(f.pergunta_alvo)}</p>`;
    block.appendChild(buildAudioActions([f.pergunta_alvo]));
    el.appendChild(block);
    if (f.pergunta_pt && f.pergunta_pt.trim()) {
      const pq = document.createElement("p");
      pq.className = "tutor-pt";
      pq.innerHTML = `<span class="tt-tag">PT</span> ${escapeHtml(f.pergunta_pt)}`;
      el.appendChild(pq);
    }
  }

  // Sem nenhum campo reconhecido: mostra algo para nao ficar vazio.
  if (!el.querySelector(".tutor-target, .tutor-pt, .tutor-explain")) {
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = "(o tutor nao retornou conteudo legivel)";
    el.appendChild(body);
  }

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage(content) {
  history.push({ role: "user", content });
  addMessage("user", content);

  statusEl.textContent = "Pensando";
  sendButton.disabled = true;
  input.disabled = true;

  try {
    const response = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: languageEl.value,
        level: levelEl.value,
        mode: modeEl.value,
        messages: history.slice(-10),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const fields = data.tutor || {};
    addTutorMessage(fields);

    // Guarda no historico um texto legivel (para o modelo manter contexto).
    const recon = [f0(fields)].filter(Boolean).join("");
    history.push({ role: "assistant", content: recon || "(sem conteudo)" });
    statusEl.textContent = "Pronto";
  } catch (error) {
    statusEl.textContent = "Erro";
    addMessage("system", `Nao consegui falar com o tutor. Detalhe: ${error.message}`);
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// Reconstrucao textual de um turno do tutor para guardar no historico.
function f0(f) {
  return [f.alvo, f.leitura, f.traducao_pt, f.explicacao_pt, f.pergunta_alvo, f.pergunta_pt]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(" | ");
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
    // Texto-alvo com audio; o PT (origem) fica como referencia, sem audio.
    addTutorMessage({ alvo: d.translated, traducao_pt: text });
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
// Video fixado para a aula no idioma atual (ex.: alfabeto japones), se houver.
function pinnedVideoId(plan) {
  return (plan.videos && plan.videos[languageEl.value]) || null;
}
function youtubeEmbedById(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}
function youtubeWatchById(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

// Gojuon: silabario basico japones [romaji, hiragana, katakana].
const GOJUON = [
  ["a", "あ", "ア"], ["i", "い", "イ"], ["u", "う", "ウ"], ["e", "え", "エ"], ["o", "お", "オ"],
  ["ka", "か", "カ"], ["ki", "き", "キ"], ["ku", "く", "ク"], ["ke", "け", "ケ"], ["ko", "こ", "コ"],
  ["sa", "さ", "サ"], ["shi", "し", "シ"], ["su", "す", "ス"], ["se", "せ", "セ"], ["so", "そ", "ソ"],
  ["ta", "た", "タ"], ["chi", "ち", "チ"], ["tsu", "つ", "ツ"], ["te", "て", "テ"], ["to", "と", "ト"],
  ["na", "な", "ナ"], ["ni", "に", "ニ"], ["nu", "ぬ", "ヌ"], ["ne", "ね", "ネ"], ["no", "の", "ノ"],
  ["ha", "は", "ハ"], ["hi", "ひ", "ヒ"], ["fu", "ふ", "フ"], ["he", "へ", "ヘ"], ["ho", "ほ", "ホ"],
  ["ma", "ま", "マ"], ["mi", "み", "ミ"], ["mu", "む", "ム"], ["me", "め", "メ"], ["mo", "も", "モ"],
  ["ya", "や", "ヤ"], ["yu", "ゆ", "ユ"], ["yo", "よ", "ヨ"],
  ["ra", "ら", "ラ"], ["ri", "り", "リ"], ["ru", "る", "ル"], ["re", "れ", "レ"], ["ro", "ろ", "ロ"],
  ["wa", "わ", "ワ"], ["wo", "を", "ヲ"], ["n", "ん", "ン"],
];

// Tabela interativa do alfabeto japones (toque para ouvir cada som).
function buildKanaSection() {
  const section = document.createElement("section");
  section.className = "content-block kana-block";
  section.innerHTML = `<h5>Alfabeto japones: hiragana e katakana</h5>
    <p class="kana-intro">O japones usa tres escritas. Comece pelos dois silabarios:
    <strong>hiragana</strong> (palavras japonesas) e <strong>katakana</strong> (palavras estrangeiras).
    Cada simbolo e uma silaba. Toque em qualquer um para ouvir o som.</p>`;
  const grid = document.createElement("div");
  grid.className = "kana-grid";
  GOJUON.forEach(([romaji, hira, kata]) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "kana-cell";
    cell.innerHTML = `<span class="kana-hira">${hira}</span><span class="kana-kata">${kata}</span><span class="kana-romaji">${romaji}</span>`;
    cell.addEventListener("click", () => speak(hira));
    grid.appendChild(cell);
  });
  section.appendChild(grid);
  return section;
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

  // Video: usa o video fixado para o idioma atual, se houver; senao, busca.
  const pinned = pinnedVideoId(plan);
  currentLesson.kana = !!plan.kana && languageEl.value === "japones";
  watchYoutubeLink.href = pinned ? youtubeWatchById(pinned) : youtubeSearchUrl(plan.k);
  videoPosterEl.classList.remove("playing");
  videoPosterEl.innerHTML = pinned
    ? '<span class="play-icon">▶</span><p>Video-aula recomendada</p>'
    : '<span class="play-icon">▶</span><p>Video-aula do tema</p>';

  // Estado do conteudo
  const cached = loadCachedLesson(level, index);
  if (cached) {
    currentLesson.data = cached;
    renderLessonData(cached);
  } else {
    lessonContentEl.textContent = "";
    if (currentLesson.kana) lessonContentEl.appendChild(buildKanaSection());
    const empty = document.createElement("div");
    empty.className = "empty-content";
    empty.innerHTML = `<p>Clique em <strong>Gerar conteudo com IA</strong> para criar vocabulario, explicacao e exercicios desta aula em ${languageConfig[languageEl.value].label.toLowerCase()}.</p>`;
    lessonContentEl.appendChild(empty);
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

  // Tabela de kana (hiragana/katakana) na aula de alfabeto em japones.
  if (currentLesson && currentLesson.kana) lessonContentEl.appendChild(buildKanaSection());

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
  const pinned = pinnedVideoId(plan);
  const src = pinned ? youtubeEmbedById(pinned) : youtubeEmbedUrl(plan.k);
  videoPosterEl.classList.add("playing");
  videoPosterEl.innerHTML = `<iframe src="${src}" title="Video-aula"
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
