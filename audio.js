// Original upbeat accompaniment and distinct result cues; no sampled game audio.
export class GameAudio {
  constructor() { this.enabled = false; this.nodes = new Set(); this.next = 0; this.beat = 0; }
  unlock(enabled) {
    this.enabled = enabled;
    if (!enabled) { this.stop(); return; }
    try {
      this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume().catch(() => {});
    } catch {}
  }
  tone(freq, when, duration, volume, type = 'sine', endFreq = freq) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(endFreq, when + duration);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + .035);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    osc.connect(gain).connect(this.ctx.destination);
    this.nodes.add(osc);
    osc.onended = () => { this.nodes.delete(osc); osc.disconnect(); gain.disconnect(); };
    osc.start(when); osc.stop(when + duration + .02);
  }
  stop() {
    for (const osc of this.nodes) { try { osc.stop(); } catch {} }
    this.nodes.clear(); this.next = 0;
  }
  music(active) {
    if (!active || !this.enabled || this.ctx?.state !== 'running') { this.next = 0; return; }
    const now = this.ctx.currentTime;
    if (!this.next) this.next = now + .05;
    if (this.next < now) this.next = now + .05;
    if (this.next > now + .12) return;
    const melody = [4, 7, 12, 7, 9, 7, 4, 2, 5, 9, 12, 9, 7, 4, 2, 0];
    const note = melody[this.beat % melody.length];
    this.tone(261.63 * 2 ** (note / 12), this.next, .22, .026, 'triangle');
    if (this.beat % 2 === 0) this.tone([130.81, 110, 174.61, 146.83][Math.floor(this.beat / 4) % 4], this.next, .27, .025);
    else this.tone(880, this.next, .04, .006, 'triangle');
    this.beat++; this.next += .27;
  }
  result(kind) {
    this.stop();
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (kind === 'broken') {
      // Sharp metallic crack, falling fragment, then a muted low impact.
      [1477, 2137, 2911].forEach(f => this.tone(f, now, .14, .04, 'triangle', f * .48));
      this.tone(520, now + .1, .38, .065, 'triangle', 95);
      this.tone(95, now + .42, .24, .07, 'sine', 48);
      return;
    }
    if (kind === 'failure') {
      this.tone(392, now, .3, .085, 'triangle', 196);
      this.tone(185, now + .22, .5, .08, 'triangle', 110);
      return;
    }
    if (kind === 'success' || kind === 'complete') {
      // Two bell-like chord strikes: a short pickup, then a bright resolution.
      [587.33, 739.99, 880].forEach(f => this.tone(f, now, .16, .028));
      [659.25, 830.61, 987.77].forEach(f => this.tone(f, now + .2, .58, .036));
      this.tone(1975.53, now + .205, .3, .009);
      if (kind === 'complete') {
        this.tone(1318.51, now + .48, .55, .035);
        this.tone(1975.53, now + .62, .6, .018);
      }
      return;
    }
    [440,523].forEach((freq, i) => this.tone(freq, now + i * .12, .28, .075, 'triangle'));
  }
}
