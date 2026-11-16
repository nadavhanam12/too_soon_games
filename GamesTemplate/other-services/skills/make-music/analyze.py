"""Describe the character of candidates so they can be matched to game moments (Claude cannot listen).

  <ACE-Step-1.5>/.venv/Scripts/python.exe -I GamesTemplate/other-services/skills/make-music/analyze.py <GameId> <run> [--vs <track>-<n>]

Per candidate: loud (mean RMS), bright (median spectral centroid, Hz), busy (onsets per second), bass (<200 Hz share),
air (>4 kHz share), arc (RMS per quarter). --vs adds specSim (0..1 spectral similarity) to one candidate of the run,
to check that variations really differ from their source. Pruned candidates are skipped.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(sys.argv[0]).resolve().parents[4]
MUSIC = ROOT / "Games" / sys.argv[1] / "music"
RUN = MUSIC / "runs" / sys.argv[2]
VS = sys.argv[sys.argv.index("--vs") + 1] if "--vs" in sys.argv else None
HOP = 1024


def load(path):
    x, sr = sf.read(path, always_2d=True)
    return x.mean(axis=1), sr


def frames(x):
    fr = x[: len(x) // HOP * HOP].reshape(-1, HOP)
    return fr, np.abs(np.fft.rfft(fr * np.hanning(HOP), axis=1))


def spec_vec(F):
    v = F.mean(axis=0)
    return v / np.linalg.norm(v)


log = json.loads((RUN / "prompts.json").read_text(encoding="utf-8"))
cands = [(f"{name}-{r['n']}", MUSIC / r["file"]) for name, t in log.items() for r in t["results"] if not r.get("pruned")]
ref = None
if VS:
    path = dict(cands).get(VS)
    if path is None:
        raise SystemExit(f"--vs {VS}: no such candidate in {sys.argv[2]}")
    ref = spec_vec(frames(load(path)[0])[1])

for label, path in cands:
    x, sr = load(path)
    fr, F = frames(x)
    f = np.fft.rfftfreq(HOP, 1 / sr)
    rms = np.sqrt((fr**2).mean(axis=1))
    cent = (F * f).sum(axis=1) / (F.sum(axis=1) + 1e-9)
    flux = np.maximum(0, np.diff(F, axis=0)).sum(axis=1)
    busy = (flux > flux.mean() + flux.std()).sum() / (len(x) / sr)
    q = len(rms) // 4
    arc = [round(float(rms[i * q : (i + 1) * q].mean()), 3) for i in range(4)]
    line = (f"{label:18s} loud={rms.mean():.3f} bright={np.median(cent):5.0f}Hz busy={busy:4.1f}/s "
            f"bass={F[:, f < 200].sum() / F.sum():.2f} air={F[:, f > 4000].sum() / F.sum():.3f} arc={arc}")
    if ref is not None:
        line += f" specSim={spec_vec(F) @ ref:.3f}"
    print(line)
