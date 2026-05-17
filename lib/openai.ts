import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}

const SCRIPT_SYSTEM_PROMPT = `You are a podcast scriptwriter. The user will give you raw notes from a personal knowledge base. Your job is to rewrite them as a single-host podcast monologue that is engaging to listen to.

Rules:
- Conversational, flowing prose. No bullet points, no headings, no markdown.
- Open with a hook (one sentence that frames the topic), then deliver the substance, then close with a brief takeaway.
- Aim for ~2–4 minutes when read aloud (roughly 350–650 words).
- Preserve every concrete fact, name, and number from the source. Do not invent details.
- If the notes are very short, expand naturally with framing and transitions — don't pad with filler.
- Output the script text only. No labels, no "Host:", no stage directions.`;

export async function generateScript(rawText: string): Promise<string> {
  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SCRIPT_SYSTEM_PROMPT },
      { role: "user", content: rawText },
    ],
    temperature: 0.7,
  });

  const script = completion.choices[0]?.message?.content?.trim();
  if (!script) {
    throw new Error("Empty script returned from GPT");
  }
  return script;
}

export async function synthesizeSpeech(script: string): Promise<Buffer> {
  const openai = getClient();
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: "nova",
    input: script,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
