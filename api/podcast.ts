import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractPageId, getPageText, getPageTitle } from "../lib/notion";
import { generateScript, synthesizeSpeech } from "../lib/openai";
import { saveEpisode } from "../lib/storage";
import { applyCors } from "./_cors";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawInput =
    typeof req.body === "object" && req.body !== null
      ? (req.body as { pageId?: unknown }).pageId
      : undefined;

  if (typeof rawInput !== "string" || rawInput.length === 0) {
    res.status(400).json({ error: "Missing 'pageId' in request body" });
    return;
  }

  let pageId: string;
  try {
    pageId = extractPageId(rawInput);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Invalid input" });
    return;
  }

  try {
    const [rawText, title] = await Promise.all([
      getPageText(pageId),
      getPageTitle(pageId),
    ]);

    if (rawText.trim().length === 0) {
      res.status(422).json({ error: "Notion page has no readable text" });
      return;
    }

    const script = await generateScript(rawText);
    const audio = await synthesizeSpeech(script);

    const episode = await saveEpisode({ pageId, title, script, audio });
    res.status(200).json({ episode });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/podcast]", err);
    res.status(500).json({ error: message });
  }
}
