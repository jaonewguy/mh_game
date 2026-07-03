/*
 * Music — the game's adaptive score, fully procedural for now.
 *
 * Architecture (per the game plan):
 *   - An always-on ambient BED: two detuned oscillators through a slow
 *     LFO-swept lowpass, plus a whisper of filtered noise. Its tone is
 *     driven by `setMood({ tension })` — the filter closes and the pad
 *     darkens as tension rises (e.g. walls closing in).
 *   - A quiet PULSE on a 1-second beat grid (the same grid the wall
 *     slams live on), like a distant heartbeat.
 *   - Six VOICES, one per emotion/color. Each is a sparse generative
 *     melody in that emotion's register. A voice is silent until its
 *     color is unlocked, then fades in — the score gains instruments
 *     as the world gains colors.
 *   - Stem support: composed audio files can be layered onto the same
 *     bus later via addStem(); the rest of the engine won't change.
 *
 * Scenes can also drive `setBreath(k)` (-1..1) to make the bed swell
 * and relax with the calm mechanic's breathing cycle.
 */
import { audioCtx, masterBus } from './context.js';
import { Palette } from '../palette.js';

const BEAT = 1.0; // seconds — matches the wall-slam grid

// Each emotion sings in its own register and personality.
// Notes are frequencies in an A-minor pentatonic world.
const VOICE_DEFS = {
  calm:    { type: 'sine',     notes: [220.0, 261.6, 293.7, 329.6, 392.0], prob: 0.35, attack: 0.8,  release: 3.0, vol: 0.10 },
  hope:    { type: 'triangle', notes: [523.3, 587.3, 659.3, 784.0, 880.0], prob: 0.25, attack: 0.05, release: 2.0, vol: 0.06 },
  joy:     { type: 'square',   notes: [659.3, 784.0, 880.0, 1046.5],       prob: 0.5,  attack: 0.01, release: 0.4, vol: 0.03 },
  courage: { type: 'sawtooth', notes: [110.0, 146.8, 164.8],               prob: 0.3,  attack: 0.1,  release: 1.2, vol: 0.05 },
  warmth:  { type: 'sine',     notes: [329.6, 392.0, 440.0, 523.3],        prob: 0.3,  attack: 0.3,  release: 2.5, vol: 0.08 },
  clarity: { type: 'sine',     notes: [1318.5, 1568.0, 1760.0],            prob: 0.2,  attack: 0.01, release: 3.5, vol: 0.04 },
};

class MusicEngine {
  constructor() {
    this.started = false;
    this.mood = { tension: 0.2 };
    this.breath = 0;
    this.voices = {};   // name -> { gain, def, noteIndex }
    this.stems = [];
    this.beatEpoch = 0;
    this.nextBeat = 0;
    this._timer = null;
  }

  // Requires a running AudioContext (call after ensureAudio()).
  start() {
    const ac = audioCtx();
    if (this.started || !ac) return;
    this.started = true;

    this.bus = ac.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(masterBus());

    // ---- ambient bed ----
    this.bedGain = ac.createGain();
    this.bedGain.gain.value = 0.06;
    this.breathGain = ac.createGain();
    this.breathGain.gain.value = 1;
    this.filter = ac.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.filter.Q.value = 1.2;

    const oscA = ac.createOscillator();
    oscA.type = 'triangle';
    oscA.frequency.value = 110; // A2
    const oscB = ac.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 110.6; // slow beating against oscA
    oscA.connect(this.filter);
    oscB.connect(this.filter);
    this.filter.connect(this.bedGain).connect(this.breathGain).connect(this.bus);
    oscA.start();
    oscB.start();

    // slow LFO breathing through the filter
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoAmt = ac.createGain();
    lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(this.filter.frequency);
    lfo.start();

    // whisper of air: looped noise through a bandpass
    const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 1.5;
    this.noiseGain = ac.createGain();
    this.noiseGain.gain.value = 0.012;
    noise.connect(bp).connect(this.noiseGain).connect(this.bus);
    noise.start();

    // ---- voices ----
    for (const [name, def] of Object.entries(VOICE_DEFS)) {
      const gain = ac.createGain();
      gain.gain.value = Palette.isUnlocked(name) ? 1 : 0;
      gain.connect(this.bus);
      this.voices[name] = { gain, def, noteIndex: Math.floor(def.notes.length / 2) };
    }

    // ---- beat scheduler (lookahead pattern) ----
    this.beatEpoch = ac.currentTime + 0.1;
    this.nextBeat = this.beatEpoch;
    this._timer = setInterval(() => this._schedule(), 120);
  }

  _schedule() {
    const ac = audioCtx();
    if (!ac) return;
    while (this.nextBeat < ac.currentTime + 0.35) {
      this._scheduleBeat(this.nextBeat);
      this.nextBeat += BEAT;
    }
  }

  _scheduleBeat(t) {
    const ac = audioCtx();
    const tension = this.mood.tension;

    // heartbeat pulse, more present under tension
    const pulse = ac.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(58, t);
    pulse.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const pg = ac.createGain();
    pg.gain.setValueAtTime(0.02 + tension * 0.05, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    pulse.connect(pg).connect(this.bus);
    pulse.start(t);
    pulse.stop(t + 0.3);

    // generative voices: random walk through each unlocked voice's notes
    for (const v of Object.values(this.voices)) {
      if (v.gain.gain.value <= 0.01) continue;
      if (Math.random() > v.def.prob) continue;
      v.noteIndex = Math.max(0, Math.min(v.def.notes.length - 1,
        v.noteIndex + (Math.random() < 0.5 ? -1 : 1)));
      const osc = ac.createOscillator();
      osc.type = v.def.type;
      osc.frequency.value = v.def.notes[v.noteIndex];
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v.def.vol, t + v.def.attack);
      g.gain.exponentialRampToValueAtTime(0.001, t + v.def.attack + v.def.release);
      osc.connect(g).connect(v.gain);
      osc.start(t);
      osc.stop(t + v.def.attack + v.def.release + 0.05);
    }
  }

  // tension 0 (open, bright) .. 1 (walls at your shoulders)
  setMood({ tension }) {
    this.mood.tension = Math.max(0, Math.min(1, tension));
    const ac = audioCtx();
    if (!ac || !this.started) return;
    const f = 1000 - this.mood.tension * 680; // filter closes as tension rises
    this.filter.frequency.setTargetAtTime(f, ac.currentTime, 0.6);
    this.noiseGain.gain.setTargetAtTime(0.012 + this.mood.tension * 0.02, ac.currentTime, 0.6);
  }

  // k in [-1, 1]: the bed swells on the inhale, softens on the exhale.
  setBreath(k) {
    this.breath = k;
    const ac = audioCtx();
    if (!ac || !this.started) return;
    this.breathGain.gain.setTargetAtTime(1 + Math.max(-0.6, k) * 0.45, ac.currentTime, 0.15);
  }

  // Fade a color's voice into the score (the unlock ceremony moment).
  unlockVoice(name, fadeSec = 4) {
    const v = this.voices[name];
    const ac = audioCtx();
    if (!v || !ac) return;
    v.gain.gain.cancelScheduledValues(ac.currentTime);
    v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.02), ac.currentTime);
    v.gain.gain.linearRampToValueAtTime(1, ac.currentTime + fadeSec);
  }

  // Where we are inside the current beat, 0..1 — for visuals that sway
  // with the score.
  beatPhase() {
    const ac = audioCtx();
    if (!ac || !this.started) return 0;
    const t = (ac.currentTime - this.beatEpoch) / BEAT;
    return t - Math.floor(t);
  }

  // ---- stems (composed audio files, layered later) ----
  // Kept deliberately simple: fetch, decode, loop on the shared bus.
  async addStem(url, { volume = 1, fadeSec = 2 } = {}) {
    const ac = audioCtx();
    if (!ac || !this.started) return null;
    const buf = await fetch(url).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b));
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.linearRampToValueAtTime(volume, ac.currentTime + fadeSec);
    src.connect(g).connect(this.bus);
    src.start();
    const stem = { src, gain: g };
    this.stems.push(stem);
    return stem;
  }

  // Expose layer state for tests/debugging (Playwright asserts these).
  debugState() {
    if (!this.started) return { started: false };
    return {
      started: true,
      tension: this.mood.tension,
      breath: this.breath,
      voices: Object.fromEntries(
        Object.entries(this.voices).map(([n, v]) => [n, +v.gain.gain.value.toFixed(3)])
      ),
    };
  }
}

export const Music = new MusicEngine();
