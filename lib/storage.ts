import { promises as fs } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const AUDIO_DIR = path.join(PROJECT_ROOT, "public", "episodes");
const INDEX_FILE = path.join(PROJECT_ROOT, "data", "episodes.json");

export interface Episode {
  id: string;
  pageId: string;
  title: string;
  script: string;
  audioPath: string;
  createdAt: string;
}

async function readIndex(): Promise<Episode[]> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(raw) as Episode[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeIndex(all: Episode[]): Promise<void> {
  await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(all, null, 2), "utf-8");
}

export async function listEpisodes(): Promise<Episode[]> {
  const all = await readIndex();
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveEpisode(input: {
  pageId: string;
  title: string;
  script: string;
  audio: Buffer;
}): Promise<Episode> {
  const createdAt = new Date().toISOString();
  const id = `${input.pageId}-${Date.now()}`;
  const filename = `${id}.mp3`;

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.writeFile(path.join(AUDIO_DIR, filename), input.audio);

  const episode: Episode = {
    id,
    pageId: input.pageId,
    title: input.title,
    script: input.script,
    audioPath: `/episodes/${filename}`,
    createdAt,
  };

  const all = await readIndex();
  all.push(episode);
  await writeIndex(all);

  return episode;
}
