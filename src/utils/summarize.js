const encoder = new TextEncoder();
const sectionByteLimit = 3400;
const summaryInstruction = "Summarize these terms of service in three points.";
const notesInstruction =
  "Summarize the important terms in this section. Preserve specific obligations, deadlines, fees, and privacy terms when present.";

async function complete(engine, instruction, text) {
  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: text },
    ],
    max_tokens: 256,
  });
  const summary = result.choices[0]?.message.content?.trim();
  if (!summary) {
    throw new Error("The model did not return a summary. Please try again.");
  }
  return summary;
}

function splitSection(text) {
  const midpoint = Math.floor(text.length / 2);
  const boundary = text.lastIndexOf(" ", midpoint);
  let split = boundary > midpoint / 2 ? boundary : midpoint;
  // Keep a UTF-16 surrogate pair together when there is no nearby space.
  const next = text.charCodeAt(split);
  if (next >= 0xdc00 && next <= 0xdfff) {
    split--;
  }
  return [text.slice(0, split).trim(), text.slice(split).trim()];
}

export async function summarizeTerms(
  engine,
  text,
  instruction = summaryInstruction,
) {
  const [left, right] = splitSection(text);
  // Leave room in the model's 4096-token window for the chat template and reply.
  if (encoder.encode(text).length <= sectionByteLimit) {
    try {
      return await complete(engine, instruction, text);
    } catch (error) {
      if (error.name !== "ContextWindowSizeExceededError" || !left || !right) {
        throw error;
      }
    }
  }

  const first = await summarizeTerms(engine, left, notesInstruction);
  const second = await summarizeTerms(engine, right, notesInstruction);
  return complete(
    engine,
    `Combine the section summaries. ${instruction}`,
    `${first}\n\n${second}`,
  );
}
