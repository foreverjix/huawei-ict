(function () {
  const VOLUME = 0.25;

  let ctx = null;
  let master = null;
  let muted = false;
  let lastLockAt = 0;

  function ensure() {
    if (ctx) return ctx;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const audio = ensure();
    if (audio && audio.state === "suspended") audio.resume();
  }

  function tone(options) {
    const audio = ensure();
    if (!audio || muted) return;
    const duration = options.duration || 0.1;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(options.from, now);
    if (options.to && options.to !== options.from) {
      osc.frequency.exponentialRampToValueAtTime(options.to, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.15, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function eat(value) {
    const base = 620 + Math.max(0, Number(value) || 1) * 70;
    tone({ type: "sine", from: base, to: base * 1.55, duration: 0.09, volume: 0.16 });
  }

  function combo(level) {
    const lift = Math.min(Math.max((Number(level) || 1) - 1, 0), 8) * 2;
    const freq = 660 * Math.pow(2, lift / 12);
    tone({ type: "triangle", from: freq, to: freq * 1.1, duration: 0.12, volume: 0.11 });
  }

  function lock() {
    const now = performance.now();
    if (now - lastLockAt < 400) return;
    lastLockAt = now;
    tone({ type: "triangle", from: 1240, to: 1240, duration: 0.05, volume: 0.07 });
  }

  function slow() {
    tone({ type: "sine", from: 180, to: 104, duration: 0.19, volume: 0.15 });
  }

  function roundEnd() {
    [523.25, 659.25, 783.99].forEach(function (freq, index) {
      window.setTimeout(function () {
        tone({ type: "sine", from: freq, to: freq, duration: 0.24, volume: 0.1 });
      }, index * 120);
    });
  }

  function dive() {
    const audio = ensure();
    if (!audio || muted) return;
    const duration = 1.2;
    const frames = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, audio.currentTime);
    filter.frequency.exponentialRampToValueAtTime(160, audio.currentTime + duration);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.1, audio.currentTime + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(audio.currentTime + duration);
  }

  function tide() {
    const audio = ensure();
    if (!audio || muted) return;
    const duration = 1.5;
    const frames = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(280, audio.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1800, audio.currentTime + 0.9);
    filter.frequency.exponentialRampToValueAtTime(320, audio.currentTime + duration);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.17, audio.currentTime + 0.26);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(audio.currentTime + duration);

    tone({ type: "triangle", from: 220, to: 660, duration: 0.9, volume: 0.08 });
    window.setTimeout(function () {
      tone({ type: "sine", from: 1320, to: 1760, duration: 0.5, volume: 0.07 });
    }, 420);
  }

  function sequenceStep(index) {
    const lift = Math.min(Math.max(Number(index) || 0, 0), 3);
    const freq = 540 * Math.pow(2, lift / 12);
    tone({ type: "triangle", from: freq, to: freq * 1.12, duration: 0.14, volume: 0.1 });
  }

  function sequenceDone() {
    [587.33, 739.99, 987.77].forEach(function (freq, index) {
      window.setTimeout(function () {
        tone({ type: "triangle", from: freq, to: freq * 1.05, duration: 0.2, volume: 0.1 });
      }, index * 90);
    });
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master) master.gain.value = muted ? 0 : VOLUME;
  }

  window.MindFlowAudio = {
    unlock: unlock,
    eat: eat,
    combo: combo,
    lock: lock,
    slow: slow,
    roundEnd: roundEnd,
    dive: dive,
    tide: tide,
    sequenceStep: sequenceStep,
    sequenceDone: sequenceDone,
    setMuted: setMuted,
    isMuted: function () {
      return muted;
    }
  };
})();