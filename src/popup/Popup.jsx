import React, { useState } from "react";
import "./Popup.css";
import { summarizeTerms } from "../utils/summarize.js";
import { loadEngine } from "../utils/webllm.js";

function Popup() {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  const handleSummarize = async () => {
    setStatus("Reading page…");
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

      setStatus("Loading model…");
      console.log("Loading model…");

      const engine = await loadEngine(({ progress }) => {
        setStatus(`Loading model… ${Math.round(progress * 100)}%`);
      });
      setStatus("Summarizing…");
      console.log("Summarizing…");
      setSummary(await summarizeTerms(engine, text));
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("");
    }
  };

  return (
    <div className="popup">
      <h1>CGU Summary</h1>
      <button onClick={handleSummarize} disabled={Boolean(status)}>
        {status || "Summary of the Terms of Service"}
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
