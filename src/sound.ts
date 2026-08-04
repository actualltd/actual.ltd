const OPUS_SOURCE = "/audio/actual-signal-study-01.opus";
const MP3_SOURCE = "/audio/actual-signal-study-01.mp3";
const CROSSFADE_SECONDS = 1.25;
const FADE_IN_SECONDS = 1.5;
const FADE_OUT_SECONDS = 0.8;
const MAX_VOLUME = 0.6;

interface SoundOptions {
  initialVolume: number;
  onStateChange: (playing: boolean, volume: number) => void;
}

interface Deck {
  audio: HTMLAudioElement;
  gain: GainNode;
}

export interface SoundController {
  toggle(): Promise<void>;
  setVolume(volume: number): void;
  isPlaying(): boolean;
  destroy(): void;
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(MAX_VOLUME, value));
}

function selectSource(): string {
  const probe = document.createElement("audio");
  return probe.canPlayType('audio/ogg; codecs="opus"') ? OPUS_SOURCE : MP3_SOURCE;
}

function createAudio(source: string): HTMLAudioElement {
  const audio = new Audio();
  audio.src = source;
  audio.preload = "metadata";
  audio.loop = false;
  return audio;
}

export function createSoundController(options: SoundOptions): SoundController {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is unavailable");

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const source = selectSource();
  const decks: Deck[] = [createAudio(source), createAudio(source)].map((audio, index) => {
    const gain = context.createGain();
    gain.gain.value = index === 0 ? 1 : 0;
    context.createMediaElementSource(audio).connect(gain).connect(master);
    return { audio, gain };
  });

  let preferredVolume = clampVolume(options.initialVolume);
  let activeIndex = 0;
  let playing = false;
  let crossing = false;
  let frame = 0;
  let transitionTimer = 0;
  let pauseTimer = 0;
  let destroyed = false;

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
    deck.gain.gain.cancelAndHoldAtTime(now);
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
    const now = context.currentTime;
    master.gain.cancelAndHoldAtTime(now);
    master.gain.linearRampToValueAtTime(preferredVolume, now + FADE_IN_SECONDS);
    options.onStateChange(true, preferredVolume);
  }

  function stop(): void {
    if (!playing) return;
    playing = false;
    const now = context.currentTime;
    master.gain.cancelAndHoldAtTime(now);
    master.gain.linearRampToValueAtTime(0, now + FADE_OUT_SECONDS);
    options.onStateChange(false, preferredVolume);
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
    setVolume(volume: number): void {
      preferredVolume = clampVolume(volume);
      if (!playing) {
        options.onStateChange(false, preferredVolume);
        return;
      }
      const now = context.currentTime;
      master.gain.cancelAndHoldAtTime(now);
      master.gain.linearRampToValueAtTime(preferredVolume, now + 0.08);
      options.onStateChange(true, preferredVolume);
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
        deck.audio.load();
        deck.gain.disconnect();
      });
      master.disconnect();
      void context.close();
    },
  };
}
