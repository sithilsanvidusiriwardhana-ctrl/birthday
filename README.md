Happy Birthday — interactive page

Files:
- index.html — main page (links CSS and JS)
- style.css — visual styling (dark theme)
- script.js — interaction: candle, confetti, card, audio
- celebration.mp3 — optional audio file (not included)

Run locally:

```bash
# from c:\Users\acer\OneDrive\Desktop\p1
python -m http.server 8000
# open http://localhost:8000/birthday/index.html
```

Customize:
- Replace the three Sinhala placeholders in `index.html`:
  - [SINHALA_PLACEHOLDER_1]
  - [SINHALA_PLACEHOLDER_2]
  - [SINHALA_PLACEHOLDER_3]

- To use your own audio: place an MP3 at `birthday/celebration.mp3` or change the `src` in `index.html`.

Notes:
- `canvas-confetti` loads from CDN when the cake is clicked.
- If autoplay is blocked by the browser, a generated WebAudio synth acts as a fallback.
