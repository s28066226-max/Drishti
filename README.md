# Drishti — AI eyes in your language

[![CI](https://github.com/s28066226-max/Drishti/actions/workflows/ci.yml/badge.svg)](https://github.com/s28066226-max/Drishti/actions/workflows/ci.yml)

> PromptWars × Kick To Tech 2026 · Build What Matters: The AI-Powered Student Innovation Challenge
> Domain: **Accessibility · Assistive AI**
>
> **Live demo:** https://drishti-b5ls.onrender.com (open in Chrome, allow camera and microphone; the free server may take ~50 s to wake up)

**Drishti** (Sanskrit/Hindi for *sight*) turns any phone into a real-time visual assistant for blind and low-vision people. It works in **8 Indian languages**. Point the camera and Drishti can:

- tell you what's around you, with clock-face directions and distances,
- read signs, bills and medicine labels,
- count your money,
- guide you to a lost object with stereo "sonar",
- watch the path while you walk and warn you only when something matters.

## The problem

India is home to one of the world's largest populations of blind and visually impaired people. Everyday independence still depends on asking someone else:

- *"Which note is this? Did the shopkeeper give me the right change?"*
- *"What does this medicine strip say? Has it expired?"*
- *"Where did I put my keys?"*
- *"Is there an open drain or a step in front of me?"*

Existing tools fall short for Indian users:

- **English-first:** little or no support for Hindi, Marathi, Tamil and other languages.
- **One-shot:** you get a single description, then nothing; no continuous guidance.
- **No spatial guidance:** they tell you *what* is there, not *where* it is relative to you.
- **Not built for Indian context:** rupee notes, Indian signage, open drains and street hazards.

## The solution

| Mode | Key | What it does |
|---|---|---|
| ◎ **Describe** | `1` | A 2–3 sentence scene description, hazards first, with every object placed by clock direction ("chair at 2 o'clock, within reach"). |
| ¶ **Read** | `2` | Reads any text verbatim (signboards, bills, medicine labels, menus) and highlights what matters: bill total and due date, medicine name, strength and expiry. |
| ₹ **Money** | `3` | Identifies every Indian note and coin. **The total is computed by code, not the AI**, and invalid denominations are rejected. |
| ⌖ **Find** | `4` | "Find my keys." A continuous loop steers you ("turn left… straight ahead… within reach!") while a **stereo sonar** beeps from the object's side and speeds up as you get closer. |
| ➤ **Guide** | `5` | A walking companion. It checks the path about once a second, **stays silent unless something changes**, and interrupts with a tone and vibration for hazards like vehicles, steps, open drains and potholes. |
| 🎙 **Ask** | `A` | Voice commands in your language: "find my glasses", "read this", "कितने पैसे हैं", "is the door open?" |
| 🆘 **SOS** | | Shares your GPS location plus what the camera last saw via the native share sheet / WhatsApp. |

## Architecture: AI perceives, code reasons

```
 camera frame ──► on-device quality guard ──(too dark / blurry?)──► spoken fix-it tip, no upload
                         │ ok (768px JPEG, ~80 KB)
                         ▼
                 Gemini multimodal (low-latency mode, strict per-mode JSON schema)
                 → speech in user's language + objects with box_2d [ymin,xmin,ymax,xmax]
                         │
                         ▼
                 Spatial engine (lib/spatial.js, deterministic, unit-tested)
                 • clock direction + left/ahead/right from box position
                 • near / mid / far from apparent size and ground contact
                 • hazard urgency = severity × nearness × centrality → alerts
                 • currency total + denomination validation
                 • Find-mode steering (offset, closeness, "within reach")
                         │
                         ▼
     speech (8 languages) · stereo sonar · vibration · overlay boxes · aria-live captions
```

Why split the work this way:

- **Consistency and safety.** The AI decides *what* is in the frame; tested code decides *where*, *how far* and *how urgent*. Directions don't drift between phrasings, money totals are always correct arithmetic, and hazard ranking is predictable.
- **Latency.** Frames are downscaled on the device, model "thinking" is minimised for live modes (with automatic fallback if a model doesn't support it), and unusable frames are never sent.
- **Graceful in loops.** Guide mode passes the previous report back, so the model says nothing when nothing has changed. Constant chatter is the #1 complaint about assistive apps.

## Accessibility by design

- **High contrast** (black / signal yellow), the **Atkinson Hyperlegible** font (designed for low-vision readers), and 56–76px touch targets.
- **Screen-reader mode:** Drishti goes silent and TalkBack/VoiceOver read the `aria-live` captions instead, so the two voices don't fight. Hazards use `role="alert"`.
- **Full keyboard control:** `Space` (look), `1`–`5` (modes), `A` (ask), `R` (repeat), `U` (upload), `Esc` (stop). There's also a skip link.
- **Respects `prefers-reduced-motion`.** Speech speed is adjustable. The app is installable as a PWA.
- **Privacy:** frames are analysed in memory and never stored. Prompts forbid identifying people or guessing their identity.

## Effective use of AI

- **Gemini multimodal vision with spatial grounding:** normalised bounding boxes drive the overlay, directions and sonar.
- **Six task-specific prompts and schemas** with a shared safety-first system prompt: hazards first, no medical advice, no identification of people.
- **Continuous agent loops** (Find, Guide) that pass their own state back to the model.
- **Automatic model selection:** the server uses the newest stable Gemini Flash model available to your key (override with `GEMINI_MODEL`).
- **Built with vibe coding** in Google Antigravity during the hackathon, commit by commit.

## Run it

Requirements: **Node.js 20.12+**. There are zero dependencies, so no `npm install` is needed.

```bash
cp .env.example .env     # add a free key from https://aistudio.google.com/apikey
npm start                # → http://localhost:8080 (camera works on localhost)
npm test                 # 31 tests, no network or API quota needed
```

Use **Chrome** for voice input (Web Speech API). On a laptop without a camera, use **Photo** to upload a picture.

### Use it on a phone (needs HTTPS for the camera)

**Render (free, no card):** New → Blueprint → select this repo. `render.yaml` configures everything; paste your `GEMINI_API_KEY` when asked.

**Google Cloud Run (needs a billing account):**

```bash
gcloud run deploy drishti --source . --region asia-south1 \
  --allow-unauthenticated --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

## Testing and security

`npm test` runs 31 tests with Node's built-in runner; Google's API is mocked, so no key or quota is used. GitHub Actions runs them on Node 20 and 22 for every push.

| Area | What is tested |
|---|---|
| HTTP API (`test/app.test.js`) | Security headers, path traversal, malformed URLs, input validation, 413/503 handling, rate limiting, and full money / describe / find responses with server-side reasoning |
| AI failover (`test/gemini.test.js`) | Flash → Flash-Lite → Gemma order, sticky model, instant failure when all quotas are exhausted, 503 failover, thinking-config fallback, malformed-JSON retry |
| Spatial engine (`test/spatial.test.js`) | Box validation, clock directions, proximity, hazard ranking, currency totals, Find steering |
| Frame quality (`test/quality.test.js`) | Darkness and blur detection |
| Voice commands (`test/commands.test.js`) | English and Hindi commands, Unicode word boundaries |

Security: strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, a Permissions-Policy limited to camera/mic/location, body-size limits, per-client rate limiting, validated inputs, no secrets in the repo (API key only in `.env` / host settings), and no images stored.

## Project structure

```
server.js              Loads config and starts the HTTP server
lib/app.js             Routing, validation, security headers, rate limiting, static files
lib/gemini.js          Gemini REST client: model discovery, low-latency mode, JSON retry
lib/prompts.js         Safety-first system prompt + per-mode tasks and response schemas
lib/spatial.js         Deterministic spatial engine (directions, distance, hazards, money, find)
public/js/app.js       UI controller: modes, Find/Guide loops, overlay, SOS, settings
public/js/quality.js   On-device darkness / blur detection (variance of Laplacian)
public/js/sonar.js     Web Audio stereo sonar, success chime, hazard tones
public/js/listen.js    Speech recognition in 8 Indian languages
public/js/commands.js  Unicode-aware voice-command parser (English + Hindi/Marathi)
public/js/speech.js    Text-to-speech with per-language voice selection
test/                  31 unit and integration tests (node --test), CI in .github/workflows
```

## Impact and roadmap

- **Impact:** independence in daily tasks (shopping, medicines, finding things, walking outside) with no sighted helper, no special hardware and no English required.
- **Next:**
  - streaming Live API for sub-second Guide mode
  - offline on-device model for low connectivity
  - bus number and route board reading
  - a caregiver dashboard for SOS
  - Indian Sign Language output for deaf-blind users

---

Drishti is an assistive aid, not a mobility device. Always use it alongside your cane, guide dog or other trusted mobility aids.
