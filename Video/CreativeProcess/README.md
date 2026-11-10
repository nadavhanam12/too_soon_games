# Creative-process film

Final: `Too-Soon-Games-Creative-Process-EN.mp4` — 60 seconds, 1280×720, 24 fps, English narration and subtitles.

Character-free revision focused on creative decisions: actual Coldplay incident context, emotional hook, game rule, abstract playable-mechanic demonstration, tuning, visual identity, share card, launch packaging and feedback. No avatars, people, character illustrations or video calls. The game uses only a circular player marker, obstacles and a moving camera beam.

The real-event reference is presented as text, attributed to ABC News / GMA; the article URL is recorded in `../Coldplay/sources.json`. No fabricated event photo is used. Aspirational traction and news coverage are explicitly labeled as goals.

Narration: Microsoft en-US-GuyNeural, +12% rate, +8Hz pitch, using the previously approved speech service. Music and notification effects are original local synthesis. Visuals are code-native motion graphics.

Run `python Video/CreativeProcess/voice.py` to generate approved narration, then `python Video/CreativeProcess/render.py`. Use `--preview` for sample frames. Dependencies use the existing ignored `.video-tools/` folder. Prior videos are preserved.
