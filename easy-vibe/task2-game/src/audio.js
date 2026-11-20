const MASTER_VOLUME = 0.9;

/**
 * 使用 Web Audio API 实时合成音效，不依赖任何外部音频文件。
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.lastShotTime = -1;
    this.lastExplosionTime = -1;
  }

  ensureContext() {
    if (this.ctx) return this.ctx;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.master.connect(this.ctx.destination);

    return this.ctx;
  }

  /** 浏览器要求音频上下文在用户手势后才能启动 */
  unlock() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  getNoiseBuffer(ctx) {
    if (this.noiseBuffer) return this.noiseBuffer;

    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /** 激光射击：高频方波快速下滑 */
  shoot() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const now = ctx.currentTime;
    if (now - this.lastShotTime < 0.05) return;
    this.lastShotTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** 敌机爆炸：低通噪声 + 低频冲击 */
  explosion(intensity = 1) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const now = ctx.currentTime;
    if (now - this.lastExplosionTime < 0.04) return;
    this.lastExplosionTime = now;

    const level = Math.min(intensity, 1.5);
    const duration = 0.3 + 0.18 * level;

    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + duration);
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22 * level, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.05);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.3);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.18 * level, now + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    thump.connect(thumpGain);
    thumpGain.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.4);
  }

  /** 玩家受伤：低频锯齿波下坠 */
  hurt() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.42);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** 拾取道具：轻快的双音提示 */
  pickup() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const now = ctx.currentTime;
    [740, 1108].forEach((freq, index) => {
      const start = now + index * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  /** 波次升级：三音上行提示 */
  waveUp() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    const now = ctx.currentTime;
    const notes = [523.25, 783.99, 1046.5];

    notes.forEach((freq, index) => {
      const start = now + index * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }
}
