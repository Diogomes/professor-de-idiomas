// ============================================================================
// webllm-client.js — roda um LLM DENTRO do navegador via WebGPU (projeto MLC
// WebLLM). E o que permite a versao GitHub Pages funcionar 100% sem servidor:
// o modelo e baixado uma vez (fica em cache no navegador) e toda a geracao de
// aulas e da conversa acontece localmente, offline depois da 1a carga.
//
// Requisitos: navegador com WebGPU (Chrome/Edge 113+, ou Safari 18+). Em
// navegadores sem WebGPU, isSupported() retorna false e a UI orienta o usuario.
// ============================================================================
(function (root) {
  "use strict";

  // CDN do WebLLM (ESM). Sem versao = sempre a mais recente; para travar uma
  // versao estavel, troque por "@mlc-ai/web-llm@0.2.79" (ou outra).
  const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm";

  // Modelos pre-compilados disponiveis no WebLLM (ids do prebuiltAppConfig).
  // Qwen2.5-1.5B fica proximo do qwen3:1.7b usado no desktop. O 0.5B e um
  // fallback bem mais leve para maquinas/GPUs modestas.
  const MODELS = [
    { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B (recomendado)", sizeMB: 1130 },
    { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 0.5B (leve)", sizeMB: 460 },
  ];
  const DEFAULT_MODEL = MODELS[0].id;

  let engine = null;
  let loadingPromise = null;

  const state = {
    ready: false,
    loading: false,
    modelId: DEFAULT_MODEL,
    progress: 0, // 0..1
    progressText: "",
    error: null,
  };

  function isSupported() {
    return typeof navigator !== "undefined" && !!navigator.gpu;
  }

  // Carrega o modelo (idempotente). onProgress recebe { progress, text }.
  function load(modelId, onProgress) {
    if (engine && state.ready && (!modelId || modelId === state.modelId)) {
      return Promise.resolve(engine);
    }
    if (loadingPromise) return loadingPromise;

    state.modelId = modelId || DEFAULT_MODEL;
    state.loading = true;
    state.error = null;

    loadingPromise = (async () => {
      try {
        const webllm = await import(/* @vite-ignore */ WEBLLM_CDN);
        const initProgressCallback = (report) => {
          state.progress = typeof report.progress === "number" ? report.progress : state.progress;
          state.progressText = report.text || "";
          if (typeof onProgress === "function") {
            onProgress({ progress: state.progress, text: state.progressText });
          }
        };
        engine = await webllm.CreateMLCEngine(state.modelId, { initProgressCallback });
        state.ready = true;
        return engine;
      } catch (err) {
        state.error = err && err.message ? err.message : String(err);
        engine = null;
        throw err;
      } finally {
        state.loading = false;
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  // Gera uma resposta JSON. `messages` segue o formato OpenAI/Ollama
  // ([{role, content}, ...]). Retorna a STRING de conteudo do modelo (o caller
  // faz o parsing com o LLMCore, igual ao caminho do servidor).
  async function chatJSON(messages, options) {
    if (!engine || !state.ready) {
      throw new Error("Modelo ainda nao carregado. Ative a IA do navegador primeiro.");
    }
    const opts = options || {};
    const completion = await engine.chat.completions.create({
      messages,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.4,
      max_tokens: opts.maxTokens || 1024,
      response_format: { type: "json_object" },
    });
    return completion.choices?.[0]?.message?.content || "";
  }

  root.WebLLMClient = {
    MODELS,
    DEFAULT_MODEL,
    state,
    isSupported,
    load,
    chatJSON,
    isReady: () => state.ready,
  };
})(typeof self !== "undefined" ? self : this);
