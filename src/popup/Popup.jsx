import React, { useState } from "react";
import "./Popup.css";

async function requestSummary(text, onStatus) {
  const preparation = await chrome.runtime.sendMessage({ action: "prepareInference" });
  if (!preparation?.ready) {
    throw new Error(preparation?.error ?? "Could not start the model worker.");
  }

  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: "summarizeTerms" });
    port.onDisconnect.addListener(() => {
      reject(new Error(chrome.runtime.lastError?.message ?? "The model worker disconnected."));
    });
    port.onMessage.addListener((message) => {
      if (message.type === "status") {
        onStatus(message.status);
      } else if (message.type === "log") {
        console.log(`[ToS] ${message.message}`, message.details ?? "");
      } else if (message.type === "done") {
        port.disconnect();
        if (message.error) reject(new Error(message.error));
        else resolve(message.result);
      }
    });
    port.postMessage({ text });
  });
}

function Popup() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  const handleSummarize = async () => {
    const started = performance.now();
    console.log("[ToS] Reading page");
    setStatus("Reading page…");
    setError(null);
    setResult(null);
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
      console.log("[ToS] Page text ready", {
        characters: text.length,
        elapsedMs: Math.round(performance.now() - started),
      });

      setStatus("Loading model…");
      setResult(await requestSummary(text, setStatus));
      console.log(`[ToS] Summary ready in ${((performance.now() - started) / 1000).toFixed(1)} s`);
    } catch (err) {
      console.error("[ToS] Summary failed", err);
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
      {result && (
        <div className="summary">
          {result.summary ? (
            <>
              <h2>Quick summary</h2>
              <ul>
                {result.summary.split("\n").map((bullet, index) => (
                  <li key={index}>{bullet.slice(2)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>The model couldn’t finish the quick summary. See the section notes below.</p>
          )}
          {result.sections.length > 0 && (
            <details open={!result.summary}>
              <summary>Section notes ({result.sections.length})</summary>
              <ol>
                {result.sections.map((notes, index) => (
                  <li key={index}>{notes}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default Popup;
