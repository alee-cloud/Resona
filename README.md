# Music Tone Workspace (Version 1)

## 1) What this project is
This is a beginner-friendly, browser-based prototype for an AI-style music production workspace.

In Version 1, there is still **no real AI**. Instead, the app now looks more like a simplified DAW workspace:
- A **top control bar** with File/Edit/View/Help, project title, and Play/Pause
- A **left Library panel** with placeholder Files, Instruments, and Samples
- A **center workspace** with DAW-style track lanes, click-to-select track focus, drag-and-drop loading, and bottom sound settings sliders
- A **right chatbox** where users type plain-language commands (for example, “make it warmer”)
- A basic Web Audio API engine that applies simple effects when demo audio is loaded

The goal is to validate a chat-driven interaction model before building advanced controls.

---

## 2) How to run it locally
### Option A: Open directly in browser
1. Download or clone this folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).

### Option B: Use a very simple local server
From this project folder, run:

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
  Defines the top toolbar and three-column layout: left library placeholders, center tracks/sound settings, and right chat history/input/chips.

- `style.css`  
  Adds clean minimal styling for the library/workspace/chat layout, DAW-style track rows, sound sliders, and chat UI.

- `script.js`  
  Handles:
  - demo audio upload and decode
  - playback (play/pause)
  - command parsing from chat text/chips
  - effect application (`darker`, `brighter`, `warmer`, `louder`, `reset`)
  - assistant-style responses in chat history

- `README.md`  
  Explains purpose, usage, scope, and next steps.

---

## 4) What Version 1 can do
- Show 4 placeholder tracks:
  - Vocals
  - Guitar
  - Drums
  - Piano
- Drag and drop one **demo audio** file onto Vocals/Guitar/Drums/Piano (single-track behavior only).
- Play and pause the loaded audio.
- Click a track row (Vocals/Guitar/Drums/Piano) to set selection focus shown as `Editing: ...`.
- See per-lane file status text update after drop.
- Accept commands through chat text input or example chips:
  - `make it darker`
  - `make it brighter`
  - `make it warmer`
  - `make it louder`
  - `reset`
- Display user + assistant messages in a chat history.
- If audio is loaded, apply matching Web Audio effects and mention the selected track in assistant responses.
- If audio is not loaded, still respond and prompt for demo upload.
- Show 8 beginner-friendly sliders in Sound Settings: Lows, Mids, Highs, Warmth, Space, Punch, Width, Volume.
  - Functional now: Lows, Mids, Highs, Volume (+ chat command visual updates).
  - Placeholder visuals for now: Warmth, Space, Punch, Width.

---

## 5) What is intentionally out of scope for now
To keep this prototype simple and GitHub Pages friendly, this version does **not** include:
- Real AI / LLM integration
- API keys, backend, database, login, accounts, payments
- React, Node app tooling, npm, Vite
- Real multi-track processing for all four lanes
- Right-side dials (highs/mids/lows/modulation/reverb)
- Hidden advanced controls or production-ready mixing tools

---

## 6) Suggested next steps for Version 2
- Add a right-side visual controls panel (highs/mids/lows/etc.) and sync it with chat commands.
- Improve command parsing with a richer rule system (still optional before real AI).
- Add smoother transitions (parameter ramps) to avoid abrupt tone changes.
- Add A/B compare mode (processed vs original).
- Start basic per-track architecture so each lane can eventually hold its own audio source.

---

## Notes
This code stays intentionally simple with comments and clear functions so it is easy to learn from and extend.
