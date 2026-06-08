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
const voiceGenderEl = document.querySelector("#voiceGender");

const history = [];
let activePlanLevel = "basico";
let availableVoices = [];

const languageConfig = {
  japones: { speechLang: "ja-JP", label: "Japones" },
  ingles: { speechLang: "en-US", label: "Ingles" },
  espanhol: { speechLang: "es-ES", label: "Espanhol" },
  frances: { speechLang: "fr-FR", label: "Frances" },
};

const femaleHints = ["female", "woman", "maria", "zira", "helena", "sabina", "lucia", "paulina", "ayumi", "haruka"];
const maleHints = ["male", "man", "david", "mark", "daniel", "pablo", "jorge", "ichiro", "keita"];

const lessonPlans = {
  basico: [
    {
      title: "Cumprimentos e apresentacao",
      goal: "Usar saudacoes, dizer o nome e iniciar uma conversa simples.",
      practice: "Criar um dialogo curto com professor e aluno.",
      topics: ["cumprimentos", "apresentacao pessoal", "frases uteis"],
      visual: "HI",
      examples: {
        japones: ["Konnichiwa", "Ohayou gozaimasu", "Watashi wa estudante desu"],
        ingles: ["Hello", "Good morning", "My name is Ana"],
        espanhol: ["Hola", "Buenos dias", "Me llamo Ana"],
        frances: ["Bonjour", "Bonsoir", "Je m'appelle Ana"],
      },
    },
    {
      title: "Alfabeto, sons e pronuncia",
      goal: "Reconhecer sons essenciais e evitar erros comuns de leitura.",
      practice: "Repeticao guiada com correcao de pronuncia escrita.",
      topics: ["alfabeto", "pronuncia", "sons basicos"],
      visual: "A B C",
      examples: {
        japones: ["a i u e o", "ka ki ku ke ko", "sa shi su se so"],
        ingles: ["A B C", "th", "world"],
        espanhol: ["a e i o u", "ll", "perro"],
        frances: ["a e i o u", "bonjour", "merci"],
      },
    },
    {
      title: "Numeros, dias e rotina",
      goal: "Falar idade, horarios, dias da semana e pequenas rotinas.",
      practice: "Responder perguntas sobre agenda e atividades do dia.",
      topics: ["numeros", "dias da semana", "rotina diaria"],
      visual: "1 2 3",
      examples: {
        japones: ["ichi ni san", "getsuyoubi", "mainichi benkyou shimasu"],
        ingles: ["one two three", "Monday", "I study every day"],
        espanhol: ["uno dos tres", "lunes", "estudio todos los dias"],
        frances: ["un deux trois", "lundi", "j'etudie tous les jours"],
      },
    },
  ],
  intermediario: [
    {
      title: "Conversacao do dia a dia",
      goal: "Manter uma conversa com perguntas, respostas e opinioes simples.",
      practice: "Simular atendimento, compra, restaurante ou encontro casual.",
      topics: ["conversacao diaria", "perguntas e respostas", "situacoes reais"],
      visual: "Q&A",
      examples: {
        japones: ["Kore wa ikura desu ka", "Mou ichido onegaishimasu", "Daijoubu desu"],
        ingles: ["How much is this", "Could you repeat that", "That works for me"],
        espanhol: ["Cuanto cuesta esto", "Puede repetir", "Esta bien para mi"],
        frances: ["Combien ca coute", "Vous pouvez repeter", "Ca me va"],
      },
    },
    {
      title: "Tempos verbais e conectores",
      goal: "Ligar ideias, falar de passado, presente, futuro e preferencias.",
      practice: "Escrever um paragrafo curto e receber correcao.",
      topics: ["tempos verbais", "conectores", "frases compostas"],
      visual: "T1 T2",
      examples: {
        japones: ["kinou benkyou shimashita", "demo muzukashii desu", "ashita renshuu shimasu"],
        ingles: ["I studied yesterday", "but it was difficult", "I will practice tomorrow"],
        espanhol: ["Estudie ayer", "pero fue dificil", "practicare manana"],
        frances: ["J'ai etudie hier", "mais c'etait difficile", "je vais pratiquer demain"],
      },
    },
    {
      title: "Escuta e resumo",
      goal: "Ouvir conteudo curto e resumir a ideia principal.",
      practice: "Assistir um video curto e explicar em 5 frases.",
      topics: ["listening", "compreensao oral", "resumo"],
      visual: "LISTEN",
      examples: {
        japones: ["kiite kudasai", "wakarimashita", "youyaku shimasu"],
        ingles: ["listen carefully", "I understood", "the main idea is"],
        espanhol: ["escucha con atencion", "entendi", "la idea principal es"],
        frances: ["ecoutez attentivement", "j'ai compris", "l'idee principale est"],
      },
    },
  ],
  avancado: [
    {
      title: "Debate e argumentacao",
      goal: "Defender opinioes com exemplos, contraste e conclusao.",
      practice: "Debater tecnologia, cultura, estudo ou trabalho.",
      topics: ["debate", "argumentacao", "opinioes avancadas"],
      visual: "IDEA",
      examples: {
        japones: ["watashi no iken de wa", "tatoeba", "ketsuron to shite"],
        ingles: ["in my opinion", "for instance", "to conclude"],
        espanhol: ["en mi opinion", "por ejemplo", "para concluir"],
        frances: ["a mon avis", "par exemple", "pour conclure"],
      },
    },
    {
      title: "Escrita formal e revisao",
      goal: "Produzir textos formais, e-mails e respostas profissionais.",
      practice: "Escrever um e-mail e revisar estilo, clareza e gramatica.",
      topics: ["escrita formal", "email profissional", "revisao de texto"],
      visual: "MAIL",
      examples: {
        japones: ["osewa ni natte orimasu", "yoroshiku onegai itashimasu", "gokakunin kudasai"],
        ingles: ["I hope this message finds you well", "please find attached", "kind regards"],
        espanhol: ["espero que se encuentre bien", "adjunto encontrara", "saludos cordiales"],
        frances: ["j'espere que vous allez bien", "veuillez trouver ci-joint", "cordialement"],
      },
    },
    {
      title: "Fluencia e expressao natural",
      goal: "Usar expressoes naturais e reduzir traducao mental.",
      practice: "Reformular frases para soar mais natural.",
      topics: ["fluencia", "expressoes naturais", "fala avancada"],
      visual: "FLOW",
      examples: {
        japones: ["sou desu ne", "naruhodo", "chotto matte kudasai"],
        ingles: ["that makes sense", "let me think", "I see what you mean"],
        espanhol: ["tiene sentido", "dejame pensar", "entiendo lo que quieres decir"],
        frances: ["ca a du sens", "laissez-moi reflechir", "je vois ce que vous voulez dire"],
      },
    },
  ],
};

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

    const listenButton = document.createElement("button");
    listenButton.className = "listen-button";
    listenButton.type = "button";
    listenButton.textContent = "Ouvir resposta";
    listenButton.addEventListener("click", () => speak(content));

    actions.appendChild(listenButton);
    el.appendChild(actions);
  }

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function contextMessage() {
  return `Idioma alvo: ${languageEl.value}. Nivel: ${levelEl.value}. Modo: ${modeEl.value}. Responda como professor particular, em portugues para explicacoes, e termine com um mini exercicio.`;
}

function youtubeUrl(topic) {
  const query = `${languageEl.value} ${topic} aula explicacao exercicios`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  availableVoices = window.speechSynthesis.getVoices();
}

function findVoice(lang, gender) {
  const voicesForLanguage = availableVoices.filter((voice) =>
    voice.lang && voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())
  );
  const hints = gender === "male" ? maleHints : femaleHints;
  const hinted = voicesForLanguage.find((voice) =>
    hints.some((hint) => voice.name.toLowerCase().includes(hint))
  );

  return hinted || voicesForLanguage[0] || availableVoices[0] || null;
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    addMessage("system", "Este navegador nao disponibilizou sintese de voz.");
    return;
  }

  refreshVoices();
  const config = languageConfig[languageEl.value] || languageConfig.ingles;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = config.speechLang;
  utterance.rate = 0.88;
  utterance.pitch = voiceGenderEl.value === "male" ? 0.88 : 1.08;

  const voice = findVoice(config.speechLang, voiceGenderEl.value);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function planPrompt(plan) {
  return `Crie uma aula de ${languageEl.value} para nivel ${activePlanLevel} sobre "${plan.title}". Objetivo: ${plan.goal} Pratica: ${plan.practice} Inclua explicacao, exemplos, exercicios e correcao esperada.`;
}

function renderLessonPlans() {
  lessonPlansEl.textContent = "";

  lessonPlans[activePlanLevel].forEach((plan) => {
    const card = document.createElement("article");
    card.className = "lesson-card";

    const topicLinks = plan.topics
      .map((topic) => `<a href="${youtubeUrl(topic)}" target="_blank" rel="noreferrer">${topic}</a>`)
      .join("");
    const examples = plan.examples[languageEl.value] || plan.examples.ingles;
    const exampleButtons = examples
      .map((example) => `<button class="audio-chip" type="button" data-speak="${example}">Ouvir: ${example}</button>`)
      .join("");

    card.innerHTML = `
      <div class="lesson-visual" aria-hidden="true">${plan.visual}</div>
      <div class="lesson-meta">${activePlanLevel}</div>
      <h4>${plan.title}</h4>
      <p>${plan.goal}</p>
      <div class="lesson-practice">${plan.practice}</div>
      <div class="audio-examples">${exampleButtons}</div>
      <div class="video-links">${topicLinks}</div>
      <button class="use-plan" type="button">Usar este plano</button>
    `;

    card.querySelectorAll(".audio-chip").forEach((button) => {
      button.addEventListener("click", () => speak(button.dataset.speak));
    });

    card.querySelector(".use-plan").addEventListener("click", () => {
      input.value = planPrompt(plan);
      input.focus();
    });

    lessonPlansEl.appendChild(card);
  });
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
      body: JSON.stringify({
        model: "professor-idiomas",
        messages: history.slice(-10),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) return;
  input.value = "";
  sendMessage(content);
});

newLessonButton.addEventListener("click", () => {
  input.value = `Monte uma aula curta de ${languageEl.value} para nivel ${levelEl.value}.`;
  input.focus();
});

levelTabs.forEach((button) => {
  button.addEventListener("click", () => {
    activePlanLevel = button.dataset.planLevel;
    levelTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    renderLessonPlans();
  });
});

languageEl.addEventListener("change", renderLessonPlans);

if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

renderLessonPlans();

addMessage(
  "assistant",
  "Bem-vindo ao laboratorio de idiomas da Gigaverse 3D. Escolha idioma, nivel e modo; depois peca uma aula, envie uma frase para correcao ou comece uma conversa."
);
