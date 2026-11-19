const idleTimeoutMs = 2 * 60 * 1000;
let worker;
let idleTimer;
let nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url));
  worker.onmessage = ({ data }) => {
    const send = pending.get(data.id);
    if (data.type === "done") {
      pending.delete(data.id);
      if (!pending.size) idleTimer = setTimeout(stopWorker, idleTimeoutMs);
    }
    send?.(data);
  };
  worker.onerror = (event) => {
    for (const send of pending.values()) {
      send({ type: "done", error: event.message || "The model worker stopped." });
    }
    pending.clear();
    stopWorker();
  };
  return worker;
}

function stopWorker() {
  worker?.terminate();
  worker = undefined;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "summarizeTerms") return;
  let connected = true;
  port.onDisconnect.addListener(() => { connected = false; });
  port.onMessage.addListener(({ text }) => {
    if (typeof text !== "string" || !text.trim()) return;
    const send = (message) => {
      if (connected) port.postMessage(message);
    };
    const id = nextId++;
    try {
      const activeWorker = getWorker();
      clearTimeout(idleTimer);
      pending.set(id, send);
      activeWorker.postMessage({ id, text });
    } catch (error) {
      pending.delete(id);
      if (!pending.size) stopWorker();
      send({ type: "done", error: error.message });
    }
  });
});
