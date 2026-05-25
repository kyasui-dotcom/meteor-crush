/**
 * SoundManager — Web Audio API synthesizer for Meteor Crush
 * All sounds generated programmatically, no external files needed.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmPlaying = false;
let bgmNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;
let sfxEnabled = true;
let bgmEnabled = true;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

// --- Utility ---

function playTone(
  freq: number, duration: number, type: OscillatorType = 'square',
  volume = 0.3, fadeOut = true, detune = 0, delay = 0,
): void {
  if (!sfxEnabled) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const startTime = c.currentTime + delay;
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.value = volume;
  if (fadeOut) {
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }
  osc.connect(gain);
  gain.connect(getMaster());
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playNoise(duration: number, volume = 0.2, delay = 0): void {
  if (!sfxEnabled) return;
  const c = getCtx();
  const startTime = c.currentTime + delay;
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  // Low-pass for softer noise
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(getMaster());
  source.start(startTime);
}

function playSweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = 'triangle',
  volume = 0.25,
  delay = 0,
): void {
  if (!sfxEnabled) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const startTime = c.currentTime + delay;
  const safeEndFreq = Math.max(10, endFreq);

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(10, startFreq), startTime);
  osc.frequency.exponentialRampToValueAtTime(safeEndFreq, startTime + duration);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(getMaster());
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playFilteredNoise(
  duration: number,
  volume: number,
  startFrequency: number,
  endFrequency: number,
  filterType: BiquadFilterType = 'lowpass',
  q = 1,
  delay = 0,
): void {
  if (!sfxEnabled) return;
  const c = getCtx();
  const startTime = c.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    const grit = (Math.random() * 2 - 1) * 0.35;
    data[i] = white * 0.7 + grit * 0.3;
  }

  const source = c.createBufferSource();
  source.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(40, startFrequency), startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), startTime + duration);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(getMaster());
  source.start(startTime);
}

// --- Sound Effects ---

export function sfxMove(): void {
  playTone(600, 0.05, 'square', 0.12, true);
}

export function sfxRotate(): void {
  playTone(800, 0.06, 'square', 0.15, true);
  playTone(1200, 0.04, 'square', 0.08, true);
}

export function sfxLock(): void {
  playTone(200, 0.15, 'triangle', 0.25, true);
  playNoise(0.08, 0.15);
}

export function sfxLineClear(lineCount: number): void {
  const hits = Math.max(1, Math.min(lineCount, 4));
  const intensity = 0.9 + hits * 0.18;

  for (let i = 0; i < hits; i++) {
    const delay = i * 0.045;
    playFilteredNoise(
      0.08 + i * 0.012,
      0.12 + intensity * 0.05,
      2200 - hits * 180 - i * 220,
      560 - i * 70,
      'bandpass',
      3.5,
      delay,
    );
    playSweep(
      230 + hits * 24 - i * 18,
      62 + hits * 5,
      0.16 + i * 0.015,
      'triangle',
      0.12 + intensity * 0.035,
      delay,
    );
  }

  playFilteredNoise(
    0.18 + hits * 0.03,
    0.08 + hits * 0.025,
    1200,
    180,
    'lowpass',
    1.2,
    hits * 0.03,
  );

  if (hits >= 3) {
    playSweep(98 + hits * 8, 38, 0.28 + hits * 0.02, 'sine', 0.08 + hits * 0.015, 0.02);
  }
}

export function sfxBombExplode(): void {
  playFilteredNoise(0.06, 0.18, 5600, 1800, 'highpass', 5, 0);
  playFilteredNoise(0.5, 0.32, 1700, 90, 'lowpass', 0.9, 0.01);
  playSweep(146, 34, 0.62, 'sawtooth', 0.28, 0);
  playSweep(76, 22, 0.74, 'sine', 0.24, 0.015);
  playSweep(42, 26, 0.26, 'triangle', 0.09, 0.11);
  playNoise(0.12, 0.08, 0.09);
}

export function sfxChain(chainCount: number): void {
  // Rising pitch with each chain
  const freq = 500 + chainCount * 200;
  playTone(freq, 0.25, 'square', 0.2, true);
  playTone(freq * 1.5, 0.15, 'sine', 0.12, true);
  // Sparkle
  setTimeout(() => {
    playTone(freq * 2, 0.1, 'sine', 0.08, true);
  }, 80);
}

export function sfxHardDrop(): void {
  playTone(150, 0.1, 'triangle', 0.3, true);
  playTone(100, 0.15, 'triangle', 0.2, true);
  playNoise(0.06, 0.2);
}

export function sfxHold(): void {
  playTone(500, 0.08, 'sine', 0.15, true);
  playTone(700, 0.08, 'sine', 0.1, true);
}

export function sfxGameOver(): void {
  const notes = [400, 350, 300, 200, 150];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.4, 'sawtooth', 0.15, true);
      playTone(freq * 0.5, 0.5, 'sine', 0.1, true);
    }, i * 200);
  });
}

export function sfxMenuSelect(): void {
  playTone(800, 0.08, 'square', 0.1, true);
  setTimeout(() => playTone(1000, 0.06, 'square', 0.08, true), 40);
}

export function sfxMenuConfirm(): void {
  playTone(600, 0.08, 'square', 0.12, true);
  setTimeout(() => playTone(900, 0.08, 'square', 0.1, true), 60);
  setTimeout(() => playTone(1200, 0.1, 'square', 0.08, true), 120);
}

export function sfxLevelUp(): void {
  const notes = [600, 800, 1000, 1200];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.15, 'square', 0.15, true);
    }, i * 80);
  });
}

// --- BGM ---

export function startBGM(): void {
  if (!bgmEnabled || bgmPlaying) return;
  const c = getCtx();
  const gainNode = c.createGain();
  gainNode.gain.value = 0.08;
  gainNode.connect(getMaster());

  const oscs: OscillatorNode[] = [];

  // Bass line — slow arpeggio
  const bassOsc = c.createOscillator();
  bassOsc.type = 'sawtooth';
  bassOsc.frequency.value = 55; // A1
  const bassFilter = c.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 400;
  const bassGain = c.createGain();
  bassGain.gain.value = 0.6;
  bassOsc.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(gainNode);
  bassOsc.start();
  oscs.push(bassOsc);

  // Bass arpeggio automation
  const bassNotes = [55, 55, 73.4, 65.4, 55, 55, 82.4, 73.4]; // A1, A1, D2, C2, A1, A1, E2, D2
  const barDuration = 4; // seconds per bar
  const noteLen = barDuration / bassNotes.length;

  function scheduleBass(startTime: number) {
    bassNotes.forEach((freq, i) => {
      bassOsc.frequency.setValueAtTime(freq, startTime + i * noteLen);
    });
  }

  // Pad — sustained chords
  const padOsc1 = c.createOscillator();
  padOsc1.type = 'sine';
  padOsc1.frequency.value = 220; // A3
  const padOsc2 = c.createOscillator();
  padOsc2.type = 'sine';
  padOsc2.frequency.value = 330; // E4
  const padGain = c.createGain();
  padGain.gain.value = 0.3;
  padOsc1.connect(padGain);
  padOsc2.connect(padGain);
  padGain.connect(gainNode);
  padOsc1.start();
  padOsc2.start();
  oscs.push(padOsc1, padOsc2);

  // Arpeggio — higher pitched pattern
  const arpOsc = c.createOscillator();
  arpOsc.type = 'square';
  arpOsc.frequency.value = 440;
  const arpFilter = c.createBiquadFilter();
  arpFilter.type = 'lowpass';
  arpFilter.frequency.value = 2000;
  const arpGain = c.createGain();
  arpGain.gain.value = 0.12;
  arpOsc.connect(arpFilter);
  arpFilter.connect(arpGain);
  arpGain.connect(gainNode);
  arpOsc.start();
  oscs.push(arpOsc);

  const arpNotes = [440, 523, 659, 523, 440, 587, 659, 784]; // A4 C5 E5 C5 A4 D5 E5 G5
  const arpNoteLen = barDuration / arpNotes.length;

  function scheduleArp(startTime: number) {
    arpNotes.forEach((freq, i) => {
      arpOsc.frequency.setValueAtTime(freq, startTime + i * arpNoteLen);
    });
  }

  // Schedule loop
  let loopTime = c.currentTime;
  scheduleBass(loopTime);
  scheduleArp(loopTime);

  const loopInterval = setInterval(() => {
    if (!bgmPlaying) {
      clearInterval(loopInterval);
      return;
    }
    loopTime += barDuration;
    scheduleBass(loopTime);
    scheduleArp(loopTime);
  }, (barDuration - 0.5) * 1000); // Schedule slightly ahead

  bgmNodes = { osc: oscs, gain: gainNode };
  bgmPlaying = true;
}

export function stopBGM(): void {
  if (!bgmPlaying || !bgmNodes) return;
  bgmNodes.osc.forEach(o => {
    try { o.stop(); } catch {}
  });
  bgmNodes.gain.disconnect();
  bgmNodes = null;
  bgmPlaying = false;
}

export function setBGMEnabled(enabled: boolean): void {
  bgmEnabled = enabled;
  if (!enabled) stopBGM();
}

export function setSFXEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function isBGMPlaying(): boolean {
  return bgmPlaying;
}

/** Must be called from a user gesture (click/tap) to unlock AudioContext */
export function unlockAudio(): void {
  getCtx();
}
