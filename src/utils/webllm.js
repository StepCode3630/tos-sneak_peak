const model = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
let enginePromise;

export function loadEngine(initProgressCallback) {
  enginePromise ??= import("@mlc-ai/web-llm")
    .then(
      ({ CreateMLCEngine }) => CreateMLCEngine(model, { initProgressCallback }),
      console.log("load ok :", model),
    )
    .catch((error) => {
      enginePromise = undefined;
      throw error;
    });
  return enginePromise;
}
