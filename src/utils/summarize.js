const encoder = new TextEncoder();
const sectionByteTarget = 8000;
const mergeBatchSize = 8;
const summaryInstruction =
  "Summarize these terms of service in three concise points.";
const notesInstruction =
  "Summarize the important terms. Preserve specific obligations, deadlines, fees, and privacy terms when present.";

async function complete(engine, instruction, text, maxTokens) {
  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: text },
    ],
    max_tokens: maxTokens,
  });
  const summary = result.choices[0]?.message.content?.trim();
  if (!summary) {
    throw new Error("The model did not return a summary. Please try again.");
  }
  return summary;
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

function splitAfterOverflow(text, error) {
  if (error.name !== "ContextWindowSizeExceededError") throw error;
  const split = splitNear(text, Math.floor(text.length / 2));
  if (split <= 0) throw error;
  return [text.slice(0, split).trimEnd(), text.slice(split).trimStart()];
}

async function addSectionNotes(engine, text, notes) {
  try {
    notes.push(await complete(engine, notesInstruction, text, 160));
  } catch (error) {
    for (const section of splitAfterOverflow(text, error)) {
      await addSectionNotes(engine, section, notes);
    }
  }
}

export async function summarizeTerms(engine, text) {
  console.log(engine, text);
  let chunks = [...sections(text)];
  if (chunks.length === 1) {
    try {
      return await complete(engine, summaryInstruction, chunks[0], 224);
    } catch (error) {
      chunks = splitAfterOverflow(chunks[0], error);
    }
  }

  let notes = [];
  for (const chunk of chunks) {
    await addSectionNotes(engine, chunk, notes);
  }

  // Merge multiple notes at once instead of generating a reply for every pair.
  while (notes.length > mergeBatchSize) {
    const merged = [];
    for (let i = 0; i < notes.length; i += mergeBatchSize) {
      const batch = notes.slice(i, i + mergeBatchSize);
      if (batch.length === 1) {
        merged.push(batch[0]);
      } else {
        merged.push(
          await complete(
            engine,
            `Combine these notes. ${notesInstruction}`,
            batch.join("\n\n"),
            160,
          ),
        );
      }
    }
    notes = merged;
  }
  return complete(
    engine,
    `Combine these notes. ${summaryInstruction}`,
    notes.join("\n\n"),
    224,
    console.log(summaryInstruction),
  );
}
