/*
 * SFX — procedural one-shots. No assets, fully synthesized.
 */
import { audioCtx, masterBus } from './context.js';

// A low percussive thump: sine wave with a fast pitch drop and decay.
function thud(volume, freqStart, freqEnd, duration) {
  const ac = audioCtx();
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(masterBus());
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// A soft short tone for UI and feedback moments.
function tone(freq, volume, duration, type = 'sine') {
  const ac = audioCtx();
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(masterBus());
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const Sfx = {
  land()   { thud(0.5, 140, 34, 0.28); },
  slam()   { thud(0.35, 110, 40, 0.16); },
  ui()     { tone(660, 0.06, 0.09); },
  good()   { tone(523.25, 0.1, 0.5); tone(659.25, 0.08, 0.7); },  // C5 + E5
  miss()   { tone(196, 0.07, 0.35, 'triangle'); },                // soft low G
};
