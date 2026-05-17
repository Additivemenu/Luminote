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

export interface PodcastResult {
  script: string;
  audioBase64: string;
  mimeType: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export interface PagesResponse {
  pages: PageSummary[];
  hasDatabase: boolean;
}

export async function fetchPages(): Promise<PagesResponse> {
  const res = await fetch(`${getBaseUrl()}/api/pages`);
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as PagesResponse;
  return body;
}

export async function generatePodcast(pageId: string): Promise<PodcastResult> {
  const res = await fetch(`${getBaseUrl()}/api/podcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as PodcastResult;
}
