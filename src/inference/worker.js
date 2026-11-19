import { loadEngine, model } from "../utils/webllm.js";
import { summarizeTerms } from "../utils/summarize.js";

let queue = Promise.resolve();
let lastResult;
let modelReady = false;

self.onmessage = ({ data: { id, text } }) => {
  queue = queue.then(async () => {
    const send = (type, payload) => self.postMessage({ id, type, ...payload });
    const log = (message, details) => send("log", { message, details });
    try {
      if (lastResult?.text === text) {
        log("Reused cached summary");
        send("done", { result: lastResult.result });
        return;
      }

      let lastPercent;
      const loadingStarted = performance.now();
      log(modelReady ? "Reusing loaded model" : "Initializing model", { model });
      const engine = await loadEngine(({ progress }) => {
        const percent = Math.round(progress * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        send("status", { status: `Loading model… ${percent}%` });
      });
      if (!modelReady) {
        modelReady = true;
        log("Model ready", { elapsedMs: Math.round(performance.now() - loadingStarted) });
      }
      send("status", { status: "Summarizing…" });
      const generationStarted = performance.now();
      const result = await summarizeTerms(engine, text, log);
      log("Summary generated", {
        elapsedMs: Math.round(performance.now() - generationStarted),
        characters: result.summary.length,
        sections: result.sections.length,
      });
      if (result.summary) lastResult = { text, result };
      send("done", { result });
    } catch (error) {
      send("done", { error: error.message });
    }
  });
};
