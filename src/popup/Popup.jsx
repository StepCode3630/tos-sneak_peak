import React, { useState } from "react";
import "./Popup.css";
import { loadWebLLM } from "../utils/webllm";

function Popup() {
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "extractTos",
      });
      if (response?.error) {
        throw new Error(response.error);
      }
      const text = response?.text?.trim();
      if (!text) {
        throw new Error("No text found to summarize on this page.");
      }

      const { CreateMLCEngine } = await loadWebLLM();
      const engine = await CreateMLCEngine(
        "Llama-3.2-3B-Instruct-q4f32_1-MLC",
        { initProgressCallback: (progress) => console.log(progress) },
      );
      const result = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Summarize the user's terms of service in three points.",
          },
          { role: "user", content: text },
        ],
      });
      setSummary(result.choices[0].message.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="popup">
      <h1>CGU Summary</h1>
      <button onClick={handleSummarize} disabled={isLoading}>
        {isLoading ? "Loading..." : "Summary of the Terms of Service"}
      </button>
      {error && <p className="error">{error}</p>}
      {summary && (
        <div className="summary">
          <h2>Summary :</h2>
          <pre>{summary}</pre>
        </div>
      )}
    </div>
  );
}

export default Popup;
