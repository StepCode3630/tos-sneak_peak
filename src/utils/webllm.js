// Load WebLLM
export async function loadWebLLM() {
  if (!window.WebLLM) {
    await import("@mlc-ai/web-llm");
  }
  return window.WebLLM;
}
