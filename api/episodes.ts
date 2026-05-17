import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listEpisodes } from "../lib/storage";
import { applyCors } from "./_cors";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const episodes = await listEpisodes();
    res.status(200).json({ episodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/episodes]", err);
    res.status(500).json({ error: message });
  }
}
