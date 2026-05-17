import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listDatabasePages } from "../lib/notion";
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
    const pages = await listDatabasePages();
    if (pages === null) {
      res.status(200).json({ pages: [], hasDatabase: false });
      return;
    }
    res.status(200).json({ pages, hasDatabase: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/pages]", err);
    res.status(500).json({ error: message });
  }
}
