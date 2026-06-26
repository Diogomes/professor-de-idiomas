const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);
const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const defaultModel = process.env.MODEL || "professor-idiomas";
// Modelo base (sem system prompt enviesado) para geracao estruturada: garante
// que o idioma-alvo escolhido comande a saida. O professor-idiomas tinha um
// system prompt focado em japones que, num modelo pequeno, ignorava o idioma.
const structModel = process.env.STRUCT_MODEL || "qwen3:1.7b";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const languageNames = {
  japones: "japones",
  ingles: "ingles",
  espanhol: "espanhol",
  frances: "frances",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function callOllamaChat({ model, messages, format }) {
  const payload = {
    model: model || defaultModel,
    stream: false,
    messages: messages || [],
    options: { temperature: 0.4 },
  };
  if (format) payload.format = format;

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { status: response.status, text };
}

async function proxyChat(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const result = await callOllamaChat({
      model: payload.model,
      messages: payload.messages,
    });
    res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(result.text);
  } catch (error) {
    sendJson(res, 500, {
      error: "Nao foi possivel falar com o Ollama.",
      detail: error.message,
    });
  }
}

// Remove blocos de raciocinio (<think>...</think>) e cercas de codigo,
// devolvendo apenas o objeto JSON que o modelo produziu.
function extractJson(text) {
  if (!text) return null;
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/```json/gi, "").replace(/```/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = clean.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function japaneseNumberReading(n) {
  const base = {
    1: ["いち", "ichi"],
    2: ["に", "ni"],
    3: ["さん", "san"],
    4: ["よん", "yon"],
    5: ["ご", "go"],
    6: ["ろく", "roku"],
    7: ["なな", "nana"],
    8: ["はち", "hachi"],
    9: ["きゅう", "kyuu"],
    10: ["じゅう", "juu"],
    100: ["ひゃく", "hyaku"],
  };

  if (base[n]) return base[n];
  if (n < 20) {
    const [kana, romaji] = base[n - 10];
    return [`じゅう${kana}`, `juu ${romaji}`];
  }

  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const [tensKana, tensRomaji] = base[tens];
  const prefixKana = tens === 1 ? "" : tensKana;
  const prefixRomaji = tens === 1 ? "" : `${tensRomaji} `;
  if (ones === 0) return [`${prefixKana}じゅう`, `${prefixRomaji}juu`.trim()];

  const [onesKana, onesRomaji] = base[ones];
  return [`${prefixKana}じゅう${onesKana}`, `${prefixRomaji}juu ${onesRomaji}`.trim()];
}

function buildJapaneseNumbersLesson() {
  const vocabulary = Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    const [kana, romaji] = japaneseNumberReading(number);
    return {
      term: String(number),
      kana,
      phonetic: romaji,
      script: "numero + hiragana",
      translation: String(number),
      example: `${number}です。`,
      exampleKana: `${kana}です。`,
      exampleRomaji: `${romaji} desu.`,
      exampleTranslation: `E ${number}.`,
    };
  });

  return {
    intro:
      "Nesta aula voce vai aprender os numeros japoneses de 1 a 100, com leitura em hiragana, romaji e audio para praticar.",
    writing:
      "No dia a dia, numeros podem aparecer como algarismos arabicos (1, 2, 3), kanji (一, 二, 三) ou kana para estudo de leitura. Aqui mostramos o numero em algarismo, a leitura em hiragana e o romaji. Para formar dezenas, use じゅう (10): 20 e にじゅう, 21 e にじゅういち, 30 e さんじゅう, ate 100 que e ひゃく.",
    vocabulary,
    grammar:
      "A regra principal e combinar dezena + unidade. 10 e じゅう (juu). 20 e に + じゅう = にじゅう. 21 adiciona いち: にじゅういち. A mesma logica segue ate 99; 100 e ひゃく (hyaku).",
    tips: [
      "Use よん (yon) para 4 e なな (nana) para 7 nesta aula inicial, pois sao formas claras e comuns para contagem.",
      "Pratique primeiro 1 a 10, depois as dezenas exatas, e por fim combine dezena + unidade.",
      "Clique em Palavra para ouvir o numero inteiro e em Kana a kana para treinar a leitura por partes.",
    ],
    exercises: [
      {
        type: "multiple_choice",
        question: "Qual e a leitura de 21 em japones?",
        options: ["にじゅういち", "じゅうに", "さんじゅういち", "ひゃく"],
        answerIndex: 0,
        explanation: "21 e 20 + 1: にじゅう + いち = にじゅういち.",
      },
      {
        type: "multiple_choice",
        question: "Qual numero corresponde a さんじゅうご?",
        options: ["25", "35", "53", "30"],
        answerIndex: 1,
        explanation: "さんじゅう e 30, ご e 5; juntos formam 35.",
      },
      {
        type: "fill_blank",
        question: "Complete em kana: 48 = よんじゅう___",
        answer: "はち",
        answerRomaji: "hachi",
        translation: "48 = yonjuu hachi.",
      },
      {
        type: "translate",
        prompt: "Escreva 100 em japones, em kana e romaji.",
        answer: "ひゃく",
        answerKana: "ひゃく",
        answerRomaji: "hyaku",
      },
    ],
  };
}

function buildJapaneseSmallNumbersLesson() {
  const translations = {
    1: "um",
    2: "dois",
    3: "tres",
    4: "quatro",
    5: "cinco",
    6: "seis",
    7: "sete",
    8: "oito",
    9: "nove",
    10: "dez",
  };

  const vocabulary = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const [kana, romaji] = japaneseNumberReading(number);
    return {
      term: String(number),
      kana,
      phonetic: romaji,
      script: "numero + hiragana",
      translation: translations[number],
      example: `${number}です。`,
      exampleKana: `${kana}です。`,
      exampleRomaji: `${romaji} desu.`,
      exampleTranslation: `E ${translations[number]}.`,
    };
  });

  return {
    intro:
      "Nesta aula voce vai aprender os numeros japoneses de 1 a 10, com leitura em hiragana, romaji e traducao em portugues.",
    writing:
      "Para estudo inicial, mostramos os numeros como algarismos (1, 2, 3...), a leitura em hiragana e o romaji. Em japones, tambem existem kanji para numeros, como 一, 二 e 三, mas aqui o foco e falar e reconhecer de 1 a 10.",
    vocabulary,
    grammar:
      "Memorize primeiro 1 a 10: いち, に, さん, よん, ご, ろく, なな, はち, きゅう, じゅう. Eles sao a base para formar numeros maiores.",
    tips: [
      "Para 4, use よん (yon) nesta fase inicial.",
      "Para 7, use なな (nana) nesta fase inicial.",
      "Treine ouvindo cada numero e repetindo em voz alta.",
    ],
    exercises: [
      {
        type: "multiple_choice",
        question: "Qual e a leitura de 3 em japones?",
        options: ["さん", "に", "ご", "はち"],
        answerIndex: 0,
        explanation: "3 se le さん (san).",
      },
      {
        type: "multiple_choice",
        question: "Qual numero corresponde a なな?",
        options: ["4", "7", "9", "10"],
        answerIndex: 1,
        explanation: "なな (nana) significa 7.",
      },
      {
        type: "fill_blank",
        question: "Complete em kana: 10 = ___",
        answer: "じゅう",
        answerRomaji: "juu",
        translation: "10 = dez.",
      },
      {
        type: "translate",
        prompt: "Escreva 8 em japones, em kana e romaji.",
        answer: "はち",
        answerKana: "はち",
        answerRomaji: "hachi",
      },
    ],
  };
}

function fixedLesson({ language, title }) {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  if (language === "japones" && normalizedTitle === "numeros de 1 a 100") {
    return buildJapaneseNumbersLesson();
  }
  if (language === "japones" && normalizedTitle === "numeros de 1 a 10") {
    return buildJapaneseSmallNumbersLesson();
  }
  return null;
}

function buildLessonPrompt({ language, level, title, goal }) {
  const lang = languageNames[language] || "ingles";
  const isAlphabet = /alfabeto|som|pronuncia|vogai|letra|silab|escrita|leitura|romaj|kana|kanji|hiragana|katakana/i.test(
    title || ""
  );

  if (language === "japones") {
    const alphabetNote = isAlphabet
      ? '\n- Como este tema trata do alfabeto/sons, no campo "writing" explique os silabarios hiragana e katakana: as vogais あ/い/う/え/お e as colunas de consoantes (ka, sa, ta...). Em "vocabulary" use silabas/sons-chave (term em kana, phonetic em romaji).'
      : "";
    return buildJapanesePrompt({ level, title, goal, alphabetNote });
  }

  const alphabetNote = isAlphabet
    ? `\n- Como este tema trata do alfabeto/sons, em "grammar" explique o alfabeto de ${lang} e o som de cada letra/grafema importante, e em "vocabulary" use letras ou sons-chave com exemplos de palavras.`
    : "";
  return buildGeneralPrompt({ lang, level, title, goal, alphabetNote });
}

function buildJapanesePrompt({ level, title, goal, alphabetNote }) {
  return `Voce e um professor de japones. Crie o conteudo da aula de nivel ${level} com o tema "${title}".
Objetivo da aula: ${goal}

Em japones e essencial mostrar a ESCRITA corretamente. Para CADA palavra, preencha:
- "term": como a palavra realmente se escreve em japones (use kanji quando for natural, junto do kana; use katakana para estrangeirismos; ou apenas hiragana);
- "kana": a leitura completa em hiragana (ou katakana, se a palavra for em katakana);
- "phonetic": o romaji (letras latinas);
- "script": quais sistemas a palavra usa, por exemplo "kanji + hiragana", "somente hiragana" ou "katakana".

Responda APENAS com um objeto JSON valido, sem texto fora do JSON, sem comentarios e sem markdown, exatamente neste formato:
{
  "intro": "1 a 2 frases em portugues apresentando o tema",
  "writing": "explique em portugues, de forma curta, como este tema se escreve em japones: quando se usa hiragana, katakana e kanji aqui e como ler. Mostre os dois modos (kana e kanji/romaji) sempre que necessario.",
  "vocabulary": [
    { "term": "学生", "kana": "がくせい", "phonetic": "gakusei", "script": "kanji + hiragana", "translation": "estudante", "example": "私は学生です。", "exampleKana": "わたしはがくせいです。", "exampleRomaji": "watashi wa gakusei desu.", "exampleTranslation": "Eu sou estudante." }
  ],
  "grammar": "explicacao curta em portugues do ponto principal (gramatica, uso ou pronuncia)",
  "tips": ["dica curta 1", "dica curta 2"],
  "exercises": [
    { "type": "multiple_choice", "question": "pergunta em portugues", "options": ["a", "b", "c", "d"], "answerIndex": 0, "explanation": "por que esta correto" },
    { "type": "fill_blank", "question": "frase em japones (em kana) com ___ no lugar da palavra", "answer": "resposta em kana", "answerRomaji": "a mesma resposta em romaji", "translation": "traducao da frase completa" },
    { "type": "translate", "prompt": "frase em portugues para traduzir (peca a resposta em kana E em romaji)", "answer": "traducao em japones (kanji/kana)", "answerKana": "leitura completa em kana", "answerRomaji": "leitura completa em romaji" }
  ]
}

Regras:
- O exemplo "学生" acima e apenas para mostrar o FORMATO; nao o copie. Gere palavras e frases que pertencam ao tema "${title}".
- Use de 6 a 8 itens em "vocabulary", todos reais e corretos em japones.
- Garanta que "kana", "phonetic" (romaji) e "script" correspondam exatamente ao "term".
- Crie de 4 a 6 exercicios variados (multiple_choice, fill_blank e translate).
- Nos exercicios de escrita (fill_blank e translate), peca e aceite a resposta nas DUAS estruturas: em kana (ou kanji) E em romaji. Preencha "answer", "answerKana" e "answerRomaji" de forma coerente.
- Em multiple_choice, "answerIndex" e o indice (0 a 3) da opcao correta.
- Adapte a dificuldade ao nivel ${level}.${alphabetNote}
- Nao inclua nada alem do JSON.`;
}

function buildGeneralPrompt({ lang, level, title, goal, alphabetNote }) {
  return `Voce e um professor de ${lang}. Crie o conteudo da aula de nivel ${level} com o tema "${title}".
Objetivo da aula: ${goal}

Responda APENAS com um objeto JSON valido, sem texto fora do JSON, sem comentarios e sem markdown, exatamente neste formato:
{
  "intro": "1 a 2 frases em portugues apresentando o tema",
  "vocabulary": [
    {
      "term": "palavra ou frase em ${lang}",
      "phonetic": "pronuncia aproximada (transcricao simples)",
      "translation": "traducao em portugues",
      "example": "frase de exemplo em ${lang}",
      "exampleTranslation": "traducao da frase de exemplo em portugues"
    }
  ],
  "grammar": "explicacao curta em portugues do ponto principal (gramatica, uso ou pronuncia)",
  "tips": ["dica curta 1", "dica curta 2"],
  "exercises": [
    { "type": "multiple_choice", "question": "pergunta em portugues", "options": ["a", "b", "c", "d"], "answerIndex": 0, "explanation": "por que esta correto" },
    { "type": "fill_blank", "question": "frase em ${lang} com ___ no lugar da palavra", "answer": "palavra que completa", "translation": "traducao da frase completa" },
    { "type": "translate", "prompt": "frase em portugues para traduzir", "answer": "traducao em ${lang}" }
  ]
}

Regras:
- Use de 6 a 8 itens em "vocabulary", todos reais e corretos no idioma ${lang}.
- Crie de 4 a 6 exercicios variados (multiple_choice, fill_blank e translate).
- Em multiple_choice, "answerIndex" e o indice (0 a 3) da opcao correta.
- Adapte a dificuldade ao nivel ${level}.${alphabetNote}
- Nao inclua nada alem do JSON.`;
}

async function generateLesson(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const { language, level, title, goal, model } = payload;
    if (!title || !language || !level) {
      sendJson(res, 400, { error: "Campos obrigatorios: language, level, title." });
      return;
    }

    const fixed = fixedLesson({ language, title });
    if (fixed) {
      sendJson(res, 200, { lesson: fixed });
      return;
    }

    const prompt = buildLessonPrompt({ language, level, title, goal });
    const result = await callOllamaChat({
      model: model || structModel,
      messages: [{ role: "user", content: prompt }],
      format: "json",
    });

    let parsed = null;
    try {
      const outer = JSON.parse(result.text);
      const content = outer.message?.content ?? "";
      parsed = extractJson(content) || (typeof content === "object" ? content : null);
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.vocabulary)) {
      sendJson(res, 502, {
        error: "O modelo nao retornou um JSON de aula valido. Tente novamente.",
        raw: result.text.slice(0, 500),
      });
      return;
    }

    sendJson(res, 200, { lesson: parsed });
  } catch (error) {
    sendJson(res, 500, {
      error: "Nao foi possivel gerar a aula.",
      detail: error.message,
    });
  }
}

// System prompt do tutor de conversa: forca saida estruturada separando o
// idioma-alvo (escrita nativa) da explicacao em portugues do Brasil.
// Objetivo: conversa natural (o tutor reage e puxa o assunto) + correcao
// explicita dos erros do aluno, funcionando igual para todos os idiomas.
function buildTutorPrompt({ language, level, mode }) {
  const lang = languageNames[language] || "ingles";
  const latin = language !== "japones"; // japones usa escrita nao-latina

  // Exemplo COMPLETO e realista por idioma. Modelos pequenos copiam o que veem:
  // por isso todos os campos tem valores reais (nunca descricoes), "alvo" e uma
  // reacao diferente de "corrigido" e de "pergunta_alvo", e os campos _pt estao
  // de fato em portugues. Isso evita que o modelo ecoe placeholders ou duplique.
  const examples = {
    ingles: {
      correcao: "Pequena correcao: use 'have' (nao 'has') e o plural 'brothers'.",
      corrigido: "I have two brothers and I am happy.",
      alvo: "Nice to meet you, John! Two brothers, that's lovely.",
      leitura: "",
      traducao_pt: "Prazer em conhecer, John! Dois irmaos, que legal.",
      explicacao_pt: "Com 'I' usamos 'have', e o plural de 'brother' e 'brothers'.",
      pergunta_alvo: "How old are your brothers?",
      pergunta_pt: "Quantos anos seus irmaos tem?",
    },
    espanhol: {
      correcao: "Quase! O certo e 'me llamo Maria' e o plural 'dos perros'.",
      corrigido: "Hola, me llamo Maria y tengo dos perros.",
      alvo: "¡Hola, Maria! Me encantan los perros.",
      leitura: "",
      traducao_pt: "Ola, Maria! Eu adoro cachorros.",
      explicacao_pt: "Para dizer o nome use 'me llamo'; o plural de 'perro' e 'perros'.",
      pergunta_alvo: "¿Cómo se llaman tus perros?",
      pergunta_pt: "Como se chamam seus cachorros?",
    },
    frances: {
      correcao: "Pequeno ajuste: 'j'ai' (e nao 'je a') e o plural 'freres'.",
      corrigido: "J'ai deux freres.",
      alvo: "Enchante, Jean ! Deux freres, c'est super.",
      leitura: "",
      traducao_pt: "Prazer, Jean! Dois irmaos, que otimo.",
      explicacao_pt: "O verbo 'avoir' na 1a pessoa e 'j'ai'; o plural de 'frere' e 'freres'.",
      pergunta_alvo: "Quel âge ont tes freres ?",
      pergunta_pt: "Quantos anos seus irmaos tem?",
    },
    japones: {
      correcao: "Quase! O certo e 'わたしのなまえは...です'.",
      corrigido: "わたしのなまえはジョンです。",
      alvo: "はじめまして、ジョンさん！",
      leitura: "hajimemashite, Jon-san! shumi wa nan desu ka?",
      traducao_pt: "Prazer em conhece-lo, John!",
      explicacao_pt: "Para se apresentar: なまえ (nome) + は + [seu nome] + です.",
      pergunta_alvo: "しゅみはなんですか。",
      pergunta_pt: "Qual e o seu hobby?",
    },
  };
  const ex = examples[language] || examples.ingles;
  const exampleJson = JSON.stringify(ex, null, 2);

  return `Voce e um tutor particular de ${lang} conversando com um aluno brasileiro (idioma nativo: portugues do Brasil).
Nivel do aluno: ${level}. Modo: ${mode}.
Seu papel: manter uma conversa NATURAL no idioma-alvo (${lang}), reagindo ao que o aluno diz, e CORRIGIR os erros dele de forma gentil.

Responda SEMPRE com um unico objeto JSON valido, sem texto fora do JSON, sem markdown, com EXATAMENTE estes campos:
{
  "correcao": "comentario curto em portugues do Brasil sobre o erro do aluno; \\"\\" se nao houver erro ou for a primeira fala",
  "corrigido": "a frase do aluno reescrita CORRETA no idioma-alvo (${lang}), escrita nativa; \\"\\" se nao houver o que corrigir",
  "alvo": "a resposta NATURAL do tutor no idioma-alvo (${lang}), reagindo ao que o aluno disse. NAO repita a pergunta aqui",
  "leitura": ${latin ? '""' : '"romanizacao (romaji) de alvo + pergunta_alvo"'},
  "traducao_pt": "traducao de 'alvo' em portugues do Brasil",
  "explicacao_pt": "dica didatica curta em portugues do Brasil (gramatica, uso ou vocabulario)",
  "pergunta_alvo": "uma pergunta NOVA no idioma-alvo (${lang}) para o aluno responder. Deve ser DIFERENTE de 'alvo'",
  "pergunta_pt": "a mesma pergunta traduzida em portugues do Brasil"
}

Exemplo de saida bem formada (apenas o FORMATO; gere conteudo proprio para a conversa real):
${exampleJson}

Regras OBRIGATORIAS:
- "corrigido", "alvo" e "pergunta_alvo" devem estar 100% no idioma-alvo (${lang}) e na escrita nativa. NUNCA escreva portugues nesses campos.
- "correcao", "traducao_pt", "explicacao_pt" e "pergunta_pt" devem estar SOMENTE em portugues do Brasil. NUNCA escreva ${lang} nesses campos.
- Nunca misture os dois idiomas dentro do mesmo campo.
- "pergunta_alvo" tem que ser uma pergunta NOVA e DIFERENTE de "alvo" (nao copie a mesma frase nos dois campos).
${
  latin
    ? '- O idioma-alvo usa alfabeto latino: deixe "leitura" como string vazia "".'
    : '- O idioma-alvo (japones) NAO usa alfabeto latino: preencha "leitura" com a romanizacao (romaji) correta de "alvo" e "pergunta_alvo". Ex.: わたしのなまえ = "watashi no namae".'
}
- Se o aluno escreveu certo (ou e a primeira fala), deixe "correcao" e "corrigido" como "".
- Adapte a dificuldade ao nivel ${level} e ao modo ${mode}; mantenha as falas curtas e conversacionais.
- Se o pedido for "meta" (listar assuntos, dar instrucoes, sem frase de exemplo), deixe "correcao", "corrigido", "alvo", "leitura", "pergunta_alvo" e "pergunta_pt" como "" e escreva a resposta em "explicacao_pt".
- Nao inclua nada alem do JSON.`;
}

// Normaliza a resposta do tutor: garante strings, evita que "pergunta_alvo"
// seja identica a "alvo" (o modelo pequeno tende a duplicar) e remove um
// "corrigido" redundante quando nao ha de fato correcao.
function sanitizeTutor(parsed) {
  const t = { ...parsed };
  const norm = (v) => (typeof v === "string" ? v.trim() : "");
  for (const key of ["correcao", "corrigido", "alvo", "leitura", "traducao_pt", "explicacao_pt", "pergunta_alvo", "pergunta_pt"]) {
    t[key] = norm(t[key]);
  }
  // Se a pergunta repete exatamente a fala do tutor, descarta a duplicata:
  // a pergunta e o que move a conversa, entao mantemos ela e zeramos "alvo".
  if (t.alvo && t.pergunta_alvo && t.alvo === t.pergunta_alvo) {
    t.alvo = "";
    t.traducao_pt = "";
  }
  // "corrigido" so faz sentido quando ha uma correcao; senao vira ruido.
  if (t.corrigido && !t.correcao) {
    // mantem corrigido apenas se diferir de alvo (evita eco da propria resposta)
    if (t.corrigido === t.alvo) t.corrigido = "";
  }
  return t;
}

async function tutorReply(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");
    const {
      language = "ingles",
      level = "iniciante",
      mode = "conversacao",
      messages = [],
      model,
    } = payload;

    const system = buildTutorPrompt({ language, level, mode });
    const result = await callOllamaChat({
      model: model || structModel,
      messages: [{ role: "system", content: system }, ...messages],
      format: "json",
    });

    let parsed = null;
    try {
      const outer = JSON.parse(result.text);
      const content = outer.message?.content ?? "";
      parsed = extractJson(content) || (typeof content === "object" ? content : null);
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed !== "object") {
      sendJson(res, 502, {
        error: "O tutor nao retornou um JSON valido. Tente novamente.",
        raw: result.text.slice(0, 400),
      });
      return;
    }

    sendJson(res, 200, { tutor: sanitizeTutor(parsed) });
  } catch (error) {
    sendJson(res, 500, { error: "Nao foi possivel falar com o tutor.", detail: error.message });
  }
}

// Traducao gratuita e sem chave via MyMemory, util para todos os idiomas.
async function translateText(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const { text, from = "pt", to } = JSON.parse(rawBody || "{}");
    if (!text || !to) {
      sendJson(res, 400, { error: "Campos obrigatorios: text, to." });
      return;
    }
    const langpair = `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(langpair)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const translated = data?.responseData?.translatedText || "";
    if (!translated) {
      sendJson(res, 502, { error: "Servico de traducao nao retornou texto." });
      return;
    }
    sendJson(res, 200, { translated, from, to });
  } catch (error) {
    sendJson(res, 502, { error: "Falha ao traduzir.", detail: error.message });
  }
}

async function health(req, res) {
  let ollamaOk = false;
  let models = [];
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      ollamaOk = true;
      const data = await r.json();
      models = (data.models || []).map((m) => m.name);
    }
  } catch {
    ollamaOk = false;
  }
  sendJson(res, 200, { ok: true, ollamaUrl, ollamaOk, models, defaultModel });
}

function serveStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/api/chat" && req.method === "POST") {
    proxyChat(req, res);
    return;
  }

  if (req.url === "/api/lesson" && req.method === "POST") {
    generateLesson(req, res);
    return;
  }

  if (req.url === "/api/tutor" && req.method === "POST") {
    tutorReply(req, res);
    return;
  }

  if (req.url === "/api/translate" && req.method === "POST") {
    translateText(req, res);
    return;
  }

  if (req.url === "/api/health" && req.method === "GET") {
    health(req, res);
    return;
  }

  serveStatic(req, res);
});

function start(cb) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Interface ativa em http://localhost:${port}`);
    if (typeof cb === "function") cb(port);
  });
  return server;
}

// Executado direto (node server.js): sobe o servidor.
// Exigido pelo Electron (require): exporta start() para controlar o ciclo de vida.
if (require.main === module) {
  start();
}

module.exports = {
  start,
  get port() {
    return port;
  },
};
