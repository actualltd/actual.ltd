#!/usr/bin/env python3
"""Render ACTUAL / Signal Study 01 using only procedural synthesis."""

from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 44_100
BPM = 72.0
BEAT = 60.0 / BPM
BARS = 16
DURATION = BARS * 4 * BEAT
FRAMES = int(round(DURATION * SAMPLE_RATE))
SEED = 26_001

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "audio" / "masters" / "actual-signal-study-01.wav"
RNG = np.random.default_rng(SEED)


def midi(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def envelope(length: int, attack: float, decay: float, sustain: float, release: float) -> np.ndarray:
    attack_n = max(1, int(attack * SAMPLE_RATE))
    decay_n = max(1, int(decay * SAMPLE_RATE))
    release_n = max(1, int(release * SAMPLE_RATE))
    sustain_n = max(0, length - attack_n - decay_n - release_n)
    parts = [
        np.linspace(0.0, 1.0, attack_n, endpoint=False),
        np.linspace(1.0, sustain, decay_n, endpoint=False),
        np.full(sustain_n, sustain),
        np.linspace(sustain, 0.0, release_n, endpoint=True),
    ]
    result = np.concatenate(parts)
    if len(result) < length:
        result = np.pad(result, (0, length - len(result)))
    return result[:length]


def place(stem: np.ndarray, signal: np.ndarray, start: float, gain: float = 1.0, pan: float = 0.0) -> None:
    start_n = int(round(start * SAMPLE_RATE))
    if start_n >= FRAMES or start_n + len(signal) <= 0:
        return
    src_start = max(0, -start_n)
    dst_start = max(0, start_n)
    count = min(len(signal) - src_start, FRAMES - dst_start)
    if count <= 0:
        return
    angle = (pan + 1.0) * math.pi / 4.0
    stem[dst_start : dst_start + count, 0] += signal[src_start : src_start + count] * gain * math.cos(angle)
    stem[dst_start : dst_start + count, 1] += signal[src_start : src_start + count] * gain * math.sin(angle)


def rhodes(note: float, seconds: float, velocity: float = 1.0) -> np.ndarray:
    length = max(8, int(seconds * SAMPLE_RATE))
    t = np.arange(length) / SAMPLE_RATE
    freq = midi(note)
    phase = 2.0 * math.pi * freq * t
    strike = np.exp(-t * 5.6)
    body = (
        np.sin(phase + 0.34 * strike * np.sin(2.0 * phase))
        + 0.32 * np.sin(2.01 * phase + 0.18)
        + 0.12 * np.sin(3.99 * phase + 0.6)
        + 0.055 * np.sin(7.98 * phase)
    )
    tremolo = 0.91 + 0.09 * np.sin(2.0 * math.pi * 3.35 * t + note)
    env = envelope(length, 0.012, 0.30, 0.47, min(0.55, seconds * 0.28))
    return np.tanh(body * 0.72) * env * tremolo * velocity


def bass(note: float, seconds: float, velocity: float = 1.0) -> np.ndarray:
    length = max(8, int(seconds * SAMPLE_RATE))
    t = np.arange(length) / SAMPLE_RATE
    freq = midi(note)
    phase = 2.0 * math.pi * freq * t
    pitch_fall = 0.24 * np.exp(-t * 18.0)
    tone = (
        np.sin(phase + pitch_fall * np.sin(phase))
        + 0.28 * np.sin(2.0 * phase + 0.2)
        + 0.11 * np.sin(3.0 * phase + 0.7)
    )
    finger = RNG.normal(0.0, 1.0, length) * np.exp(-t * 44.0)
    env = envelope(length, 0.006, 0.20, 0.54, min(0.23, seconds * 0.22))
    return np.tanh((tone * 0.76 + finger * 0.055) * 1.3) * env * velocity


def reed(note: float, seconds: float, velocity: float = 1.0) -> np.ndarray:
    length = max(8, int(seconds * SAMPLE_RATE))
    t = np.arange(length) / SAMPLE_RATE
    freq = midi(note)
    vibrato = 0.0022 * np.sin(2.0 * math.pi * 5.0 * t + 0.7) * (1.0 - np.exp(-t * 3.0))
    phase = 2.0 * math.pi * freq * t + 2.0 * math.pi * freq * np.cumsum(vibrato) / SAMPLE_RATE
    body = (
        0.82 * np.sin(phase)
        + 0.28 * np.sin(2.0 * phase + 0.4)
        + 0.15 * np.sin(3.0 * phase + 0.9)
        + 0.08 * np.sin(5.0 * phase + 0.2)
    )
    breath = RNG.normal(0.0, 1.0, length)
    breath = breath - np.concatenate(([0.0], breath[:-1])) * 0.82
    env = envelope(length, 0.07, 0.22, 0.66, min(0.38, seconds * 0.28))
    return np.tanh(body * 0.85 + breath * 0.025) * env * velocity


def kick() -> np.ndarray:
    seconds = 0.48
    length = int(seconds * SAMPLE_RATE)
    t = np.arange(length) / SAMPLE_RATE
    freq = 42.0 + 66.0 * np.exp(-t * 24.0)
    phase = 2.0 * math.pi * np.cumsum(freq) / SAMPLE_RATE
    click = RNG.normal(0.0, 1.0, length) * np.exp(-t * 75.0)
    return np.tanh((np.sin(phase) * np.exp(-t * 10.0) + click * 0.055) * 1.45)


def brush(seconds: float = 0.42) -> np.ndarray:
    length = int(seconds * SAMPLE_RATE)
    t = np.arange(length) / SAMPLE_RATE
    noise = RNG.normal(0.0, 1.0, length)
    smooth = np.convolve(noise, np.ones(13) / 13.0, mode="same")
    band = noise - smooth
    pulse = 0.35 + 0.65 * np.sin(2.0 * math.pi * 17.0 * t + 0.2) ** 2
    return band * np.exp(-t * 8.2) * pulse


def hat(seconds: float = 0.105) -> np.ndarray:
    length = int(seconds * SAMPLE_RATE)
    t = np.arange(length) / SAMPLE_RATE
    noise = RNG.normal(0.0, 1.0, length)
    high = noise - np.convolve(noise, np.ones(7) / 7.0, mode="same")
    return high * np.exp(-t * 34.0)


def rim() -> np.ndarray:
    seconds = 0.12
    length = int(seconds * SAMPLE_RATE)
    t = np.arange(length) / SAMPLE_RATE
    return (
        np.sin(2.0 * math.pi * 910.0 * t)
        + 0.5 * np.sin(2.0 * math.pi * 1370.0 * t)
    ) * np.exp(-t * 42.0)


def circular_space(stem: np.ndarray, amount: float) -> np.ndarray:
    result = stem.copy()
    taps = ((0.071, 0.19), (0.127, 0.14), (0.191, 0.10), (0.283, 0.075), (0.419, 0.05))
    for delay, gain in taps:
        shift = int(delay * SAMPLE_RATE)
        result[:, 0] += np.roll(stem[:, 1], shift) * gain * amount
        result[:, 1] += np.roll(stem[:, 0], shift + 37) * gain * amount
    return result


def add_chord(stem: np.ndarray, notes: list[int], bar: int, beat_offset: float, length_beats: float, gain: float) -> None:
    start = (bar * 4.0 + beat_offset) * BEAT
    spread = np.linspace(-0.55, 0.55, len(notes))
    for index, (note, pan) in enumerate(zip(notes, spread)):
        timing = start + index * 0.0065
        velocity = gain * (0.96 - index * 0.025)
        place(stem, rhodes(note, length_beats * BEAT + 0.65, velocity), timing, pan=float(pan))


def render() -> np.ndarray:
    keys = np.zeros((FRAMES, 2), dtype=np.float64)
    low = np.zeros_like(keys)
    drums = np.zeros_like(keys)
    lead = np.zeros_like(keys)

    chords = [
        [50, 53, 57, 60, 64],
        [46, 50, 53, 57, 64],
        [43, 46, 50, 53, 57],
        [45, 49, 55, 58, 64],
        [50, 53, 57, 60, 64],
        [48, 52, 55, 59, 62],
        [46, 50, 53, 57, 64],
        [45, 50, 55, 59, 64],
        [41, 45, 48, 52, 55],
        [40, 43, 46, 50, 57],
        [45, 50, 53, 57, 60],
        [43, 47, 53, 57, 64],
        [43, 46, 50, 53, 57],
        [46, 50, 53, 57, 64],
        [45, 49, 55, 58, 63],
        [45, 49, 55, 58, 64],
    ]
    roots = [38, 34, 31, 33, 38, 36, 34, 33, 29, 28, 33, 31, 31, 34, 33, 33]

    for bar, chord in enumerate(chords):
        add_chord(keys, chord, bar, 0.0, 3.45, 0.18 if bar < 2 else 0.205)
        if bar in {2, 5, 7, 10, 13, 15}:
            upper = chord[1:] + [chord[-1] + 7]
            add_chord(keys, upper, bar, 2.62, 1.0, 0.105)

        root = roots[bar]
        bass_events = [
            (0.0, root, 0.88, 0.78),
            (1.50, root + 7, 0.45, 0.47),
            (2.55, root + 12, 0.55, 0.54),
            (3.43, roots[(bar + 1) % BARS] - 1, 0.36, 0.35),
        ]
        for beat_offset, note, length_beats, velocity in bass_events:
            start = (bar * 4.0 + beat_offset) * BEAT
            place(low, bass(note, length_beats * BEAT, velocity), start, pan=-0.04)

    swing = 0.57
    for bar in range(BARS):
        for eighth in range(8):
            beat_position = eighth * 0.5
            if eighth % 2:
                beat_position += (swing - 0.5) * 0.5
            start = (bar * 4.0 + beat_position) * BEAT
            hat_gain = 0.028 * (0.72 if eighth % 2 else 1.0) * (0.85 + RNG.random() * 0.25)
            place(drums, hat(), start, hat_gain, pan=0.34 + RNG.uniform(-0.09, 0.09))

        for beat_index in (0.0, 2.0):
            if not (bar in {3, 11} and beat_index == 2.0):
                place(drums, kick(), (bar * 4.0 + beat_index) * BEAT, 0.255, pan=-0.03)
        if bar in {5, 13}:
            place(drums, kick(), (bar * 4.0 + 2.74) * BEAT, 0.13, pan=-0.02)
        for beat_index in (1.0, 3.0):
            place(drums, brush(), (bar * 4.0 + beat_index) * BEAT, 0.075, pan=0.15)
        if bar % 4 == 3:
            place(drums, rim(), (bar * 4.0 + 3.48) * BEAT, 0.055, pan=0.45)

    melody = [
        (2, 2.72, 69, 0.62, 0.24), (3, 0.04, 72, 0.72, 0.25), (3, 1.42, 70, 0.46, 0.19),
        (4, 0.12, 69, 1.16, 0.23), (4, 2.82, 65, 0.72, 0.18),
        (6, 1.48, 74, 0.48, 0.21), (6, 2.10, 72, 0.42, 0.18), (6, 3.25, 69, 0.60, 0.21),
        (7, 1.05, 67, 1.22, 0.18),
        (9, 0.18, 65, 0.52, 0.20), (9, 0.91, 67, 0.42, 0.17), (9, 1.73, 70, 0.86, 0.22),
        (10, 2.42, 69, 1.15, 0.21),
        (12, 0.10, 74, 0.55, 0.19), (12, 0.88, 72, 0.50, 0.18), (12, 2.08, 69, 1.18, 0.22),
        (14, 0.25, 67, 0.45, 0.17), (14, 1.06, 70, 0.54, 0.20), (14, 2.16, 73, 0.86, 0.22),
        (15, 0.22, 70, 0.62, 0.19), (15, 1.34, 69, 0.46, 0.17), (15, 2.55, 64, 0.72, 0.15),
    ]
    for bar, beat_offset, note, length_beats, velocity in melody:
        start = (bar * 4.0 + beat_offset) * BEAT
        place(lead, reed(note, length_beats * BEAT + 0.32, velocity), start, pan=-0.27 + RNG.uniform(-0.08, 0.08))

    keys = circular_space(keys, 0.82)
    lead = circular_space(lead, 1.0)
    drums = circular_space(drums, 0.22)

    mix = keys + low * 0.92 + drums + lead
    t = np.arange(FRAMES) / SAMPLE_RATE
    hiss = RNG.normal(0.0, 0.0022, (FRAMES, 1))
    hiss *= 0.68 + 0.32 * np.sin(2.0 * math.pi * 0.091 * t)[:, None] ** 2
    mix += np.repeat(hiss, 2, axis=1)

    wow = (np.sin(2.0 * math.pi * 0.23 * t) * 7.0 + np.sin(2.0 * math.pi * 0.071 * t + 1.1) * 13.0)
    indices = np.arange(FRAMES)
    warped = np.empty_like(mix)
    for channel in range(2):
        warped[:, channel] = np.interp(indices + wow, indices, mix[:, channel], period=FRAMES)

    warped -= np.mean(warped, axis=0, keepdims=True)
    warped = np.tanh(warped * 1.42)
    peak = np.max(np.abs(warped))
    if peak > 0:
        warped *= 0.91 / peak
    return warped


def write_wav(audio: np.ndarray) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(audio * 32767.0, -32768, 32767).astype("<i2")
    with wave.open(str(OUTPUT), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


if __name__ == "__main__":
    write_wav(render())
    print(OUTPUT)
