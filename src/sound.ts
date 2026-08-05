const OPUS_SOURCE = "/audio/actual-signal-study-01.opus";
const MP3_SOURCE = "/audio/actual-signal-study-01.mp3";
const CROSSFADE_SECONDS = 1.25;
const FADE_IN_SECONDS = 1.5;
const FADE_OUT_SECONDS = 0.8;
const MAX_TRIM_VOLUME = 0.6;

export type SoundOutputMode = "device" | "trim";

export interface SoundState {
  playing: boolean;
  mode: SoundOutputMode;
  trimVolume: number;
}

interface SoundOptions {
  initialTrimVolume: number;
  outputMode: SoundOutputMode;
  onStateChange: (state: SoundState) => void;
}

interface Deck {
  audio: HTMLAudioElement;
  gain: GainNode;
}

export interface SoundController {
  toggle(): Promise<void>;
  setOutputMode(mode: SoundOutputMode): void;
  setTrimVolume(volume: number): void;
  isPlaying(): boolean;
  destroy(): void;
}

function clampTrimVolume(value: number): number {
  return Math.max(0, Math.min(MAX_TRIM_VOLUME, value));
}

function createAudio(): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "metadata";
  audio.loop = false;
  const opus = document.createElement("source");
  opus.src = OPUS_SOURCE;
  opus.type = 'audio/ogg; codecs="opus"';
  const mp3 = document.createElement("source");
  mp3.src = MP3_SOURCE;
  mp3.type = "audio/mpeg";
  audio.append(opus, mp3);
  audio.load();
  return audio;
}

function holdParameter(parameter: AudioParam, time: number): void {
  if (typeof parameter.cancelAndHoldAtTime === "function") {
    parameter.cancelAndHoldAtTime(time);
    return;
  }
  const value = parameter.value;
  parameter.cancelScheduledValues(time);
  parameter.setValueAtTime(value, time);
}

export function createSoundController(options: SoundOptions): SoundController {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is unavailable");

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const decks: Deck[] = [createAudio(), createAudio()].map((audio, index) => {
    const gain = context.createGain();
    gain.gain.value = index === 0 ? 1 : 0;
    context.createMediaElementSource(audio).connect(gain).connect(master);
    return { audio, gain };
  });

  let trimVolume = clampTrimVolume(options.initialTrimVolume);
  let outputMode = options.outputMode;
  let activeIndex = 0;
  let playing = false;
  let crossing = false;
  let frame = 0;
  let transitionTimer = 0;
  let pauseTimer = 0;
  let destroyed = false;

  const effectiveVolume = (): number => outputMode === "device" ? 1 : trimVolume;
  const notify = (): void => options.onStateChange({ playing, mode: outputMode, trimVolume });

  const rampMaster = (volume: number, duration: number): void => {
    const now = context.currentTime;
    holdParameter(master.gain, now);
    if (duration > 0) master.gain.linearRampToValueAtTime(volume, now + duration);
    else master.gain.setValueAtTime(volume, now);
  };

  function cancelPause(): void {
    if (pauseTimer !== 0) window.clearTimeout(pauseTimer);
    pauseTimer = 0;
  }

  function cancelTransition(): void {
    if (transitionTimer !== 0) window.clearTimeout(transitionTimer);
    transitionTimer = 0;
  }

  function setDeckGain(deck: Deck, value: number, duration = 0): void {
    const now = context.currentTime;
    holdParameter(deck.gain.gain, now);
    if (duration > 0) deck.gain.gain.linearRampToValueAtTime(value, now + duration);
    else deck.gain.gain.setValueAtTime(value, now);
  }

  function settleCrossfade(): void {
    if (!crossing) return;
    cancelTransition();
    const previous = decks[activeIndex];
    activeIndex = activeIndex === 0 ? 1 : 0;
    const active = decks[activeIndex];
    previous.audio.pause();
    previous.audio.currentTime = 0;
    setDeckGain(previous, 0);
    setDeckGain(active, 1);
    crossing = false;
  }

  async function beginCrossfade(): Promise<void> {
    if (crossing || !playing || destroyed) return;
    const outgoing = decks[activeIndex];
    const incoming = decks[activeIndex === 0 ? 1 : 0];
    crossing = true;
    incoming.audio.currentTime = 0;
    setDeckGain(incoming, 0);
    try {
      await incoming.audio.play();
    } catch {
      crossing = false;
      outgoing.audio.loop = true;
      return;
    }
    setDeckGain(outgoing, 0, CROSSFADE_SECONDS);
    setDeckGain(incoming, 1, CROSSFADE_SECONDS);
    transitionTimer = window.setTimeout(settleCrossfade, CROSSFADE_SECONDS * 1000 + 80);
  }

  function monitor(): void {
    if (destroyed) return;
    const active = decks[activeIndex].audio;
    if (playing && !crossing && Number.isFinite(active.duration) && active.duration > CROSSFADE_SECONDS) {
      const remaining = active.duration - active.currentTime;
      if (remaining <= CROSSFADE_SECONDS + 0.08) void beginCrossfade();
    }
    frame = window.requestAnimationFrame(monitor);
  }

  async function start(): Promise<void> {
    cancelPause();
    if (crossing) settleCrossfade();
    const active = decks[activeIndex];
    active.audio.preload = "auto";
    decks[activeIndex === 0 ? 1 : 0].audio.preload = "auto";
    const resume = context.state === "running" ? Promise.resolve() : context.resume();
    const play = active.audio.play();
    await Promise.all([resume, play]);
    playing = true;
    rampMaster(effectiveVolume(), FADE_IN_SECONDS);
    notify();
  }

  function stop(): void {
    if (!playing) return;
    playing = false;
    rampMaster(0, FADE_OUT_SECONDS);
    notify();
    cancelPause();
    pauseTimer = window.setTimeout(() => {
      pauseTimer = 0;
      if (crossing) settleCrossfade();
      decks.forEach((deck, index) => {
        deck.audio.pause();
        setDeckGain(deck, index === activeIndex ? 1 : 0);
      });
    }, FADE_OUT_SECONDS * 1000 + 50);
  }

  frame = window.requestAnimationFrame(monitor);

  return {
    async toggle(): Promise<void> {
      if (playing) stop();
      else await start();
    },
    setOutputMode(mode: SoundOutputMode): void {
      outputMode = mode;
      if (playing) rampMaster(effectiveVolume(), 0.12);
      notify();
    },
    setTrimVolume(volume: number): void {
      trimVolume = clampTrimVolume(volume);
      if (playing && outputMode === "trim") rampMaster(trimVolume, 0.08);
      notify();
    },
    isPlaying(): boolean {
      return playing;
    },
    destroy(): void {
      destroyed = true;
      playing = false;
      window.cancelAnimationFrame(frame);
      cancelPause();
      cancelTransition();
      decks.forEach((deck) => {
        deck.audio.pause();
        deck.audio.removeAttribute("src");
        deck.audio.replaceChildren();
        deck.audio.load();
        deck.gain.disconnect();
      });
      master.disconnect();
      void context.close();
    },
  };
}
