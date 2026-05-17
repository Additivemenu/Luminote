# Luminote — Tech Stack Summary

> An audio assistant that turns your Notion notes into podcasts.
> Personal use first, built to scale.
> same codebase could run on iPhone and browser 

---

## Frontend — Expo (React Native + Web)

One TypeScript codebase that compiles to a native iPhone app and a browser app.

- Ship iOS via **TestFlight** (no App Store needed for personal use)
- Deploy web via **Vercel**
- Use **expo-av** for audio playback on both platforms
- If you scale later, just add an Android target — no rewrite needed

---

## Backend — Vercel Serverless Functions → NestJS (if scaling)

For personal use, serverless is near-free and zero-maintenance.

- Vercel functions keep your API keys secret and orchestrate the podcast pipeline
- No server to manage, deploys on every `git push`
- Estimated cost: **~$0/month** for personal use
- **Scaling path**: migrate to **NestJS on Railway** when you need multi-user support — the module structure maps directly onto Enliten's features (NotionModule, ScriptModule, AudioModule, RealtimeGateway)

---

## Notes Source — Notion API

- Fetch your pages and databases programmatically
- Official npm SDK, works natively in TypeScript
- Serverless function pulls notes, cleans them, passes to the LLM

---

## OpenAI Pipeline

### 1. Script generation — GPT-4o

Raw notes make terrible audio. GPT-4o rewrites them into a flowing, natural podcast script — the single most important step for listenability.

- Use `gpt-4o-mini` to save cost
- Upgrade to `gpt-4o` for richer, more natural output

### 2. Podcast audio — OpenAI TTS (`tts-1-hd`)

Converts the script to an MP3 file you can save and replay any time.

- Best voices for narration: **nova** or **shimmer**
- Stateless batch operation — serverless-friendly
- Output saved to S3

### 3. Live voice assistant — OpenAI Realtime API (optional)

For asking questions about your notes by voice and hearing answers spoken back.

- Connects **directly from the Expo client** via WebSocket
- Your serverless function issues a short-lived **ephemeral token** — API key stays secret
- This sidesteps the WebSocket-on-serverless timeout problem entirely

---

## Hosting & Storage

| Service | Purpose | Cost |
|---|---|---|
| Vercel | Web app + serverless functions | Free tier |
| TestFlight | iOS distribution (no App Store) | Free |
| AWS S3 | Store generated podcast MP3s | 5GB free, ~$0.023/GB after |

---

## Scaling Path

Everything is TypeScript end-to-end, so opening Enliten to other users requires no rewrite:

1. Swap Vercel functions → **NestJS on Railway**
2. Add auth → **Clerk** or **Auth0**
3. Move MP3 storage → **CloudFront + S3** (add CDN)
4. Add a job queue → **BullMQ** for podcast generation

---

## Full Stack at a Glance

```
Expo (React Native + Web)
        |
        | REST
        v
Vercel Serverless Functions
        |
   _____|_____________________
   |                         |
   v                         v
Notion API              GPT-4o (script)
(fetch notes)                |
                             v
                     OpenAI TTS tts-1-hd
                             |
                             v
                          AWS S3 (MP3)
                             |
                             v
                      expo-av (playback)

Expo client ──WebSocket──> OpenAI Realtime API
                (ephemeral token from serverless fn)
```

---

## Why This Stack

| Decision | Reason |
|---|---|
| Expo over React Native bare | Web + iOS from one codebase |
| Vercel functions over NestJS | Zero infra for personal use, easy scaling later |
| Vercel over AWS Lambda | Same serverless benefits, none of the IAM/API Gateway complexity |
| GPT-4o for scripting | Raw notes → listenable podcast requires a rewrite step |
| tts-1-hd over ElevenLabs | All-in on OpenAI keeps the stack simple; quality is excellent |
| Realtime API direct from client | Persistent WebSocket can't run on serverless; ephemeral token keeps keys safe |
| TypeScript end-to-end | One language across Expo, Vercel functions, and NestJS (when scaling) |