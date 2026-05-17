import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateVoicePreview, isVoice } from "../lib/openai";
import { applyCors } from "./_cors";

const VOICES_DIR = path.join(process.cwd(), "public", "voices");

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw =
    typeof req.body === "object" && req.body !== null
      ? (req.body as { voice?: unknown }).voice
      : undefined;

  if (!isVoice(raw)) {
    res.status(400).json({ error: "Invalid or missing 'voice'" });
    return;
  }
  const voice = raw;

  const filename = `${voice}.mp3`;
  const filepath = path.join(VOICES_DIR, filename);
  const audioPath = `/voices/${filename}`;

  try {
    await fs.access(filepath);
    res.status(200).json({ audioPath, cached: true });
    return;
  } catch {
    // not cached, generate
  }

  try {
    await fs.mkdir(VOICES_DIR, { recursive: true });
    const audio = await generateVoicePreview(voice);
    await fs.writeFile(filepath, audio);
    res.status(200).json({ audioPath, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/voice-preview]", err);
    res.status(500).json({ error: message });
  }
}
