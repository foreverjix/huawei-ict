const DEFAULTS = {
  smoothWindow: 5,
  baselineFrames: 24,
  marOpen: 0.35,
  marClose: 0.25,
  jawOpenEnter: 0.5,
  jawOpenExit: 0.3,
  mouthOpenMinMs: 800,
  yawnMinMs: 1200,
  yawEnter: 20,
  yawExit: 12,
  yawMinMs: 700,
  rollEnter: 15,
  rollExit: 9,
  rollMinMs: 600,
  pitchEnter: 18,
  pitchExit: 10,
  pitchMinMs: 2000,
  leanEnter: 0.22,
  leanExit: 0.12,
  leanMinMs: 1500,
  minGapMs: 300,
  missingFaceMs: 1500,
  yawSign: 1,
  pitchSign: -1,
  rollSign: 1
};

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function uuid() {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export class BehaviorEngine {
  constructor(options = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.onEvent = this.opts.onEvent || (() => {});
    this.baseline = null;
    this.baselineAcc = { yaw: 0, pitch: 0, roll: 0, faceScale: 0, n: 0 };
    this.buffers = { mar: [], jawOpen: [], yaw: [], pitch: [], roll: [], faceScale: [] };
    this.tracks = {
      mouth: { active: false, start: 0, peak: null },
      turnLeft: { active: false, start: 0, peak: null },
      turnRight: { active: false, start: 0, peak: null },
      tilt: { active: false, start: 0, peak: null },
      down: { active: false, start: 0, peak: null },
      lean: { active: false, start: 0, peak: null }
    };
    this.lastEmitAt = {};
    this.lastFaceAt = 0;
    this.debug = {
      hasFace: false,
      mar: 0,
      jawOpen: 0,
      deltaYaw: 0,
      deltaPitch: 0,
      deltaRoll: 0,
      scaleRatio: 0,
      baselineReady: false
    };
  }

  reset() {
    for (const track of Object.values(this.tracks)) {
      track.active = false;
      track.start = 0;
      track.peak = null;
    }
    this.lastEmitAt = {};
  }

  restartBaseline() {
    this.baseline = null;
    this.baselineAcc = { yaw: 0, pitch: 0, roll: 0, faceScale: 0, n: 0 };
    this.reset();
    this.debug.baselineReady = false;
  }

  setBaseline(value) {
    this.baseline = {
      yaw: Number(value.yaw) || 0,
      pitch: Number(value.pitch) || 0,
      roll: Number(value.roll) || 0,
      faceScale: Number(value.faceScale) || 0
    };
    this.debug.baselineReady = true;
  }

  get baselineReady() {
    return this.baseline !== null;
  }

  push(sample) {
    const now = sample.t || performance.now();
    const filtered = this.filter(sample);

    if (!sample.hasFace) {
      if (now - this.lastFaceAt > this.opts.missingFaceMs) {
        this.reset();
      }
      this.debug = {
        ...this.debug,
        hasFace: false,
        mar: 0,
        jawOpen: 0
      };
      return this.debug;
    }

    this.lastFaceAt = now;

    if (!this.baseline) {
      this.accumulateBaseline(filtered);
    } else {
      this.evaluate(filtered, now);
    }

    this.debug = {
      hasFace: true,
      mar: filtered.mar,
      jawOpen: filtered.jawOpen,
      deltaYaw: this.baseline ? filtered.yaw - this.baseline.yaw : 0,
      deltaPitch: this.baseline ? filtered.pitch - this.baseline.pitch : 0,
      deltaRoll: this.baseline ? filtered.roll - this.baseline.roll : 0,
      scaleRatio: this.scaleRatio(filtered),
      baselineFrames: this.baselineAcc.n,
      baselineReady: this.baseline !== null
    };
    return this.debug;
  }

  filter(sample) {
    const keys = ["mar", "jawOpen", "yaw", "pitch", "roll", "faceScale"];
    const result = { t: sample.t, hasFace: sample.hasFace };
    for (const key of keys) {
      const buffer = this.buffers[key];
      buffer.push(Number(sample[key]) || 0);
      if (buffer.length > this.opts.smoothWindow) buffer.shift();
      result[key] = median(buffer);
    }
    return result;
  }

  accumulateBaseline(sample) {
    if (!sample.hasFace) return;
    this.baselineAcc.yaw += sample.yaw;
    this.baselineAcc.pitch += sample.pitch;
    this.baselineAcc.roll += sample.roll;
    this.baselineAcc.faceScale += sample.faceScale;
    this.baselineAcc.n += 1;

    if (this.baselineAcc.n >= this.opts.baselineFrames) {
      const n = this.baselineAcc.n;
      this.setBaseline({
        yaw: this.baselineAcc.yaw / n,
        pitch: this.baselineAcc.pitch / n,
        roll: this.baselineAcc.roll / n,
        faceScale: this.baselineAcc.faceScale / n
      });
      if (this.opts.onBaseline) {
        this.opts.onBaseline({ ...this.baseline });
      }
    }
  }

  scaleRatio(sample) {
    if (!this.baseline || this.baseline.faceScale < 1e-4) return 0;
    return (sample.faceScale - this.baseline.faceScale) / this.baseline.faceScale;
  }

  evaluate(sample, now) {
    const dyaw = (sample.yaw - this.baseline.yaw) * this.opts.yawSign;
    const dpitch = (sample.pitch - this.baseline.pitch) * this.opts.pitchSign;
    const droll = (sample.roll - this.baseline.roll) * this.opts.rollSign;
    const scaleRatio = this.scaleRatio(sample);

    this.updateMouth(sample, now);

    this.updateTrack("turnRight", dyaw > this.opts.yawEnter, dyaw < this.opts.yawExit,
      now, "HEAD_TURN_RIGHT", this.opts.yawMinMs, {
        mar: sample.mar, jawOpen: sample.jawOpen, deltaYaw: dyaw
      }, clamp01((dyaw - this.opts.yawExit) / 30));

    this.updateTrack("turnLeft", dyaw < -this.opts.yawEnter, dyaw > -this.opts.yawExit,
      now, "HEAD_TURN_LEFT", this.opts.yawMinMs, {
        mar: sample.mar, jawOpen: sample.jawOpen, deltaYaw: dyaw
      }, clamp01((-dyaw - this.opts.yawExit) / 30));

    this.updateTrack("tilt", Math.abs(droll) > this.opts.rollEnter, Math.abs(droll) < this.opts.rollExit,
      now, "HEAD_TILT", this.opts.rollMinMs, {
        deltaRoll: droll
      }, clamp01((Math.abs(droll) - this.opts.rollExit) / 20));

    this.updateTrack("down", dpitch < -this.opts.pitchEnter, dpitch > -this.opts.pitchExit,
      now, "HEAD_DOWN", this.opts.pitchMinMs, {
        deltaPitch: dpitch
      }, clamp01((-dpitch - this.opts.pitchExit) / 20));

    this.updateTrack("lean", scaleRatio > this.opts.leanEnter, scaleRatio < this.opts.leanExit,
      now, "LEAN_IN", this.opts.leanMinMs, {
        scaleRatio
      }, clamp01((scaleRatio - this.opts.leanExit) / 0.25));
  }

  updateMouth(sample, now) {
    const track = this.tracks.mouth;
    const open = sample.mar > this.opts.marOpen || sample.jawOpen > this.opts.jawOpenEnter;
    const closed = sample.mar < this.opts.marClose && sample.jawOpen < this.opts.jawOpenExit;

    if (!track.active) {
      if (open) {
        track.active = true;
        track.start = now;
        track.peak = this.peakOf(null, { mar: sample.mar, jawOpen: sample.jawOpen }, 0);
      }
      return;
    }

    track.peak = this.peakOf(track.peak, { mar: sample.mar, jawOpen: sample.jawOpen }, 0);

    if (!closed) return;

    const duration = now - track.start;
    track.active = false;
    const peak = this.stripPeak(track.peak);
    track.peak = null;

    const meta = {
      mar: peak.mar,
      jawOpen: peak.jawOpen,
      durationMs: Math.round(duration)
    };
    const confidence = clamp01(Math.max(
      (peak.mar - this.opts.marClose) / 0.4,
      (peak.jawOpen - this.opts.jawOpenExit) / 0.5
    ));

    if (duration >= this.opts.yawnMinMs) {
      this.emit("YAWN", track.start, now, Math.max(confidence, 0.6), meta);
    } else if (duration >= this.opts.mouthOpenMinMs) {
      this.emit("MOUTH_OPEN", track.start, now, confidence, meta);
    }
  }

  updateTrack(key, enter, exit, now, type, minMs, meta, confidence) {
    const track = this.tracks[key];

    if (!track.active) {
      if (enter) {
        track.active = true;
        track.start = now;
        track.peak = this.peakOf(null, meta, confidence);
      }
      return;
    }

    if (exit) {
      const duration = now - track.start;
      track.active = false;
      const peak = track.peak;
      track.peak = null;
      if (duration >= minMs) {
        this.emit(type, track.start, now, Math.max(0.5, peak ? peak.__confidence : confidence), {
          ...(peak ? this.stripPeak(peak) : meta),
          durationMs: Math.round(duration)
        });
      }
      return;
    }

    track.peak = this.peakOf(track.peak, meta, confidence);
  }

  peakOf(previous, meta, confidence) {
    const next = previous ? { ...previous } : { __confidence: 0 };
    for (const key of Object.keys(meta)) {
      const value = meta[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const current = typeof next[key] === "number" ? next[key] : 0;
      if (Math.abs(value) >= Math.abs(current)) next[key] = value;
    }
    next.__confidence = Math.max(next.__confidence || 0, confidence || 0);
    return next;
  }

  stripPeak(peak) {
    const result = {};
    for (const key of Object.keys(peak)) {
      if (key === "__confidence") continue;
      result[key] = peak[key];
    }
    return result;
  }

  emit(type, startedAt, endedAt, confidence, meta) {
    const last = this.lastEmitAt[type] || 0;
    if (endedAt - last < this.opts.minGapMs) return;

    this.lastEmitAt[type] = endedAt;
    const event = {
      clientEventId: uuid(),
      type,
      confidence: clamp01(confidence),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      meta
    };
    this.onEvent(event);
  }
}