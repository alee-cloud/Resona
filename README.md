# Music Tone Prototype (Version 1)

## 1) What this project is
This is a beginner-friendly, browser-based prototype for an AI-style music production idea.

In this Version 1, there is **no real AI**. Instead, the app uses simple preset buttons such as **Make darker** or **Make warmer** and applies audio changes using the browser's **Web Audio API**.

The goal is to validate the core interaction:
- Upload audio
- Play and pause it
- Click plain-language tone commands
- Hear immediate results

---

## 2) How to run it locally
### Option A: Open directly in browser
1. Download or clone this folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).

### Option B: Use a very simple local server (recommended if browser file restrictions appear)
From this project folder, run one of these:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

## 3) What each file does
- `index.html`  
  Defines the page structure: upload input, play/pause control, effect buttons, and status text.

- `style.css`  
  Adds clean, minimal styling (layout, spacing, button states, readable colors).

- `script.js`  
  Handles all Web Audio API logic: file loading, playback control, filter/gain settings, and status explanations.

- `README.md`  
  Explains project purpose, usage, scope, and next steps.

---

## 4) What Version 1 can do
- Upload a local audio file.
- Play and pause audio.
- Apply these tone actions:
  - **Make darker** (reduces high frequencies)
  - **Make brighter** (boosts high frequencies)
  - **Make warmer** (adds low-mid warmth)
  - **Make louder** (careful gain increase)
  - **Reset** (returns to default tone/volume)
- Show a plain-English explanation after each action.

---

## 5) What is intentionally out of scope for now
To keep this prototype simple, the following are intentionally not included:
- Real AI or NLP command parsing
- React or any frontend framework
- Backend services/APIs
- Database, login, accounts, or payments
- Cloud upload/storage
- Deployment/infrastructure setup
- Advanced DAW features (multi-track editing, automation lanes, plugins, timeline editing, etc.)

---

## 6) Suggested next steps for Version 2
- Add a text input where users can type natural-language commands.
- Implement a simple rule-based interpreter (still no ML needed yet), e.g.:
  - "darker" -> high-shelf cut
  - "airy" -> high-shelf boost around upper frequencies
  - "punchier" -> slight transient/low-end shaping
- Add a small UI panel showing current filter and gain values.
- Add an A/B toggle (processed vs. original).
- Add a safer loudness flow (headroom meter / limiter).
- Improve presets and transitions with smoother parameter ramps.

---

## Notes
This project is designed for learning and rapid prototyping. The code is intentionally straightforward so beginners can understand and modify it easily.
