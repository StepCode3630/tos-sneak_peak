const encoder = new TextEncoder();
const sectionByteTarget = 8000;
// Bound direct Llama prompts conservatively, leaving space for the chat template and reply.
const quickSummaryByteLimit = 3300;
const mergeBatchSize = 8;
const evidenceInstruction =
  "Use only the supplied text. Omit topics it does not address. For claims about fees, data sharing, AI training, or user rights, include the source heading or a brief exact quote.";
const summaryInstruction =
  `Summarize the most important terms in up to five bullets. Use one short sentence per bullet and start each with '- '. No introduction or headings. Prioritize obligations, fees, renewal, cancellation, privacy, and disputes. ${evidenceInstruction}`;
const notesInstruction =
  `Write up to four concise notes about the key terms in this section. Preserve specific obligations, deadlines, fees, renewal, privacy, and governing law when mentioned. ${evidenceInstruction}`;

class OutputLimitError extends Error {}
class SummaryFormatError extends Error {}

async function complete(engine, instruction, text, maxTokens) {
  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: text },
    ],
    max_tokens: maxTokens,
  });
  const choice = result.choices[0];
  if (choice?.finish_reason === "length") {
    throw new OutputLimitError("The model ran out of space before finishing the summary.");
  }
  const summary = choice?.message.content?.trim();
  if (!summary) {
    throw new Error("The model did not return a summary. Please try again.");
  }
  return summary;
}

async function completeQuickSummary(engine, text, onLog) {
  const generate = async (instruction, maxBullets) => {
    const response = await complete(engine, instruction, text, 350);
    const bullets = response
      .split("\n")
      .map((line) => line.trim().match(/^(?:[-*•]|\d+[.)])\s+(.+)$/u)?.[1])
      .filter(Boolean);
    if (!bullets.length) {
      throw new SummaryFormatError("The model did not return a complete bullet list.");
    }
    return bullets.slice(0, maxBullets).map((bullet) => `• ${bullet}`).join("\n");
  };

  try {
    return await generate(summaryInstruction, 5);
  } catch (error) {
    if (!isIncompleteSummary(error)) throw error;
    onLog?.("Quick summary did not finish in the requested format. Retrying with three bullets");
    return generate(
      `Write up to three bullets of up to 15 words each. Start each with '- '. No introduction. ${evidenceInstruction}`,
      3,
    );
  }
}

function isIncompleteSummary(error) {
  return error instanceof OutputLimitError || error instanceof SummaryFormatError;
}

async function completeNotes(engine, instruction, text) {
  try {
    return await complete(engine, instruction, text, 192);
  } catch (error) {
    if (!(error instanceof OutputLimitError)) throw error;
    return complete(
      engine,
      `Write at most two short bullets about the most important terms. ${evidenceInstruction}`,
      text,
      192,
    );
  }
}

function splitNear(text, index) {
  const boundary = Math.max(
    text.lastIndexOf(" ", index),
    text.lastIndexOf("\n", index),
  );
  if (boundary > index / 2) return boundary;

  // Keep a UTF-16 surrogate pair together when there is no nearby space.
  const next = text.charCodeAt(index);
  return next >= 0xdc00 && next <= 0xdfff ? index - 1 : index;
}

function* sections(text) {
  const buffer = new Uint8Array(sectionByteTarget);
  let remaining = text.trim();
  while (remaining) {
    const { read } = encoder.encodeInto(remaining, buffer);
    const end = read === remaining.length ? read : splitNear(remaining, read);
    yield remaining.slice(0, end).trimEnd();
    remaining = remaining.slice(end).trimStart();
  }
}

function splitAfterOverflow(text, error, allowOutputRetry = false) {
  if (error.name !== "ContextWindowSizeExceededError" &&
      !(allowOutputRetry && error instanceof OutputLimitError && text.length > 500)) {
    throw error;
  }
  const split = splitNear(text, Math.floor(text.length / 2));
  if (split <= 0) throw error;
  return [text.slice(0, split).trimEnd(), text.slice(split).trimStart()];
}

async function addSectionNotes(engine, text, notes, onLog) {
  try {
    notes.push(await completeNotes(engine, notesInstruction, text));
  } catch (error) {
    const smallerSections = splitAfterOverflow(text, error, true);
    onLog?.("Model limit reached. Retrying with smaller sections", {
      characters: text.length,
    });
    for (const section of smallerSections) {
      await addSectionNotes(engine, section, notes, onLog);
    }
  }
}

export async function summarizeTerms(engine, text, onLog) {
  let chunks = [...sections(text)];
  onLog?.("Document split complete", { sections: chunks.length });
  if (chunks.length === 1 && encoder.encode(chunks[0]).length <= quickSummaryByteLimit) {
    try {
      return { summary: await completeQuickSummary(engine, chunks[0], onLog), sections: [] };
    } catch (error) {
      chunks = splitAfterOverflow(chunks[0], error);
      onLog?.("Context limit reached. Retrying with smaller sections", {
        characters: text.length,
      });
    }
  }

  const sectionNotes = [];
  for (const chunk of chunks) {
    await addSectionNotes(engine, chunk, sectionNotes, onLog);
  }

  try {
    // Batch the merge while retaining the detailed notes for the popup.
    let notes = sectionNotes;
    onLog?.("Combining section notes", { sections: notes.length });
    while (notes.length > mergeBatchSize) {
      const merged = [];
      for (let i = 0; i < notes.length; i += mergeBatchSize) {
        const batch = notes.slice(i, i + mergeBatchSize);
        merged.push(batch.length === 1 ? batch[0] : await completeNotes(
          engine,
          `Combine these notes. ${notesInstruction}`,
          batch.join("\n\n"),
        ));
      }
      notes = merged;
    }
    return {
      summary: await completeQuickSummary(engine, notes.join("\n\n"), onLog),
      sections: sectionNotes,
    };
  } catch (error) {
    if (!isIncompleteSummary(error) && error.name !== "ContextWindowSizeExceededError") {
      throw error;
    }
    onLog?.("Quick summary could not be completed. Showing section notes");
    return { summary: "", sections: sectionNotes };
  }
}
