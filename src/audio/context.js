/*
 * Shared AudioContext and master bus.
 *
 * Browsers only allow audio after a user gesture, so everything is
 * created lazily by ensureAudio() (called from the first key press or
 * click). All sound — SFX and music — routes through one master gain
 * into a gentle compressor, so a single volume setting governs it all.
 */
let ctx = null;
let master = null;

export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(comp);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function audioCtx() { return ctx; }
export function masterBus() { return master; }

export function setMasterVolume(v) {
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}
