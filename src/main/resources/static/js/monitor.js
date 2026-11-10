import { Camera } from "./camera.js?v=15";
import {
  FaceTracker,
  extractFace,
  computeMar,
  findBlendshape,
  readPose,
  computeFaceScale
} from "./face-tracker.js";
import { BehaviorEngine } from "./behavior-engine.js";
import { EventReporter } from "./event-reporter.js";

const els = {
  root: document.getElementById("monitor"),
  video: document.getElementById("monitor-video"),
  placeholder: document.getElementById("monitor-placeholder"),
  status: document.getElementById("monitor-status"),
  hint: document.getElementById("monitor-hint"),
  toggle: document.getElementById("monitor-toggle"),
  calibrate: document.getElementById("monitor-calibrate"),
  mar: document.getElementById("m-mar"),
  yaw: document.getElementById("m-yaw"),
  pitch: document.getElementById("m-pitch"),
  roll: document.getElementById("m-roll"),
  yawn: document.getElementById("m-yawn"),
  turn: document.getElementById("m-turn"),
  mouth: document.getElementById("m-mouth"),
  focus: document.getElementById("m-focus"),
  log: document.getElementById("monitor-log")
};

if (els.root) {
  boot();
}

function boot() {
  let camera = null;
  let tracker = null;
  let engine = null;
  let reporter = null;
  let running = false;
  let rafId = 0;

  window.MindFlowCamera = {
    isRunning: function () {
      return running;
    }
  };

  function notifyCamera(on) {
    window.dispatchEvent(new CustomEvent("mindflow:camera", {
      detail: { running: on }
    }));
  }
  let lastVideoTime = -1;
  let sessionStartedAt = 0;
  let summaryTimer = 0;
  let lastMouthActive = false;
  let noseBaseline = null;
  let noseAcc = 0;
  let noseN = 0;
  let noseYBaseline = null;
  let noseYAcc = 0;
  let noseSX = null;
  let noseSY = null;
  let baselineFaceW = 0;
  let lastYawAt = 0;
  let lastYawValue = 0;
  let yawRateSmooth = 0;

  const counters = { YAWN: 0, MOUTH_OPEN: 0, TURN: 0 };
  const localDistractionMs = { value: 0 };

  els.toggle.addEventListener("click", () => {
    if (running) stop();
    else start();
  });

  els.calibrate.addEventListener("click", () => {
    if (!engine) return;
    engine.restartBaseline();
    noseBaseline = null;
    noseAcc = 0;
    noseN = 0;
    noseYBaseline = null;
    noseYAcc = 0;
    noseSX = null;
    noseSY = null;
    baselineFaceW = 0;
    lastYawAt = 0;
    lastYawValue = 0;
    yawRateSmooth = 0;
    setStatus("重新校准中", "busy");
    els.calibrate.disabled = true;
  });

  async function start() {
    els.toggle.disabled = true;
    try {
      camera = camera || new Camera(els.video);
      setStatus("请求摄像头权限", "busy");
      await camera.start();
      els.placeholder.hidden = true;

      setStatus("加载识别模型", "busy");
      tracker = tracker || new FaceTracker();
      await tracker.init((stage) => {
        if (stage === "loading-runtime") setStatus("加载识别运行时", "busy");
        else if (stage === "loading-model") setStatus("加载人脸模型", "busy");
        else if (stage === "gpu-fallback") setStatus("GPU 不可用，切换 CPU", "warn");
      });

      reporter = reporter || new EventReporter({ batchSize: 15, flushIntervalMs: 4000 });
      const session = await reporter.openSession();
      if (session.offline) {
        setStatus("本地模式（后端未连接）", "warn");
        els.hint.textContent = "识别在本机运行，事件暂存本地；启动后端后自动上报";
      } else {
        els.hint.textContent = "画面不会离开本机，仅上报行为事件";
      }

      engine = new BehaviorEngine({
        onEvent: handleEvent,
        onBaseline: (baseline) => {
          if (reporter) reporter.postBaseline(baseline.yaw, baseline.pitch, baseline.roll);
          setStatus("监测中", "ok");
          els.calibrate.disabled = false;
        }
      });

      counters.YAWN = 0;
      counters.MOUTH_OPEN = 0;
      counters.TURN = 0;
      localDistractionMs.value = 0;
      sessionStartedAt = performance.now();
      updateCounters();

      running = true;
      notifyCamera(true);
      lastVideoTime = -1;
      els.toggle.textContent = "停止监测";
      els.toggle.disabled = false;
      els.calibrate.disabled = true;
      startSummaryTimer();
      rafId = requestAnimationFrame(loop);
    } catch (error) {
      const cameraStarted = Boolean(camera && camera.stream);
      if (cameraStarted) {
        setStatus("识别模型未就绪", "warn");
        els.hint.textContent = "摄像头已打开，但识别模型没加载成功；请刷新或换 Chrome / Edge 再试";
        if (camera) camera.stop();
        camera = null;
        els.placeholder.hidden = false;
      } else {
        setStatus(error.message || "启动失败", "warn");
        els.hint.textContent = "请检查摄像头权限或设备占用情况";
      }
      els.toggle.disabled = false;
    }
  }

  async function stop() {
    running = false;
    notifyCamera(false);
    cancelAnimationFrame(rafId);
    window.clearInterval(summaryTimer);
    summaryTimer = 0;

    if (engine) engine.reset();
    lastMouthActive = false;
    noseBaseline = null;
    noseAcc = 0;
    noseN = 0;
    noseYBaseline = null;
    noseYAcc = 0;
    noseSX = null;
    noseSY = null;
    baselineFaceW = 0;
    lastYawAt = 0;
    lastYawValue = 0;
    yawRateSmooth = 0;
    window.MindFlowPose = {
      x: 0,
      y: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
      yawRate: 0,
      active: false,
      t: performance.now()
    };
    if (reporter) await reporter.close();
    if (camera) camera.stop();
    if (tracker) tracker.close();

    els.toggle.textContent = "开启摄像头";
    els.toggle.disabled = false;
    els.calibrate.disabled = true;
    els.placeholder.hidden = false;
    setStatus("已停止", "idle");
    resetMetrics();
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    const video = els.video;
    if (!video || video.readyState < 2) return;
    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    const now = performance.now();
    let result = null;
    try {
      result = tracker.detect(video, now);
    } catch (error) {
      setStatus("识别异常：" + error.message, "warn");
      return;
    }

    const face = extractFace(result);
    const sample = face.hasFace ? buildSample(face, video, now) : { t: now, hasFace: false };
    const debug = engine.push(sample);
    updatePose(sample, debug);
    render(debug);
  }

  function updatePose(sample, debug) {
    const now = performance.now();
    const prev = window.MindFlowPose || { x: 0, y: 0, yaw: 0, pitch: 0, roll: 0 };

    if (!debug.hasFace || !debug.baselineReady) {
      // 关键：丢帧只把 active 置否，保留上一次的 x/y。
      // 否则大幅晃头短暂丢脸时，准星会先弹回中心、恢复后再弹出去。
      yawRateSmooth += (0 - yawRateSmooth) * 0.4;
      window.MindFlowPose = {
        x: prev.x || 0,
        y: prev.y || 0,
        yaw: prev.yaw || 0,
        pitch: prev.pitch || 0,
        roll: prev.roll || 0,
        yawRate: yawRateSmooth,
        active: false,
        t: now
      };
      return;
    }

    if (noseBaseline === null || noseYBaseline === null) {
      noseAcc += sample.anchorX;
      noseYAcc += sample.anchorY;
      noseN += 1;
      if (noseN >= 24) {
        noseBaseline = noseAcc / noseN;
        noseYBaseline = noseYAcc / noseN;
        baselineFaceW = sample.faceWidth;
      }
      window.MindFlowPose = {
        x: prev.x || 0,
        y: prev.y || 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        yawRate: 0,
        active: false,
        t: now
      };
      return;
    }

    // 低延迟平滑，压掉关键点抖动
    noseSX = noseSX === null ? sample.anchorX : noseSX + (sample.anchorX - noseSX) * 0.35;
    noseSY = noseSY === null ? sample.anchorY : noseSY + (sample.anchorY - noseSY) * 0.35;

    // 以「脸宽」为单位归一化：离摄像头远近，同样的头部位移得到同样的输出
    const width = baselineFaceW > 0.02 ? baselineFaceW : (sample.faceWidth || 0.2);

    // 摄像头拍到的是镜像前画面：用户向右、向上移动时锚点 x/y 都会变小
    let dx = (noseBaseline - noseSX) / width;
    let dy = (noseYBaseline - noseSY) / width;

    if (Math.abs(dx) < 0.05) dx = 0;
    if (Math.abs(dy) < 0.05) dy = 0;

    // 灵敏度来自设置页滑块（1~10），越大越灵敏 -> 满偏所需的位移越小
    const settings = window.MindFlowSettings || {};
    const sens = Math.max(1, Math.min(10, Number(settings.sensitivity) || 8));
    const rangeX = 0.85 - sens * 0.0375;
    const rangeY = rangeX * 0.92;

    // 转头角度：behavior-engine 已做 5 帧中值滤波，正值 = 向右转头
    const yawNow = Number(debug.deltaYaw) || 0;
    const dtMs = now - lastYawAt;
    let yawRate = 0;
    if (lastYawAt && dtMs > 8) {
      yawRate = (yawNow - lastYawValue) / (dtMs / 1000);
    }
    lastYawAt = now;
    lastYawValue = yawNow;
    yawRateSmooth += (yawRate - yawRateSmooth) * 0.35;

    window.MindFlowPose = {
      x: Math.max(-1, Math.min(1, dx / rangeX)),
      y: Math.max(-1, Math.min(1, dy / rangeY)),
      yaw: yawNow,
      pitch: Number(debug.deltaPitch) || 0,
      roll: Number(debug.deltaRoll) || 0,
      yawRate: yawRateSmooth,
      active: true,
      t: now
    };
  }

  function buildSample(face, video, now) {
    const mar = computeMar(face.landmarks, video.videoWidth, video.videoHeight);
    const jawOpen = findBlendshape(face.blendCategories, "jawOpen");
    const pose = readPose(face.matrix);
    const faceScale = computeFaceScale(face.landmarks);
    const leftEye = face.landmarks[33];
    const rightEye = face.landmarks[263];
    const nose = face.landmarks[1];
    const lx = leftEye ? leftEye.x : 0.5;
    const rx = rightEye ? rightEye.x : 0.5;
    return {
      t: now,
      hasFace: true,
      mar,
      jawOpen,
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
      faceScale,
      // 双眼外角中点比鼻尖单点稳定得多，作为水平锚点
      anchorX: (lx + rx) / 2,
      anchorY: nose ? nose.y : 0.5,
      // 脸宽作为尺度基准，用户离摄像头远近不影响灵敏度
      faceWidth: Math.max(0.06, Math.abs(rx - lx))
    };
  }

  function render(debug) {
    const mouthActive = Boolean(engine && engine.tracks && engine.tracks.mouth.active);
    if (mouthActive && !lastMouthActive) {
      window.dispatchEvent(new CustomEvent("mindflow:mouth"));
    }
    lastMouthActive = mouthActive;
    window.MindFlowMouth = { open: mouthActive, t: performance.now() };

    els.mar.textContent = debug.hasFace ? debug.mar.toFixed(2) : "--";
    els.yaw.textContent = debug.hasFace ? debug.deltaYaw.toFixed(1) + "°" : "--";
    els.pitch.textContent = debug.hasFace ? debug.deltaPitch.toFixed(1) + "°" : "--";
    els.roll.textContent = debug.hasFace ? debug.deltaRoll.toFixed(1) + "°" : "--";

    if (!debug.hasFace) {
      setStatus("未检测到人脸", "warn");
      return;
    }
    if (!debug.baselineReady) {
      const total = 24;
      setStatus("校准中 " + Math.min(debug.baselineFrames || 0, total) + "/" + total, "busy");
      return;
    }
    setStatus("监测中", "ok");
  }

  function handleEvent(event) {
    if (reporter) reporter.enqueue(event);

    if (event.type === "YAWN") counters.YAWN += 1;
    else if (event.type === "MOUTH_OPEN") counters.MOUTH_OPEN += 1;
    else {
      counters.TURN += 1;
      localDistractionMs.value += new Date(event.endedAt) - new Date(event.startedAt);
    }
    updateCounters();
    pushLog(event);
  }

  function updateCounters() {
    els.yawn.textContent = String(counters.YAWN);
    els.mouth.textContent = String(counters.MOUTH_OPEN);
    els.turn.textContent = String(counters.TURN);
    els.focus.textContent = localFocusRatio();
  }

  function localFocusRatio() {
    if (!sessionStartedAt) return "--";
    const elapsed = performance.now() - sessionStartedAt;
    if (elapsed < 5000) return "--";
    const ratio = 1 - Math.min(1, localDistractionMs.value / elapsed);
    return Math.round(ratio * 100) + "%";
  }

  function pushLog(event) {
    if (!els.log) return;
    const item = document.createElement("li");
    const time = new Date(event.startedAt);
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    const ss = String(time.getSeconds()).padStart(2, "0");
    item.textContent = hh + ":" + mm + ":" + ss + "  " + labelOf(event.type);
    els.log.prepend(item);
    while (els.log.children.length > 5) {
      els.log.removeChild(els.log.lastChild);
    }
  }

  function labelOf(type) {
    switch (type) {
      case "YAWN": return "打哈欠";
      case "MOUTH_OPEN": return "张嘴";
      case "HEAD_TURN_LEFT": return "向左转头";
      case "HEAD_TURN_RIGHT": return "向右转头";
      case "HEAD_TILT": return "歪头";
      case "HEAD_DOWN": return "低头";
      case "LEAN_IN": return "靠近屏幕";
      default: return type;
    }
  }

  function startSummaryTimer() {
    window.clearInterval(summaryTimer);
    summaryTimer = window.setInterval(async () => {
      if (!reporter) return;
      const summary = await reporter.summary();
      if (summary && typeof summary.focusRatio === "number") {
        els.focus.textContent = Math.round(summary.focusRatio * 100) + "%";
      }
    }, 10000);
  }

  function resetMetrics() {
    els.mar.textContent = "--";
    els.yaw.textContent = "--";
    els.pitch.textContent = "--";
    els.roll.textContent = "--";
    els.focus.textContent = "--";
    updateCounters();
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.dataset.tone = tone || "idle";
  }
}