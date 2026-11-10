# Too Soon Games — Arcade explainer

60-second English video, 16:9, 1280×720 at 24 fps.

Final: `Too-Soon-Games-Arcade-EN.mp4`.

Young male voice revision: `Too-Soon-Games-Young-Voice-EN.mp4`. Uses Microsoft en-US-GuyNeural with +12% rate and +8 Hz pitch for a younger male delivery, generated after explicit user approval to send the English script. This is a synthetic adult male voice styled younger, not an actual teenage speaker. The energetic version's video stream is preserved, and its narration is replaced while retaining music and effects. Rebuild with `python Video/Arcade/voice-youthful.py` (requires network access and speech-data authorization).

Energetic revision: `Too-Soon-Games-Energetic-EN.mp4`. Revised motivational English script, local SSML speech with faster pace, raised pitch and emphasized phrases, animated headline entrances, punchline ribbons, confetti, and a 124 BPM musical bed with bass and percussion. Original version retained. Rebuild with `voice-energy.ps1` and `python Video/Arcade/render-energy.py`.

This version centers the event-to-game-to-growth story. It uses native 2D arcade motion graphics: moving characters and camera, simulated gameplay, a remote selection call, animated sharing paths, rising counters, and fictional news coverage. This is an illustrative video, not a shipped playable game or evidence of actual traction.

The actual concert photograph is reused from `../Coldplay/event-source.jpg`, credited on screen to ABC News / GMA; the source URLs are in `../Coldplay/sources.json`. The 24-hour metrics and 48-hour news story are explicitly labeled as imagined success.

English narration is synthesized locally with Windows Microsoft Zira Desktop. No text is sent to an external speech service. All music and sound effects are synthesized locally: a soft melodic bed, notification notes, camera clicks and score sounds. No commercial or Coldplay music is used.

## Rebuild

From the repo root:

1. Run `Video/Arcade/voice.ps1` with PowerShell to create narration clips.
2. Run `python Video/Arcade/render.py --preview` for sample frames.
3. Run `python Video/Arcade/render.py` to render the final MP4.

Dependencies use the existing ignored `.video-tools/` folder. Build files and verification reports are kept under ignored `build/`. The earlier illustrated Hebrew video is preserved unchanged.
