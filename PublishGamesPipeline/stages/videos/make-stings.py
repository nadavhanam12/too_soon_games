"""Short comic sounds for launch clips, made in code (no third-party recordings): each is original synthesis.
   python -I make-stings.py <out dir>
Writes sad-trombone.wav, slide-boing.wav, retro-error.wav (44.1 kHz mono, 16-bit), ~0.6-1.6 s each.
The fourth option of a set is the game's own sound (e.g. assets/audio/sfx-wasted.mp3), copied by the caller.
"""
import sys, wave
from pathlib import Path
import numpy as np

R = 44100


def env(n, a=0.01, r=0.08):
    """attack / release envelope (seconds) over n samples"""
    e = np.ones(n)
    na, nr = int(a * R), int(r * R)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def tone(freq, dur, kind='saw', vib=0.0, vib_hz=5.5, bend=0.0):
    """freq in Hz (bend: semitones over the note), a band-limited-ish saw / square / sine"""
    n = int(dur * R); t = np.arange(n) / R
    f = freq * 2 ** ((bend * t / dur) / 12) * (1 + vib * np.sin(2 * np.pi * vib_hz * t))
    ph = 2 * np.pi * np.cumsum(f) / R
    if kind == 'sine': return np.sin(ph)
    k = np.arange(1, 12)
    w = 1.0 / k if kind == 'saw' else np.where(k % 2 == 1, 1.0 / k, 0.0)
    return sum(wk * np.sin(kk * ph) for kk, wk in zip(k, w)) * 0.6


def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / R); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y


def sad_trombone():
    # four falling notes, the last long and wobbling: "wah wah wah waaah"
    notes = [(293.7, 0.28), (277.2, 0.28), (261.6, 0.28), (246.9, 0.85)]
    out = []
    for i, (f, d) in enumerate(notes):
        last = i == len(notes) - 1
        x = tone(f, d, 'saw', vib=0.012 if last else 0.004, vib_hz=6 if last else 5, bend=-0.6 if last else -0.25)
        x = lowpass(x, 1400) * env(len(x), 0.03, 0.12 if not last else 0.3)
        out.append(x); out.append(np.zeros(int(0.03 * R)))
    return np.concatenate(out)


def slide_boing():
    # a slide whistle falling, then a springy boing
    n = int(0.55 * R); t = np.arange(n) / R
    f = 1500 * (380 / 1500) ** (t / 0.55)
    slide = np.sin(2 * np.pi * np.cumsum(f) / R) * env(n, 0.02, 0.05) * 0.8
    m = int(0.6 * R); t2 = np.arange(m) / R
    fb = 160 + 70 * np.sin(2 * np.pi * 9 * t2) * np.exp(-t2 * 5)
    boing = np.sin(2 * np.pi * np.cumsum(fb) / R) * np.exp(-t2 * 4.5)
    return np.concatenate([slide, np.zeros(int(0.04 * R)), boing])


def retro_error():
    # an old-desktop style error: a short soft "dunk" chord with a bell-ish top, our own voicing (not a copy of any OS sound)
    d = 0.7; n = int(d * R); t = np.arange(n) / R
    body = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(220.0, 1.0), (277.2, 0.6), (330.0, 0.5), (440.0, 0.35)])
    bell = 0.35 * np.sin(2 * np.pi * 880 * t) * np.exp(-t * 9)
    x = (body * np.exp(-t * 5.5) + bell) * env(n, 0.004, 0.05)
    return x


def write(path, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    pcm = (x * 32767).astype('<i2').tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(R); w.writeframes(pcm)


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit('usage: python -I make-stings.py <out dir>')
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    for name, fn in [('sad-trombone', sad_trombone), ('slide-boing', slide_boing), ('retro-error', retro_error)]:
        write(out / f'{name}.wav', fn()); print(out / f'{name}.wav')
