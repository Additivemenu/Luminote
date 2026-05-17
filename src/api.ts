import Constants from "expo-constants";

interface Extra {
  apiBaseUrl?: string;
}

function getBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const url = extra.apiBaseUrl ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export interface PageSummary {
  id: string;
  title: string;
}

export interface Episode {
  id: string;
  pageId: string;
  title: string;
  script: string;
  audioUrl: string;
  voice: string;
  createdAt: string;
}

export interface PagesResponse {
  pages: PageSummary[];
  hasDatabase: boolean;
}

interface EpisodeWire {
  id: string;
  pageId: string;
  title: string;
  script: string;
  audioPath: string;
  voice?: string;
  createdAt: string;
}

function hydrateEpisode(e: EpisodeWire): Episode {
  return {
    id: e.id,
    pageId: e.pageId,
    title: e.title,
    script: e.script,
    audioUrl: `${getBaseUrl()}${e.audioPath}`,
    voice: e.voice ?? "nova",
    createdAt: e.createdAt,
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchPages(): Promise<PagesResponse> {
  const res = await fetch(`${getBaseUrl()}/api/pages`);
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as PagesResponse;
}

export async function generatePodcast(
  pageId: string,
  voice?: string,
): Promise<Episode> {
  const res = await fetch(`${getBaseUrl()}/api/podcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId, voice }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { episode: EpisodeWire };
  return hydrateEpisode(body.episode);
}

export async function fetchEpisodes(): Promise<Episode[]> {
  const res = await fetch(`${getBaseUrl()}/api/episodes`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { episodes: EpisodeWire[] };
  return body.episodes.map(hydrateEpisode);
}

export async function fetchVoicePreview(voice: string): Promise<string> {
  const res = await fetch(`${getBaseUrl()}/api/voice-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { audioPath: string };
  return `${getBaseUrl()}${body.audioPath}`;
}
