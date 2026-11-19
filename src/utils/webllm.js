export const model = "Qwen3.5-0.8B-q4f16_1-MLC";
let enginePromise;

export function loadEngine(initProgressCallback) {
  enginePromise ??= import("@mlc-ai/web-llm")
    .then(({ CreateMLCEngine }) =>
      CreateMLCEngine(model, { initProgressCallback }),
    )
    .catch((error) => {
      enginePromise = undefined;
      throw error;
    });
  return enginePromise;
}
