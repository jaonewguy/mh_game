/*
 * Minimal WebAudio helper — a single synthesized "thud" used for the
 * landing impact and each wall slam. No assets, fully procedural.
 *
 * Browsers only allow audio after a user gesture, so the context is
 * created lazily on the first key press or click (see main.js).
 */
window.MH = window.MH || {};

MH.Audio = (function () {
  let ctx = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // A low percussive thump: sine wave with a fast pitch drop and decay.
  function thud(volume, freqStart, freqEnd, duration) {
    const ac = ctx;
    if (!ac || ac.state !== 'running') return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    ensure,
    land()  { thud(0.5, 140, 34, 0.28); },
    slam()  { thud(0.35, 110, 40, 0.16); },
  };
})();
