import React, { useState, useEffect } from "react";
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
      const text = response.text;

      //  Sumarize with WebLLM
      const { CreateMLCEngine } = await loadWebLLM();
      const model = await window.WebLLM.CreateMLCEngine(
        "Llama-3.2-3B-Instruct-q4f32_1-MLC",
        { initProgressCallback: (progress) => console.log(progress) },
      );
      const prompt = `A 3-point summary of the following Terms of Service: ${text}`;
      const result = await model.generate(prompt);
      setSummary(result);
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
