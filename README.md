# InnerVoice — Prototype Plan
## Mental-health support via vocal biofeedback and a therapeutic agent

---

## 1. Vision & project context

**InnerVoice** is a mobile app that combines:

1. **User voice cloning** — Your own voice becomes the main therapeutic tool, leveraging the self-reference effect: hearing yourself engages self-awareness and emotional processing circuits.
2. **A dual-voice conversational agent** — The agent switches between:
   - **EXCHANGE mode** → neutral agent voice (support, inquiry, analysis)
   - **INNERVOICE mode** → cloned user voice in the first person (positive replay, affirmations, reformulation)

**Key research references** (see `/docs`): InnerSelf (2025), Shirvani (UBC, 2025), Costa et al. (2018), Kim & Song (2024).

**Branding:** UI colors follow the **Alan** health palette (lavender surfaces, primary purple `#5B5BD6`, navy text `#1A1A2E`, soft green `#3DB07D`, alert red `#E5484D`, warm yellow `#F5A623`). The app icon is `assets/innervoice-logo.png`.

---

## Quickstart — first clone

**Goal:** run the **session API** (SQLite + Mistral) locally, then the **Expo app** (Expo Go or simulator).

1. **Clone and install**
   ```bash
   git clone <repo-url> innervoice && cd innervoice
   npm install
   npm run server:install
   ```

2. **Environment**
   - Copy: `cp .env.example .env`
   - Set at minimum in **`.env`** (repo root):
     - **`MISTRAL_API_KEY`** — [Mistral](https://console.mistral.ai/) (used by the app via `app.config.js` **and** the server).
     - **`MISTRAL_DEFAULT_AGENT_VOICE_ID`** — neutral TTS voice slug (e.g. `gb_jane_neutral`). List voices via API or `npm run list-mistral-voices`.
   - Other keys in `.env.example` are optional (server URL, shared secret, TTS/STT models, etc.).

3. **Backend** (terminal 1), from repo root:
   ```bash
   npm run server:dev
   ```
   Default port **8787**. Install **`ffmpeg`** if you use server-side audio conversion (`brew install ffmpeg` on macOS).

4. **App** (terminal 2):
   ```bash
   npx expo start
   ```
   Use Expo Go on the same Wi‑Fi, or simulator. Without `EXPO_PUBLIC_INNERVOICE_API_URL`, Expo often infers `http://<LAN IP>:8787` (restart Metro if the network changes).

5. **Check:** Session tab should create a remote session; History reads server-stored sessions (SQLite).

---

## 2. Session architecture (overview)

After **anchoring** (first vocal share: mood + what is on your mind), the app runs a short **exploration** (CBT-style columns), then **construction** and **InnerVoice replay**. Exploration uses **we**; construction uses **you** (neutral agent). At construction, an **InnerVoice nudge** is generated in **TTS** with the user’s voice: a short **I**-statement targeting the main cognitive distortion, then the user can play the full **replay** in the cloned voice.

Typical length: **about 8–15 minutes** (exploration limited to **three** user messages after the welcome).

---

## 3. Phases (conceptual)

0. **ONBOARDING** — optional calm voice capture  
1. **ANCHORING** — mood slider + spoken anchor  
2. **EXPLORATION** — up to 3 user turns after the opening (“we”)  
3. **ANALYSIS** — nudge (cloned voice) + agent framing  
4. **INNERVOICE** — three-part replay (validation / reframing / intention)  
5. **FEEDBACK** — sliders after listening  
6. **CLOSING** — synthesis  

---

## 4. Technical stack

- **Mobile:** Expo / React Native, Zustand, Mistral STT/TTS via backend.
- **Backend:** `server/` — Express, SQLite, session state machine, Mistral calls. See `server/src/index.ts`, `server/src/sessionEngine.ts`.
- **Prompts (English):** `server/src/prompts.ts`, `server/src/explorationAgent.ts`, `server/src/classifySession.ts`, `server/src/innervoiceNudge.ts`, `constants/prompts.ts` (client-side mirror where used).

---

## 5. Ethics & safety (prototype)

Crisis wording is detected; the app shows emergency resources (US **988**, France **3114**, EU **112**). InnerVoice text is validated (first person, no questions, self-harm heuristics). This is **not** a substitute for professional care.

---

## 6. Cursor / dev notes

- Emotion JSON uses English enums: `anxiety`, `sadness`, … `neutral`; tones: `validating`, `socratic`, `gently-directive`, `contemplative`.
- Cognitive distortion **ids** in JSON remain stable (French snake_case labels) for classifier compatibility; **display labels** are English in `constants/cognitiveDistortions.ts`.

---

*InnerVoice — Alan hackathon prototype.*
