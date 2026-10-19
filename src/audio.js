/* Tiny WebAudio kit — no assets, all synthesized. */
class AudioKit {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem("astra:sound") !== "off";
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setEnabled(value) {
    this.enabled = value;
    localStorage.setItem("astra:sound", value ? "on" : "off");
    if (!value && this.ctx) this.ctx.suspend();
  }

  tone({ freq = 440, to = null, dur = 0.12, type = "sine", gain = 0.05, delay = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);

    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.18, gain = 0.04, filter = 900 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filter;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(lp).connect(amp).connect(ctx.destination);
    src.start();
  }

  blip() {
    this.tone({ freq: 520, to: 780, dur: 0.09, type: "triangle", gain: 0.04 });
  }

  step() {
    this.tone({ freq: 240, dur: 0.045, type: "square", gain: 0.014 });
  }

  eat() {
    this.tone({ freq: 620, to: 980, dur: 0.1, type: "triangle", gain: 0.05 });
    this.tone({ freq: 1240, dur: 0.07, type: "sine", gain: 0.025, delay: 0.05 });
  }

  score() {
    this.tone({ freq: 700, to: 1180, dur: 0.16, type: "sine", gain: 0.05 });
    this.tone({ freq: 1050, to: 1600, dur: 0.13, type: "sine", gain: 0.028, delay: 0.06 });
  }

  hit() {
    this.noise({ dur: 0.2, gain: 0.09, filter: 700 });
    this.tone({ freq: 130, to: 60, dur: 0.26, type: "sawtooth", gain: 0.05 });
  }

  miss() {
    this.tone({ freq: 260, to: 120, dur: 0.3, type: "sine", gain: 0.045 });
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: "sine", gain: 0.045, delay: i * 0.11 })
    );
  }
}

export const audio = new AudioKit();
