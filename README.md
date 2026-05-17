# Luminote

An audio assistant that turns your Notion notes into podcasts. One Expo codebase runs in the browser and on iOS; Vercel serverless functions handle the OpenAI + Notion pipeline.

## MVP pipeline

```text
Notion page  →  GPT-4o-mini (script)  →  OpenAI tts-1-hd (MP3)  →  expo-av (playback)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Notion integration

1. Go to <https://www.notion.so/profile/integrations> and create an **internal** integration. Copy the secret token.
2. Open the Notion **database** whose pages you want to turn into podcasts. Click `...` → **Connections** → add your integration. (Without this step the API returns "object not found".)
3. Copy the database ID from its URL: `notion.so/<workspace>/<DATABASE_ID>?v=...`

### 3. Configure env vars

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

- `OPENAI_API_KEY` — from <https://platform.openai.com/api-keys>
- `NOTION_API_KEY` — the integration token from step 2
- `NOTION_DATABASE_ID` — from step 2
- `EXPO_PUBLIC_API_BASE_URL` — leave as `http://localhost:3000` for simulator/web. For a physical iPhone in Expo Go, set it to `http://<your-Mac-LAN-ip>:3000`.

### 4. Run it (two terminals)

```bash
# Terminal A — backend
npm run dev:api

# Terminal B — app
npm run dev:web      # browser
# or
npm run dev:ios      # iOS Simulator
```

Pick a page, wait ~20–40s, press play.

## Smoke-test the API directly

```bash
curl http://localhost:3000/api/pages
curl -X POST http://localhost:3000/api/podcast \
  -H 'content-type: application/json' \
  -d '{"pageId":"<paste-id-from-/api/pages>"}' | jq '.script'
```

## What's not in the MVP yet

- AWS S3 / episode library
- OpenAI Realtime voice assistant
- Auth / multi-user
- Vercel deploy + TestFlight
- Recursive Notion child blocks (top-level only)

See `tech-stack.md` for the scaling roadmap.
