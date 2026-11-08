(function () {
  const canvas = document.getElementById("bubbles");
  const fishStage = document.querySelector(".fish-stage");
  const stage = document.querySelector(".stage");
  const waveCyan = document.querySelector(".wave__line--cyan");
  const waveViolet = document.querySelector(".wave__line--violet");
  const waveArea = document.querySelector(".wave__area");
  const waveDot = document.querySelector(".wave__dot");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ctx = null;
  let width = 0;
  let height = 0;
  let bubbles = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function makeBubble(fromBottom) {
    const radius = 2.4 + Math.random() * 9.6;
    return {
      x: Math.random() * width,
      y: fromBottom ? height + Math.random() * 60 : Math.random() * height,
      r: radius,
      rise: 0.14 + radius * 0.07 + Math.random() * 0.28,
      sway: 8 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      speed: 0.004 + Math.random() * 0.012,
      alpha: 0.16 + Math.random() * 0.42
    };
  }

  function drawBubbles() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      b.y -= b.rise;
      b.phase += b.speed;
      const x = b.x + Math.sin(b.phase) * b.sway;

      if (b.y + b.r < -20) {
        bubbles[i] = makeBubble(true);
        continue;
      }

      const r = b.r;
      const grad = ctx.createRadialGradient(x - r * 0.3, b.y - r * 0.35, r * 0.08, x, b.y, r);
      grad.addColorStop(0, "rgba(235, 250, 255, " + Math.min(1, b.alpha * 1.1) + ")");
      grad.addColorStop(0.28, "rgba(160, 230, 255, " + b.alpha * 0.16 + ")");
      grad.addColorStop(1, "rgba(120, 210, 255, 0)");

      ctx.beginPath();
      ctx.arc(x, b.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(196, 242, 255, " + b.alpha + ")";
      ctx.lineWidth = Math.max(0.9, r * 0.07);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x - r * 0.32, b.y - r * 0.34, Math.max(0.5, r * 0.22), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, " + Math.min(1, b.alpha * 1.4) + ")";
      ctx.fill();
    }
  }

  const FISH_CONFIG = [
    {
      type: "task",
      size: 0.335,
      phase: 0,
      cfg: { cx: 0.34, cy: 0.1, ax: 0.155, ay: 0.038, w1: 0.15, w2: 0.06, w3: 0.34, w4: 0.24, p1: 1.1, p2: 4.2 }
    },
    {
      type: "rest",
      size: 0.285,
      phase: 9,
      cfg: { cx: 0.54, cy: 0.16, ax: 0.11, ay: 0.042, w1: 0.19, w2: 0.08, w3: 0.3, w4: 0.21, p1: 3.4, p2: 0.7 }
    },
    {
      type: "task",
      size: 0.21,
      phase: 4,
      far: true,
      cfg: { cx: 0.17, cy: 0.055, ax: 0.13, ay: 0.03, w1: 0.21, w2: 0.07, w3: 0.42, w4: 0.26, p1: 2.2, p2: 1.4 }
    },
    {
      type: "rest",
      size: 0.19,
      phase: 14,
      far: true,
      cfg: { cx: 0.7, cy: 0.1, ax: 0.09, ay: 0.028, w1: 0.17, w2: 0.09, w3: 0.38, w4: 0.22, p1: 5.1, p2: 2.3 }
    },
    {
      type: "rest",
      size: 0.145,
      phase: 17,
      far: true,
      cfg: { cx: 0.8, cy: 0.205, ax: 0.06, ay: 0.026, w1: 0.25, w2: 0.11, w3: 0.5, w4: 0.3, p1: 0.4, p2: 3.1 }
    },
    {
      type: "task",
      size: 0.125,
      phase: 2,
      far: true,
      cfg: { cx: 0.48, cy: 0.045, ax: 0.12, ay: 0.024, w1: 0.13, w2: 0.05, w3: 0.36, w4: 0.2, p1: 4.7, p2: 0.9 }
    }
  ];

  const FRAME_COUNT = 21;
  const FRAME_FPS = 1 / 6;
  const stageBox = { w: 0, h: 0, heroTop: 0 };
  const fishes = [];

  if (fishStage) {
    FISH_CONFIG.forEach(function (conf) {
      const el = document.createElement("div");
      el.className = "fish " + (conf.type === "task" ? "fish--gold" : "fish--blue") + (conf.far ? " fish--far" : "");
      el.setAttribute("data-fish", conf.type);
      el.style.zIndex = String(10 + Math.round(conf.size * 100));
      el.innerHTML =
        '<span class="fish__glow"></span>' +
        '<div class="fish__sway"><div class="fish__frames"></div></div>' +
        '<span class="fish__spark s1"></span>' +
        (conf.far ? "" : '<span class="fish__spark s2"></span>');
      fishStage.appendChild(el);

      const wrap = el.querySelector(".fish__frames");
      const imgs = [];
      let loaded = 0;

      const fish = {
        el: el,
        wrap: wrap,
        imgs: imgs,
        size: conf.size,
        ready: false,
        lastW: 0,
        w: 0,
        h: 0,
        x: 0,
        y: 0,
        bank: 0,
        dir: 1,
        placed: false,
        holdTimer: 0,
        framePos: conf.phase,
        fps: FRAME_FPS,
        cfg: conf.cfg
      };

      for (let i = 1; i <= FRAME_COUNT; i++) {
        const num = i < 10 ? "0" + i : String(i);
        const img = new Image();
        img.className = "fish__frame";
        img.alt = "";
        img.draggable = false;
        img.decoding = "async";
        img.addEventListener("load", function () {
          loaded += 1;
          if (loaded === FRAME_COUNT) setupFrames(fish);
        });
        img.src = "assets/mindflow_fish_frames/" + conf.type + "_fish_frame_" + num + ".png";
        wrap.appendChild(img);
        imgs.push(img);
      }

      fishes.push(fish);
    });
  }

  function setupFrames(fish) {
    let baseW = 0;
    let maxH = 0;
    fish.imgs.forEach(function (img) {
      baseW = Math.max(baseW, img.naturalWidth || 0);
      maxH = Math.max(maxH, img.naturalHeight || 0);
    });
    if (!baseW || !maxH) {
      fish.el.classList.add("is-ready");
      return;
    }
    fish.imgs.forEach(function (img) {
      if (!img.naturalWidth) return;
      img.style.width = ((img.naturalWidth / baseW) * 94).toFixed(2) + "%";
    });
    fish.wrap.style.aspectRatio = baseW + " / " + maxH;
    fish.ready = true;
    fish.el.classList.add("is-ready");
    measureStage();

    if (prefersReduced) {
      fish.imgs.forEach(function (img, i) {
        img.style.opacity = i === 0 ? "1" : "0";
        img._o = i === 0 ? 1 : 0;
      });
      updateFish(0, 16.7);
    }
  }

  function measureStage() {
    if (!stage) return;
    stageBox.w = stage.clientWidth;
    stageBox.h = stage.clientHeight;
    const hero = stage.querySelector(".hero");
    stageBox.heroTop = hero ? hero.offsetTop : stageBox.h * 0.55;
    fishes.forEach(function (fish) {
      const targetW = Math.max(70, Math.round(stageBox.w * fish.size));
      if (fish.lastW !== targetW) {
        fish.el.style.width = targetW + "px";
        fish.lastW = targetW;
      }
      fish.w = fish.el.offsetWidth;
      fish.h = fish.el.offsetHeight;
    });
  }

  function updateFish(time, dt) {
    if (!stage || fishes.length === 0 || !stageBox.w) return;
    const W = stageBox.w;
    const H = stageBox.h;
    const t = time / 1000;

    fishes.forEach(function (fish) {
      const cfg = fish.cfg;

      let targetX =
        (cfg.cx + Math.sin(t * cfg.w1 + cfg.p1) * cfg.ax + Math.sin(t * cfg.w2 + cfg.p2) * cfg.ax * 0.38) * W;
      let targetY =
        (cfg.cy + Math.sin(t * cfg.w3 + cfg.p1 * 0.6) * cfg.ay + Math.sin(t * cfg.w4 + cfg.p2) * cfg.ay * 0.42) * H;

      targetX = Math.min(Math.max(targetX, 6), Math.max(6, W - fish.w - 6));
      const yMax = Math.max(6, Math.min(stageBox.heroTop - fish.h - 24, H * 0.52 - fish.h, H - fish.h - 6));
      targetY = Math.min(Math.max(targetY, 6), Math.max(6, yMax));

      if (!fish.placed) {
        fish.x = targetX;
        fish.y = targetY;
        fish.placed = true;
      }

      const prevX = fish.x;
      const prevY = fish.y;
      fish.x += (targetX - fish.x) * 0.032;
      fish.y += (targetY - fish.y) * 0.032;

      const dx = fish.x - prevX;
      const dy = fish.y - prevY;

      if (Math.abs(dx) > 0.16) {
        const nextDir = dx > 0 ? 1 : -1;
        if (nextDir !== fish.dir && fish.holdTimer <= 0) {
          fish.dir = nextDir;
          fish.wrap.style.setProperty("--dir", String(nextDir));
          fish.holdTimer = 1500;
        }
      }
      if (fish.holdTimer > 0) fish.holdTimer -= dt;

      const targetBank = Math.max(-3.5, Math.min(3.5, dy * 5));
      fish.bank += (targetBank - fish.bank) * 0.05;

      fish.el.style.transform =
        "translate3d(" + fish.x.toFixed(2) + "px, " + fish.y.toFixed(2) + "px, 0) rotate(" +
        fish.bank.toFixed(2) + "deg)";

      if (!fish.ready) return;

      const count = fish.imgs.length;
      fish.framePos = (fish.framePos + (fish.fps * dt) / 1000) % count;

      const base = Math.floor(fish.framePos);
      const i0 = base % count;
      const i1 = (i0 + 1) % count;
      const blend = Math.max(0, Math.min(1, (fish.framePos - base - 0.85) / 0.15));

      for (let i = 0; i < count; i++) {
        const o = i === i0 ? 1 - blend : i === i1 ? blend : 0;
        const img = fish.imgs[i];
        if (img._o !== o) {
          img.style.opacity = o.toFixed(3);
          img._o = o;
        }
      }
    });
  }

  function buildWavePoints(time, base, amp, freq, phase) {
    const points = [];
    const step = 20;
    for (let x = 0; x <= 340; x += step) {
      const y =
        base +
        Math.sin(x * freq + time * 0.0012 + phase) * amp +
        Math.sin(x * freq * 2.3 + time * 0.0007) * amp * 0.32;
      points.push([x, Math.max(4, Math.min(46, y))]);
    }
    return points;
  }

  function toPath(points) {
    let d = "M" + points[0][0] + " " + points[0][1].toFixed(1);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i][0] + points[i + 1][0]) / 2;
      const yc = (points[i][1] + points[i + 1][1]) / 2;
      d += " Q" + points[i][0] + " " + points[i][1].toFixed(1) + " " + xc + " " + yc.toFixed(1);
    }
    const last = points[points.length - 1];
    d += " L" + last[0] + " " + last[1].toFixed(1);
    return d;
  }

  function drawWaves(time) {
    if (!waveCyan || !waveViolet) return;
    const cyan = buildWavePoints(time, 25, 9, 0.062, 0);
    const violet = buildWavePoints(time, 35, 6.5, 0.052, 1.8);

    waveCyan.setAttribute("d", toPath(cyan));
    waveViolet.setAttribute("d", toPath(violet));

    if (waveArea) {
      waveArea.setAttribute("d", toPath(cyan) + " L340 50 L0 50 Z");
    }

    if (waveDot) {
      const last = cyan[cyan.length - 3];
      waveDot.setAttribute("cx", last[0]);
      waveDot.setAttribute("cy", last[1]);
    }
  }

  let lastWave = 0;
  let lastFrameTime = 0;
  let lastMeasure = 0;

  function loop(time) {
    const dt = lastFrameTime ? Math.min(50, time - lastFrameTime) : 16.7;
    lastFrameTime = time;

    if (time - lastMeasure > 1200) {
      measureStage();
      lastMeasure = time;
    }

    drawBubbles();
    updateFish(time, dt);
    updateGame(time, dt);
    if (window.MindFlowLight) window.MindFlowLight.update(time);

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    if (fishStage) {
      fishStage.style.transform =
        "translate3d(" + pointer.x.toFixed(2) + "px, " + pointer.y.toFixed(2) + "px, 0)";
    }

    if (time - lastWave > 90) {
      drawWaves(time);
      lastWave = time;
    }

    requestAnimationFrame(loop);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.round(Math.min(46, Math.max(16, (width * height) / 42000)));
    bubbles = [];
    for (let i = 0; i < target; i++) {
      bubbles.push(makeBubble(false));
    }

    measureStage();
    if (window.MindFlowLight) window.MindFlowLight.resize();
  }

  function spawnBubbles(clientX, clientY) {
    for (let i = 0; i < 7; i++) {
      if (bubbles.length > 90) break;
      const radius = 3 + Math.random() * 6.5;
      bubbles.push({
        x: clientX + (Math.random() - 0.5) * 46,
        y: clientY + (Math.random() - 0.5) * 24,
        r: radius,
        rise: 0.5 + Math.random() * 0.9,
        sway: 5 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02,
        alpha: 0.2 + Math.random() * 0.4
      });
    }
  }

  /* ================= 侧边栏视图切换 ================= */
  const navItems = Array.prototype.slice.call(document.querySelectorAll(".nav__item"));
  const pageViews = Array.prototype.slice.call(document.querySelectorAll(".page-view"));

  function setView(name) {
    navItems.forEach(function (item) {
      item.classList.toggle("is-active", item.dataset.view === name);
    });
    pageViews.forEach(function (view) {
      view.classList.toggle("is-active", view.dataset.page === name);
    });
    document.body.dataset.page = name;

    // page-view 初始是 display:none，尺寸为 0 会被液态玻璃跳过，
    // 所以要等这一帧布局完成后再挂载：容器 + 内部条目一起挂
    window.requestAnimationFrame(function () {
      if (!window.LiquidGlass) return;

      const container = document.querySelector(".page-view.is-active");
      if (!container) return;

      // 和首页「今日状态」卡片完全一致：容器挂液态玻璃，内部只靠分隔线，不再套小玻璃块
      const inner = container.querySelector(".page-view__inner");
      if (inner) {
        window.LiquidGlass.attach(inner, { strength: 0.3, blur: 3.5 });
      }
    });
  }

  navItems.forEach(function (item) {
    item.addEventListener("click", function (event) {
      event.preventDefault();
      setView(item.dataset.view || "home");
    });
  });

  /* ================= 演示页交互：搜索 + 灵敏度 ================= */
  window.MindFlowSettings = window.MindFlowSettings || { sensitivity: 8 };

  const docSearchInput = document.getElementById("doc-search");
  const docItems = Array.prototype.slice.call(document.querySelectorAll(".doc-item"));
  const docEmptyEl = document.getElementById("doc-empty");
  const sensInput = document.getElementById("setting-sensitivity");
  const sensValueEl = document.getElementById("sens-value");

  if (docSearchInput) {
    docSearchInput.addEventListener("input", function () {
      const keyword = docSearchInput.value.trim().toLowerCase();
      let visible = 0;

      docItems.forEach(function (item) {
        const hit = !keyword || item.textContent.toLowerCase().indexOf(keyword) !== -1;
        item.hidden = !hit;
        if (hit) visible += 1;
      });

      if (docEmptyEl) docEmptyEl.hidden = visible !== 0;
    });
  }

  if (sensInput) {
    const syncSensitivity = function () {
      const value = Math.max(1, Math.min(10, Number(sensInput.value) || 8));
      window.MindFlowSettings.sensitivity = value;
      if (sensValueEl) sensValueEl.textContent = value + " / 10";
    };

    sensInput.value = String(window.MindFlowSettings.sensitivity || 8);
    sensInput.addEventListener("input", syncSensitivity);
    syncSensitivity();
  }

  /* ================= 张嘴吃鱼互动 ================= */
  const interactionEl = document.getElementById("interaction");
  const aimEl = document.getElementById("game-aim");
  const hudEl = document.getElementById("game-hud");
  const hudScoreEl = document.getElementById("hud-score");
  const hudComboEl = document.getElementById("hud-combo");
  const hudHintEl = document.querySelector(".game-hud__hint");
  const hudExitEl = document.getElementById("hud-exit");
  const hudMusicEl = document.getElementById("hud-music");
  const bgmEl = document.getElementById("bgm-audio");
  const hudTaskEl = document.getElementById("hud-task");
  const hudDirEl = document.getElementById("hud-dir");
  const hudAngleEl = document.getElementById("hud-angle");
  const hudPhaseEl = document.getElementById("hud-phase");
  const hudBarFillEl = document.getElementById("hud-bar-fill");
  const roundEndEl = document.getElementById("round-end");
  const roundLeftEl = document.getElementById("round-left");
  const roundRightEl = document.getElementById("round-right");
  const roundLeftPeakEl = document.getElementById("round-left-peak");
  const roundRightPeakEl = document.getElementById("round-right-peak");
  const roundBalanceEl = document.getElementById("round-balance");
  const roundStandardEl = document.getElementById("round-standard");
  const roundMissedEl = document.getElementById("round-missed");
  const roundEyebrowEl = document.getElementById("round-eyebrow");
  const gameToastEl = document.getElementById("game-toast");
  const gameToastTitleEl = document.getElementById("game-toast-title");
  const gameToastDetailEl = document.getElementById("game-toast-detail");
  const roundAiEl = document.getElementById("round-ai");
  const roundAiTagEl = document.getElementById("round-ai-tag");
  const roundAiTextEl = document.getElementById("round-ai-text");
  const roundAgainEl = document.getElementById("round-again");
  const roundExitEl = document.getElementById("round-exit");
  const taskBadgeEl = document.getElementById("task-badge");
  const taskTitleEl = document.getElementById("task-title");
  const taskProgressEl = document.getElementById("task-progress");
  const taskCountEl = document.getElementById("task-count");
  const taskPercentEl = document.getElementById("task-percent");

  // 简单工作任务队列：吃金色任务鱼推进当前任务，吃完自动切下一条
  const TASKS = [
    { title: "翻译下段内容", detail: "保留公式与引用", goal: 8 },
    { title: "校对 5 条批注", detail: "统一术语与格式", goal: 6 },
    { title: "整理会议纪要", detail: "提炼 3 个待办", goal: 5 },
    { title: "归档本周文档", detail: "按项目归类", goal: 7 }
  ];

  const GAME = {
    state: "idle",
    score: 0,
    combo: 1,
    fishes: [],
    spawnTimer: 0,
    introUntil: 0,
    maxFish: 7,
    lastMouthAt: 0,
    aimX: 0,
    aimTarget: 0,
    aimV: 0,
    aimVTarget: 0,
    aimPx: 0,
    aimY: 0,
    aimDrawX: 0,
    aimDrawY: 0,
    assistRadius: 260,
    pointerX: 0,
    pointerY: 0,
    lockRadius: 150,
    poseFresh: false,
    everPosed: false,
    lastHint: "",
    lastPoseFresh: null,
    suckUntil: 0,
    lastChompAt: 0,
    chompInterval: 190,
    keyHold: false,
    taskIndex: 0,
    taskEaten: 0,
    completedTasks: 0,

    // ---- 颈椎引导训练 ----
    roundStart: 0,
    roundEndShown: false,
    guideSeq: [],
    lastGuideDir: 0,
    mainDone: 0,
    activeFish: null,
    pendingGuide: null,
    cueEl: null,
    cueSpawnAt: 0,
    nextSpawnAt: 0,
    poseYaw: 0,
    speedGuardUntil: 0,
    lastSpeedWarnAt: 0,
    lastGuideHudAt: 0,
    tally: { left: 0, right: 0, leftPeak: 0, rightPeak: 0, up: 0, down: 0, standard: 0, missed: 0 },
    verticalPlan: []
  };

  /**
   * 一组 90 秒的颈椎引导计划：
   * 热身由浅入深、主训逐步加大幅度、放松收回来，避免一上来就甩到极限。
   */
  const GUIDE = {
    roundMs: 90000,
    cueMs: 650,
    hoverMs: 10000,
    spawnGapMs: 950,
    maxYawRate: 70,
    reachRatio: 0.85,
    phases: [
      { id: "warmup", label: "热身", from: 0, to: 15000, yaw: 20 },
      { id: "main", label: "主训", from: 15000, to: 65000, yaw: 25 },
      { id: "cool", label: "放松", from: 65000, to: 90000, yaw: 15 }
    ],
    vertical: {
      at: [28000, 48000],
      upYaw: 15,
      downYaw: 20
    }
  };

  let planFocus = "balanced";
  let planNote = "";

  function sfx(name, value) {
    const audio = window.MindFlowAudio;
    if (audio && typeof audio[name] === "function") {
      audio[name](value);
    }
  }

  const BGM_TRACKS = [
    "assets/audio/bgm_01.mp3",
    "assets/audio/bgm_02.mp3"
  ];
  const BGM_VOLUME = 0.32;
  const BGM_DUCK_VOLUME = 0.14;

  let bgmIndex = 0;
  let bgmOn = true;

  function bgmStart() {
    if (!bgmEl || !bgmOn) return;
    bgmEl.volume = BGM_VOLUME;
    if (!bgmEl.getAttribute("src")) {
      bgmEl.src = BGM_TRACKS[bgmIndex];
    }
    const task = bgmEl.play();
    if (task && task.catch) task.catch(function () {});
  }

  function bgmStop() {
    if (!bgmEl) return;
    bgmEl.pause();
    bgmEl.currentTime = 0;
  }

  function bgmDuck() {
    if (!bgmEl) return;
    bgmEl.volume = BGM_DUCK_VOLUME;
  }

  function bgmNext() {
    if (!bgmEl) return;
    bgmIndex = (bgmIndex + 1) % BGM_TRACKS.length;
    bgmEl.src = BGM_TRACKS[bgmIndex];
    if (bgmOn && GAME.state !== "idle") bgmStart();
  }

  function setBgmOn(value) {
    bgmOn = Boolean(value);
    if (bgmEl) {
      if (!bgmOn) {
        bgmEl.pause();
      } else if (GAME.state !== "idle") {
        bgmStart();
      }
    }
    if (hudMusicEl) {
      hudMusicEl.textContent = bgmOn ? "音乐 开" : "音乐 关";
      hudMusicEl.setAttribute("aria-pressed", bgmOn ? "true" : "false");
      hudMusicEl.classList.toggle("is-off", !bgmOn);
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * 输入曲线：小幅度更迟钝、大幅度才推到边。
   * 头部稍微一晃时准星不会瞬间飞出去，精细对准才可能。
   */
  function shapeInput(value) {
    const sign = value < 0 ? -1 : 1;
    return sign * Math.pow(Math.abs(value), 1.25);
  }

  function mouthCenter() {
    if (!interactionEl || !stage) {
      return { x: stageBox.w / 2, y: stageBox.h * 0.6 };
    }
    return {
      x: interactionEl.offsetLeft + interactionEl.offsetWidth / 2,
      y: interactionEl.offsetTop + interactionEl.offsetHeight / 2
    };
  }

  // ---- 引导排期：鱼的位置就是目标姿态的位置 ----

  function currentPhase(elapsed) {
    for (const phase of GUIDE.phases) {
      if (elapsed < phase.to) return phase;
    }
    return GUIDE.phases[GUIDE.phases.length - 1];
  }

  function phaseYaw(phase) {
    // 主训按完成条数阶梯加幅：25 → 30 → 35°
    if (phase.id !== "main") return phase.yaw;
    return Math.min(35, phase.yaw + Math.floor(GAME.mainDone / 2) * 5);
  }

  /**
   * 方向队列：左右交替，中间插一条蓝色归中鱼。
   * 左右累计次数差达到 1 条时优先补欠的那一侧，保证对称配平。
   */
  function nextGuideDir() {
    if (!GAME.guideSeq.length) {
      const rightDue = GAME.tally.left - GAME.tally.right >= 1;
      const leftDue = GAME.tally.right - GAME.tally.left >= 1;
      let first;
      if (rightDue) first = 1;
      else if (leftDue) first = -1;
      else if (planFocus === "right") first = 1;
      else if (planFocus === "left") first = -1;
      else first = GAME.lastGuideDir === 1 ? -1 : 1;
      GAME.guideSeq = [first, 0, -first, 0];
    }
    return GAME.guideSeq.shift();
  }

  function planGuide(now) {
    const elapsed = Math.max(0, now - GAME.roundStart);
    const phase = currentPhase(elapsed);

    // 主训段插入纵向引导：抬头一条、低头一条，热身与放松保持纯左右
    if (phase.id === "main") {
      const slot = GAME.verticalPlan.find(function (item) {
        return !item.done && elapsed >= item.at;
      });
      if (slot) {
        slot.done = true;
        return {
          dir: 0,
          vertical: true,
          pitchDir: slot.pitchDir,
          needYaw: 0,
          phase: phase.id,
          anchorX: stageBox.w * (0.4 + Math.random() * 0.2),
          anchorY: stageBox.h * (slot.pitchDir > 0 ? 0.2 : 0.8)
        };
      }
    }

    const dir = nextGuideDir();
    const needYaw = dir === 0 ? 0 : phaseYaw(phase);

    // 幅度越大，驻留点越靠边；但仍留在准星 + 磁吸可达的范围内
    const edge = phase.id === "warmup" ? 0.27 : phase.id === "main" ? 0.21 : 0.31;
    const jitter = Math.random() * 0.04;
    let anchorX;
    if (dir < 0) anchorX = stageBox.w * (edge + jitter);
    else if (dir > 0) anchorX = stageBox.w * (1 - edge - jitter);
    else anchorX = stageBox.w * (0.46 + Math.random() * 0.08);

    return {
      dir: dir,
      needYaw: needYaw,
      phase: phase.id,
      anchorX: anchorX,
      anchorY: stageBox.h * (0.34 + Math.random() * 0.3)
    };
  }

  function createGameFish(guide) {
    if (!fishStage || !stageBox.w) return;

    const plan = guide || planGuide(performance.now());
    // 只记录左右方向，中间的归中鱼不能覆盖交替依据
    if (plan.dir !== 0) GAME.lastGuideDir = plan.dir;
    // 左右目标鱼推进任务，中央鱼只是回正的休息鱼
    const type = plan.dir === 0 ? "rest" : "task";
    const sizeRatio = plan.dir === 0 ? 0.088 : 0.075;
    const w = Math.round(clamp(stageBox.w * (sizeRatio + Math.random() * 0.02), 64, 190));
    const h = Math.round(w * 0.735);
    const speed = 100 + Math.random() * 26;

    // 去左边就从左边界外游进来，去右边就从右边界外游进来
    let heading;
    let startX;
    let startY;

    if (plan.vertical) {
      // 纵向鱼斜向入场，不做到垂直：素材是水平朝向的鱼身
      const fromTop = plan.pitchDir > 0;
      heading = (fromTop ? 1 : -1) * (Math.PI / 3) + (Math.random() - 0.5) * 0.22;
      const lane = 0.28 + Math.random() * 0.44;
      startX = stageBox.w * lane - w / 2;
      startY = fromTop ? -h - 80 : stageBox.h + 80;
    } else {
      // 去左边就从左边界外游进来，去右边就从右边界外游进来
      if (plan.dir < 0) heading = (Math.random() - 0.5) * 0.24;
      else if (plan.dir > 0) heading = Math.PI + (Math.random() - 0.5) * 0.24;
      else heading = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.2;

      startX = Math.cos(heading) >= 0 ? -w - 70 : stageBox.w + 70;
      startY = plan.anchorY - h / 2 + (Math.random() - 0.5) * 84;
    }

    const vx = Math.cos(heading) * speed;
    const vy = Math.sin(heading) * speed;

    const el = document.createElement("div");
    el.className = "fish game-fish " + (type === "task" ? "fish--gold" : "fish--blue");
    el.setAttribute("data-fish", type);
    el.style.width = w + "px";
    el.style.zIndex = "60";
    el.innerHTML =
      '<span class="fish__glow"></span>' +
      '<div class="fish__sway"><div class="fish__frames"></div></div>';

    const wrap = el.querySelector(".fish__frames");
    const imgs = [];

    const fish = {
      el: el,
      wrap: wrap,
      imgs: imgs,
      type: type,
      x: startX,
      y: startY,
      w: w,
      h: h,
      vx: vx,
      vy: vy,
      speed: speed,
      dir: plan.dir,
      vertical: Boolean(plan.vertical),
      pitchDir: plan.pitchDir || 0,
      needYaw: plan.needYaw,
      phaseId: plan.phase,
      anchorX: plan.anchorX - w / 2,
      anchorY: plan.anchorY - h / 2,
      mode: "enter",
      hoverAt: 0,
      spawnedAt: performance.now(),
      entered: false,
      swayAmp: 5 + Math.random() * 10,
      swayW: 0.7 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      framePos: Math.random() * FRAME_COUNT,
      fps: FRAME_FPS,
      ready: false,
      eaten: false,
      reach: false,
      faceDir: vx >= 0 ? 1 : -1
    };

    wrap.style.setProperty("--dir", String(fish.faceDir));

    let loaded = 0;
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const num = i < 10 ? "0" + i : String(i);
      const img = new Image();
      img.className = "fish__frame";
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.style.opacity = i === 1 ? "1" : "0";
      img._o = i === 1 ? 1 : 0;
      img.addEventListener("load", function () {
        loaded += 1;
        if (loaded === FRAME_COUNT) prepareGameFrames(fish);
      });
      img.src = "assets/mindflow_fish_frames/" + type + "_fish_frame_" + num + ".png";
      wrap.appendChild(img);
      imgs.push(img);
    }

    el.style.transform = "translate3d(" + fish.x + "px, " + fish.y + "px, 0)";
    fishStage.appendChild(el);
    GAME.fishes.push(fish);
    GAME.activeFish = fish;
  }

  function prepareGameFrames(fish) {
    let baseW = 0;
    let maxH = 0;
    fish.imgs.forEach(function (img) {
      baseW = Math.max(baseW, img.naturalWidth || 0);
      maxH = Math.max(maxH, img.naturalHeight || 0);
    });
    if (!baseW || !maxH) return;

    fish.imgs.forEach(function (img) {
      if (!img.naturalWidth) return;
      img.style.width = ((img.naturalWidth / baseW) * 94).toFixed(2) + "%";
    });
    fish.wrap.style.aspectRatio = baseW + " / " + maxH;
    fish.w = fish.el.offsetWidth || fish.w;
    fish.h = fish.el.offsetHeight || fish.h;
    fish.ready = true;
    fish.el.classList.add("is-ready");
  }

  /**
   * 引导轨迹：先游向目标侧的驻留点，到达后缓慢徘徊等待用户转头，
   * 超出停留时间才继续游走。避免鱼一闪而过、逼用户甩头去追。
   */
  function updateFishMotion(fish, time, dt) {
    const step = dt / 1000;

    if (fish.mode === "enter") {
      const dx = fish.anchorX - fish.x;
      const dy = fish.anchorY - fish.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        fish.mode = "hover";
        fish.hoverAt = time;
        fish.x = fish.anchorX;
        fish.y = fish.anchorY;
      } else {
        const move = Math.min(dist, fish.speed * step);
        fish.x += (dx / dist) * move;
        fish.y += (dy / dist) * move;
        setFishFacing(fish, dx);
      }
      return;
    }

    if (fish.mode === "hover") {
      const t = (time - fish.hoverAt) / 1000 + fish.phase;
      const tx = fish.anchorX + Math.cos(t * 0.9) * 20;
      const ty = fish.anchorY + Math.sin(t * 0.7) * 13;
      const k = Math.min(1, dt / 220);
      fish.x += (tx - fish.x) * k;
      fish.y += (ty - fish.y) * k;

      if (time - fish.hoverAt > GUIDE.hoverMs) {
        fish.mode = "exit";
        fish.vx = (fish.dir === 0 ? (Math.random() < 0.5 ? -1 : 1) : fish.dir) * fish.speed;
        fish.vy = (Math.random() - 0.5) * fish.speed * 0.35;
        setFishFacing(fish, fish.vx);
      }
      return;
    }

    fish.x += fish.vx * step;
    fish.y += fish.vy * step;
  }

  function setFishFacing(fish, dx) {
    const next = dx >= 0 ? 1 : -1;
    if (fish.faceDir === next) return;
    fish.faceDir = next;
    fish.wrap.style.setProperty("--dir", String(next));
  }

  function releaseActiveFish(fish, missed) {
    if (GAME.activeFish !== fish) return;
    GAME.activeFish = null;
    if (missed) GAME.tally.missed += 1;
    GAME.nextSpawnAt = performance.now() + GUIDE.spawnGapMs;
  }

  function updateGame(time, dt) {
    for (let i = GAME.fishes.length - 1; i >= 0; i--) {
      const fish = GAME.fishes[i];
      if (fish.eaten) continue;

      updateFishMotion(fish, time, dt);

      const sway = Math.sin((time / 1000) * fish.swayW + fish.phase) * fish.swayAmp;
      fish.el.style.transform =
        "translate3d(" + fish.x.toFixed(2) + "px, " + (fish.y + sway).toFixed(2) + "px, 0)";

      if (fish.ready) {
        const count = fish.imgs.length;
        fish.framePos = (fish.framePos + (fish.fps * dt) / 1000) % count;

        const base = Math.floor(fish.framePos);
        const i0 = base % count;
        const i1 = (i0 + 1) % count;
        const blend = Math.max(0, Math.min(1, (fish.framePos - base - 0.85) / 0.15));

        for (let k = 0; k < count; k++) {
          const o = k === i0 ? 1 - blend : k === i1 ? blend : 0;
          const img = fish.imgs[k];
          if (img._o !== o) {
            img.style.opacity = o.toFixed(3);
            img._o = o;
          }
        }
      }

      if (!fish.entered) {
        if (
          fish.x > -fish.w * 0.5 &&
          fish.x < stageBox.w - fish.w * 0.5 &&
          fish.y > -fish.h * 0.5 &&
          fish.y < stageBox.h - fish.h * 0.5
        ) {
          fish.entered = true;
        }
      } else if (
        fish.mode === "exit" &&
        (fish.x < -fish.w - 140 ||
          fish.x > stageBox.w + 140 ||
          fish.y < -fish.h - 140 ||
          fish.y > stageBox.h + 140)
      ) {
        if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
        GAME.fishes.splice(i, 1);
        releaseActiveFish(fish, true);
      }
    }

    if (GAME.state !== "playing") return;

    updateAim();
    applyAssist();
    updateLock();

    const now = performance.now();

    // 入场动画播放期间先不刷鱼，等镜头落定后再开始
    if (now < GAME.introUntil) return;

    updateSuck(now);

    updateRound(now);
    if (GAME.state !== "playing") return;

    updateGuideHud(now);
    updateSpawn(now);
  }

  function eatOne(fish) {
    if (fish.eaten) return;
    fish.eaten = true;

    // 基础价值看离中心多远；转头幅度到位再乘最多 1.5 倍，
    // 用奖励而不是硬门槛引导「做到位」。
    const base = fishValue(fish);
    const needYaw = fish.needYaw || 0;
    const yawAbs = Math.abs(GAME.poseYaw);
    const quality = needYaw <= 0 ? 1 : Math.min(1.2, yawAbs / needYaw);
    const value = Math.max(1, Math.round(base * (0.6 + quality * 0.9)));
    GAME.score += value;

    recordTally(fish, yawAbs, needYaw);

    // 只有金色任务鱼推进任务进度，蓝色归中鱼只是休息
    if (fish.type === "task") {
      advanceTask(value);
    }

    fish.locked = false;
    fish.el.classList.remove("is-locked", "is-reach");
    fish.el.classList.add("is-eaten");

    const rect = stage.getBoundingClientRect();
    spawnBubbles(rect.left + fish.x + fish.w / 2, rect.top + fish.y + fish.h / 2);

    window.setTimeout(function () {
      if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
    }, 420);

    const index = GAME.fishes.indexOf(fish);
    if (index >= 0) GAME.fishes.splice(index, 1);

    releaseActiveFish(fish, false);
    sfx("eat", value);
  }

  function recordTally(fish, yawAbs, needYaw) {
    const tally = GAME.tally;
    if (fish.vertical) {
      if (fish.pitchDir > 0) {
        tally.up += 1;
      } else {
        tally.down += 1;
      }
    } else if (fish.dir < 0) {
      tally.left += 1;
      tally.leftPeak = Math.max(tally.leftPeak, yawAbs);
    } else if (fish.dir > 0) {
      tally.right += 1;
      tally.rightPeak = Math.max(tally.rightPeak, yawAbs);
    }
    if (fish.dir !== 0) {
      // 训练幅度阶梯只在主训阶段累计，热身/放松不参与加幅
      const elapsed = GAME.roundStart ? performance.now() - GAME.roundStart : 0;
      if (currentPhase(elapsed).id === "main") GAME.mainDone += 1;
    }
    if (needYaw <= 0 || yawAbs >= needYaw * GUIDE.reachRatio) tally.standard += 1;
  }

  function eatLocked() {
    let count = 0;

    GAME.fishes.slice().forEach(function (fish) {
      if (count >= 4) return;
      // 锁定记忆：张嘴瞬间头部会有微小抖动，450ms 内锁定过就仍算命中
      const remembered = performance.now() - (fish.lockedAt || 0) < 450;
      if ((fish.locked || remembered) && !fish.eaten) {
        eatOne(fish);
        count += 1;
      }
    });

    if (count > 0) {

      GAME.combo = Math.min(9, GAME.combo + count - 1);
      sfx("combo", GAME.combo);
      aimBite();
    } else {
      GAME.combo = 1;
      flashMouth();
    }

    updateHud();
    updateInteractionText();
  }

  function aimBite() {
    if (!aimEl) return;
    aimEl.classList.remove("is-bite");
    void aimEl.offsetWidth;
    aimEl.classList.add("is-bite");
    window.setTimeout(function () {
      aimEl.classList.remove("is-bite");
    }, 340);
    flashMouth();
  }

  function updateAim() {
    if (!aimEl || !stageBox.w) return;

    const pose = window.MindFlowPose;
    const now = performance.now();
    const fresh = Boolean(pose && pose.active && now - pose.t < 420);

    if (fresh) GAME.everPosed = true;
    // 摄像头停掉后 5 秒都没有新数据，才退回鼠标控制
    if (pose && GAME.everPosed && now - pose.t > 5000) GAME.everPosed = false;

    GAME.poseFresh = fresh;
    const usePose = Boolean(GAME.everPosed && pose);
    GAME.poseYaw = usePose ? Number(pose.yaw) || 0 : GAME.aimX * 50;

    // 角速度安全保护：快速甩头时短暂断开锁定，逼用户慢下来
    if (usePose && fresh && Math.abs(Number(pose.yawRate) || 0) > GUIDE.maxYawRate) {
      GAME.speedGuardUntil = now + 500;
      if (now - GAME.lastSpeedWarnAt > 1500) {
        GAME.lastSpeedWarnAt = now;
        sfx("slow");
        showGameToast("慢一点", "转头太快了，稳住再转");
      }
    }
    const speeding = now - GAME.lastSpeedWarnAt < 1200;

    let hintText;
    if (!usePose) {
      hintText = "移动鼠标控制位置 · 按住空格可连续吸鱼";
    } else if (!fresh) {
      hintText = "面部暂时丢失 · 准星保持在原位，请回正";
    } else if (speeding) {
      hintText = "慢一点 · 转头太快了，稳住再转";
    } else {
      hintText = "跟着鱼的方向慢慢转头 · 到位后停一下";
    }
    if (hintText !== GAME.lastHint) {
      GAME.lastHint = hintText;
      if (hudHintEl) hudHintEl.textContent = hintText;
    }

    const target = shapeInput(clamp(usePose ? pose.x : GAME.pointerX, -1, 1));
    GAME.aimTarget = target;
    GAME.aimX += (GAME.aimTarget - GAME.aimX) * 0.22;

    const vTarget = shapeInput(clamp(usePose ? Number(pose.y) || 0 : GAME.pointerY, -1, 1));
    GAME.aimVTarget = vTarget;
    GAME.aimV += (GAME.aimVTarget - GAME.aimV) * 0.22;

    const baseY = (GAME.aimRatio || 0.52) * stageBox.h;
    const vRange = stageBox.h * 0.42;
    GAME.aimY = clamp(baseY - GAME.aimV * vRange, stageBox.h * 0.14, stageBox.h * 0.94);

    const half = stageBox.w / 2;
    const margin = Math.min(26, stageBox.w * 0.03);
    GAME.aimPx = half + GAME.aimX * Math.max(40, half - margin);

    GAME.aimDrawX = GAME.aimPx;
    GAME.aimDrawY = GAME.aimY;
  }

  /**
   * 磁吸：准星靠近鱼时，绘制位置向最近那条鱼的中心偏移。
   * 只作用于渲染与命中判定，不污染输入状态，所以不会越吸越偏。
   */
  function applyAssist() {
    let helped = false;

    if (GAME.fishes.length) {
      let best = null;
      let bestDist = Infinity;

      for (const fish of GAME.fishes) {
        if (fish.eaten) continue;
        const cx = fish.x + fish.w / 2;
        const cy = fish.y + fish.h / 2;
        const distance = Math.hypot(cx - GAME.aimDrawX, cy - GAME.aimDrawY);
        if (distance < bestDist) {
          bestDist = distance;
          best = fish;
        }
      }

      if (best && bestDist < GAME.assistRadius) {
        const ratio = Math.max(0, 1 - bestDist / GAME.assistRadius);
        const pull = Math.pow(ratio, 0.85) * 0.45;
        GAME.aimDrawX += (best.x + best.w / 2 - GAME.aimDrawX) * pull;
        GAME.aimDrawY += (best.y + best.h / 2 - GAME.aimDrawY) * pull;
        helped = true;
      }
    }

    if (aimEl) {
      aimEl.style.transform =
        "translate3d(" + GAME.aimDrawX.toFixed(1) + "px, " + GAME.aimDrawY.toFixed(1) + "px, 0) translate(-50%, -50%)";
      aimEl.classList.toggle("is-assist", helped);
    }
  }

  function updateLock() {
    if (!aimEl) return;

    let anyLocked = false;
    const now = performance.now();
    const guarded = now < GAME.speedGuardUntil;

    GAME.fishes.forEach(function (fish) {
      const dx = fish.x + fish.w / 2 - GAME.aimDrawX;
      const dy = fish.y + fish.h / 2 - GAME.aimDrawY;
      const hit = !guarded && Math.hypot(dx, dy) <= GAME.lockRadius;

      if (hit !== fish.locked) {
        fish.locked = hit;
        fish.el.classList.toggle("is-locked", hit);
        if (hit) sfx("lock");
      }
      if (hit) {
        fish.lockedAt = now;
        anyLocked = true;
      }

      const reach = fishNeedReach(fish);
      if (reach !== fish.reach) {
        fish.reach = reach;
        fish.el.classList.toggle("is-reach", reach);
      }
    });

    aimEl.classList.toggle("is-locked", anyLocked);
    aimEl.classList.toggle("is-guarded", guarded);
  }

  /**
   * 「做到位」：必须是朝鱼所在的同一方向转到目标幅度的 85% 以上。
   * 不达标也能吃（收益打折），达标时金色环亮起、收益更高。
   */
  function fishNeedReach(fish) {
    const need = fish.needYaw || 0;
    if (need <= 0) return false;
    if (fish.dir < 0) return GAME.poseYaw <= -need * GUIDE.reachRatio;
    if (fish.dir > 0) return GAME.poseYaw >= need * GUIDE.reachRatio;
    return false;
  }

  /**
   * 张嘴一次开启 2.2 秒「吸气窗口」，窗口内准星扫到锁定鱼就自动吞。
   * 持续张着嘴会把窗口一直往后续，所以张一次就能连吃好几条，不必反复开合。
   */
  function updateSuck(now) {
    if (aimEl) aimEl.classList.toggle("is-sucking", now < GAME.suckUntil);

    const mouth = window.MindFlowMouth;
    const mouthFresh = Boolean(mouth && mouth.t && now - mouth.t < 400);

    if ((mouthFresh && mouth.open) || GAME.keyHold) {
      GAME.suckUntil = Math.max(GAME.suckUntil, now + 260);
    }

    if (now >= GAME.suckUntil) return;
    if (now - GAME.lastChompAt < GAME.chompInterval) return;

    const hasLocked = GAME.fishes.some(function (fish) {
      return fish.locked && !fish.eaten;
    });
    if (!hasLocked) return;

    eatLocked();
    GAME.lastChompAt = now;
  }

  /* ---------- 出鱼调度：命中驱动 + 方向预告 ---------- */

  function updateSpawn(now) {
    // 吃掉或游走一条之后才安排下一条，节奏由用户掌控，不会堆鱼诱人乱甩
    if (!GAME.activeFish && !GAME.pendingGuide && now >= GAME.nextSpawnAt) {
      const guide = planGuide(now);
      GAME.pendingGuide = guide;
      showCue(guide.dir);
      GAME.cueSpawnAt = now + GUIDE.cueMs;
      return;
    }

    if (GAME.pendingGuide && now >= GAME.cueSpawnAt) {
      const guide = GAME.pendingGuide;
      GAME.pendingGuide = null;
      hideCue();
      createGameFish(guide);
    }
  }

  function showCue(dir) {
    if (!fishStage || GAME.cueEl) return;
    const el = document.createElement("div");
    el.className =
      "fish-cue " +
      (dir < 0 ? "fish-cue--left" : dir > 0 ? "fish-cue--right" : "fish-cue--center");
    el.innerHTML = '<span class="fish-cue__beam"></span><span class="fish-cue__ring"></span>';
    fishStage.appendChild(el);
    GAME.cueEl = el;
  }

  function hideCue() {
    if (GAME.cueEl && GAME.cueEl.parentNode) GAME.cueEl.parentNode.removeChild(GAME.cueEl);
    GAME.cueEl = null;
  }

  let gameToastTimer = 0;

  function showGameToast(title, detail) {
    if (!gameToastEl || !gameToastTitleEl || !gameToastDetailEl) return;
    gameToastTitleEl.textContent = title;
    gameToastDetailEl.textContent = detail;
    gameToastEl.classList.remove("is-visible");
    void gameToastEl.offsetWidth;
    gameToastEl.classList.add("is-visible");
    if (gameToastTimer) window.clearTimeout(gameToastTimer);
    gameToastTimer = window.setTimeout(function () {
      gameToastEl.classList.remove("is-visible");
    }, 1600);
  }

  function hideGameToast() {
    if (gameToastTimer) window.clearTimeout(gameToastTimer);
    gameToastTimer = 0;
    if (gameToastEl) gameToastEl.classList.remove("is-visible");
  }

  /* ---------- 90 秒训练进程 ---------- */

  function updateRound(now) {
    if (!GAME.roundStart || GAME.state !== "playing") return;
    if (now - GAME.roundStart >= GUIDE.roundMs) endRound();
  }

  function updateGuideHud(now) {
    if (now - GAME.lastGuideHudAt < 200) return;
    GAME.lastGuideHudAt = now;

    const elapsed = Math.max(0, now - GAME.roundStart);
    const phase = currentPhase(elapsed);
    const remain = Math.max(0, Math.ceil((phase.to - elapsed) / 1000));

    if (hudPhaseEl) {
      hudPhaseEl.textContent =
        phase.label + " · " + Math.floor(remain / 60) + ":" + String(remain % 60).padStart(2, "0");
    }

    let dirText = "等待下一条鱼";
    const target = GAME.pendingGuide || GAME.activeFish;
    if (target) {
      if (target.dir < 0) dirText = "向左转头 " + target.needYaw + "°";
      else if (target.dir > 0) dirText = "向右转头 " + target.needYaw + "°";
      else dirText = "回正 · 蓝色休息鱼";
    }
    if (hudDirEl && hudDirEl.textContent !== dirText) hudDirEl.textContent = dirText;

    if (hudAngleEl) {
      const yaw = GAME.poseYaw;
      hudAngleEl.textContent = Math.abs(yaw) < 2
        ? "当前 回正中"
        : "当前 " + (yaw > 0 ? "右 " : "左 ") + Math.abs(yaw).toFixed(0) + "°";
    }

    if (hudBarFillEl) {
      const pct = Math.min(100, Math.max(0, (elapsed / GUIDE.roundMs) * 100));
      hudBarFillEl.style.width = pct.toFixed(1) + "%";
    }
  }

  function endRound() {
    GAME.state = "roundEnd";
    sfx("roundEnd");
    bgmDuck();
    GAME.pendingGuide = null;
    hideCue();
    clearGameFish();
    GAME.activeFish = null;
    GAME.suckUntil = 0;
    GAME.keyHold = false;
    if (aimEl) aimEl.classList.remove("is-locked", "is-sucking", "is-guarded", "is-bite");

    renderRoundSummary();
    if (hudEl) hudEl.hidden = true;
    if (roundEndEl) roundEndEl.hidden = false;
  }

  function renderRoundSummary() {
    if (roundEyebrowEl) {
      roundEyebrowEl.textContent = planNote
        ? "本组 90 秒完成 · " + planNote
        : "本组 90 秒完成";
    }

    const tally = GAME.tally;
    const total = tally.left + tally.right;
    const diff = Math.abs(tally.left - tally.right);

    if (roundLeftEl) roundLeftEl.textContent = tally.left + " 次";
    if (roundRightEl) roundRightEl.textContent = tally.right + " 次";
    if (roundLeftPeakEl) roundLeftPeakEl.textContent = "峰值 " + Math.round(tally.leftPeak) + "°";
    if (roundRightPeakEl) roundRightPeakEl.textContent = "峰值 " + Math.round(tally.rightPeak) + "°";
    if (roundStandardEl) roundStandardEl.textContent = String(tally.standard);
    if (roundMissedEl) roundMissedEl.textContent = String(tally.missed);

    let balance = "左右已配平";
    let warn = false;
    if (total === 0) {
      balance = "本组还没有完成动作";
    } else if (diff / total > 0.2) {
      warn = true;
      balance = tally.left > tally.right ? "右侧偏少 · 下一组补做右边" : "左侧偏少 · 下一组补做左边";
    }

    if (tally.up || tally.down) {
      balance += " · 上仰 " + tally.up + " 次 / 低头 " + tally.down + " 次";
    }

    if (roundBalanceEl) {
      roundBalanceEl.textContent = balance;
      roundBalanceEl.classList.toggle("is-warn", warn);
    }

    requestAiReview(tally);
  }

  function requestAiReview(tally) {
    if (!roundAiEl || !roundAiTextEl) return;
    roundAiEl.hidden = true;
    roundAiTextEl.textContent = "";
    if (roundAiTagEl) roundAiTagEl.textContent = "AI 点评";

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? window.setTimeout(function () { controller.abort(); }, 9000)
      : 0;

    fetch("/api/v1/training/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        left: tally.left,
        right: tally.right,
        leftPeak: tally.leftPeak,
        rightPeak: tally.rightPeak,
        standard: tally.standard,
        missed: tally.missed
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.text) return;
        if (GAME.state !== "roundEnd") return;
        if (roundAiTagEl && data.source === "template") {
          roundAiTagEl.textContent = "训练提示";
        }
        roundAiTextEl.textContent = data.text;
        roundAiEl.hidden = false;
      })
      .catch(function () {
        // 静默回退：保留硬指标，不显示 AI 区
      })
      .then(function () {
        if (timer) window.clearTimeout(timer);
      });
  }

  function applyPlan(plan) {
    if (!plan || !Array.isArray(plan.segments)) return;
    if (plan.note) planNote = String(plan.note).trim();
    for (const segment of plan.segments) {
      const target = GUIDE.phases.find(function (phase) { return phase.id === segment.id; });
      if (!target) continue;
      if (Number.isFinite(segment.yaw)) target.yaw = segment.yaw;
      if (segment.id === "main") {
        if (segment.focus === "left" || segment.focus === "right") {
          planFocus = segment.focus;
        } else {
          planFocus = "balanced";
        }
        if (Number.isFinite(segment.spawnGapMs)) {
          GUIDE.spawnGapMs = segment.spawnGapMs;
        }
      }
    }
  }

  function prefetchPlan() {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? window.setTimeout(function () { controller.abort(); }, 8000)
      : 0;

    fetch("/api/v1/training/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        left: GAME.tally.left,
        right: GAME.tally.right,
        leftPeak: GAME.tally.leftPeak,
        rightPeak: GAME.tally.rightPeak,
        standard: GAME.tally.standard,
        missed: GAME.tally.missed
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (plan) {
        applyPlan(plan);
      })
      .catch(function () {
        // 静默回退：保持默认剧本
      })
      .then(function () {
        if (timer) window.clearTimeout(timer);
      });
  }

  function resetRoundState() {
    GAME.roundStart = 0;
    GAME.guideSeq = [];
    GAME.lastGuideDir = 0;
    GAME.mainDone = 0;
    GAME.activeFish = null;
    GAME.pendingGuide = null;
    GAME.nextSpawnAt = 0;
    GAME.poseYaw = 0;
    GAME.speedGuardUntil = 0;
    GAME.lastSpeedWarnAt = 0;
    GAME.lastGuideHudAt = 0;
    GAME.tally = { left: 0, right: 0, leftPeak: 0, rightPeak: 0, up: 0, down: 0, standard: 0, missed: 0 };
    GAME.verticalPlan = GUIDE.vertical.at.map(function (at, index) {
      return { at: at, pitchDir: index === 0 ? 1 : -1, done: false };
    });
    hideCue();
    hideGameToast();
    if (roundEndEl) roundEndEl.hidden = true;
    if (roundAiEl) roundAiEl.hidden = true;
  }

  function updateHud() {
    if (hudScoreEl) hudScoreEl.textContent = String(GAME.score);
    if (hudComboEl) {
      hudComboEl.textContent = "连击 x" + GAME.combo;
      hudComboEl.classList.toggle("is-hot", GAME.combo >= 3);
    }
  }

  /**
   * 越靠画面边缘的鱼越值钱：转得越远，任务推进得越多。
   * 这让「大幅度活动颈椎」成为拿进度的最优解，而不是靠小幅乱晃刷数。
   */
  function fishValue(fish) {
    const dx = (fish.x + fish.w / 2 - stageBox.w / 2) / Math.max(1, stageBox.w / 2);
    const dy = (fish.y + fish.h / 2 - stageBox.h / 2) / Math.max(1, stageBox.h / 2);
    const radius = Math.hypot(dx, dy);
    if (radius > 0.62) return 3;
    if (radius > 0.34) return 2;
    return 1;
  }

  function advanceTask(value) {
    const task = TASKS[GAME.taskIndex];
    GAME.taskEaten += value;

    if (GAME.taskEaten >= task.goal) {
      completeTask();
      return;
    }
    updateTaskUI();
  }

  function completeTask() {
    const finished = TASKS[GAME.taskIndex];
    GAME.completedTasks += 1;

    if (taskBadgeEl) {
      taskBadgeEl.textContent = "已完成";
      taskBadgeEl.classList.add("is-done");
    }

    GAME.taskIndex = (GAME.taskIndex + 1) % TASKS.length;
    GAME.taskEaten = 0;
    updateTaskUI();
    updateHud();
    flashMouth();

    window.setTimeout(function () {
      if (taskBadgeEl) {
        taskBadgeEl.textContent = "进行中";
        taskBadgeEl.classList.remove("is-done");
      }
    }, 1500);

    return finished;
  }

  function updateTaskUI() {
    const task = TASKS[GAME.taskIndex];
    const pct = Math.min(100, Math.round((GAME.taskEaten / task.goal) * 100));

    if (taskTitleEl) taskTitleEl.textContent = task.title + " · " + task.detail;
    if (taskProgressEl) taskProgressEl.style.width = pct + "%";
    if (taskCountEl) taskCountEl.textContent = GAME.taskEaten + " / " + task.goal + " 条";
    if (taskPercentEl) taskPercentEl.textContent = pct + "%";
    if (hudTaskEl) hudTaskEl.textContent = task.title + " · " + GAME.taskEaten + "/" + task.goal;
  }

  function clearGameFish() {
    GAME.fishes.forEach(function (fish) {
      if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
    });
    GAME.fishes.length = 0;
  }

  function enterImmersive() {
    sfx("unlock");
    sfx("dive");
    bgmStart();
    GAME.aimRatio = 0.52;
    GAME.aimY = GAME.aimRatio * stageBox.h;
    GAME.aimX = 0;
    GAME.aimTarget = 0;
    GAME.aimV = 0;
    GAME.aimVTarget = 0;
    GAME.aimPx = stageBox.w / 2;
    GAME.poseFresh = false;
    GAME.lastPoseFresh = null;
    GAME.suckUntil = 0;
    GAME.lastChompAt = 0;
    GAME.keyHold = false;
    GAME.lastHint = "";

    document.body.dataset.mode = "immersive";
    if (hudEl) hudEl.hidden = false;
    updateHud();
    updateTaskUI();
    updateAim();
  }

  function exitImmersive() {
    bgmStop();
    document.body.dataset.mode = "";
    if (hudEl) hudEl.hidden = true;
    if (aimEl) aimEl.classList.remove("is-locked", "is-bite", "is-sucking", "is-guarded");

    clearGameFish();
    GAME.state = "idle";
    GAME.score = 0;
    GAME.combo = 1;
    GAME.spawnTimer = 0;
    GAME.introUntil = 0;
    GAME.aimX = 0;
    GAME.aimTarget = 0;
    GAME.suckUntil = 0;
    GAME.lastChompAt = 0;
    GAME.keyHold = false;
    resetRoundState();

    if (interactionEl) {
      delete interactionEl.dataset.state;
      interactionEl.classList.remove("is-flash");
    }
    updateInteractionText();
  }

  function startGame() {
    GAME.state = "playing";
    GAME.score = 0;
    GAME.combo = 1;
    GAME.spawnTimer = 0;
    GAME.introUntil = 0;
    resetRoundState();
    if (interactionEl) interactionEl.dataset.state = "playing";
    // 开局前切回首页，避免在演示页上进入沉浸态
    setView("home");
    enterImmersive();
    updateInteractionText();

    const beginRound = function () {
      GAME.introUntil = 0;
      // 入场镜头落定后才开始计时和出鱼，避免动画期间鱼先游起来
      GAME.roundStart = performance.now();
      GAME.nextSpawnAt = GAME.roundStart + 400;
    };

    const dive = window.MindFlowDive && window.MindFlowDive.play ? window.MindFlowDive.play() : null;
    if (dive) {
      GAME.introUntil = performance.now() + 2600;
      dive.then(beginRound).catch(beginRound);
    } else {
      beginRound();
    }
  }

  function startAgain() {
    if (roundEndEl) roundEndEl.hidden = true;
    clearGameFish();
    GAME.state = "playing";
    GAME.score = 0;
    GAME.combo = 1;
    GAME.introUntil = 0;
    resetRoundState();
    enterImmersive();
    GAME.roundStart = performance.now();
    GAME.nextSpawnAt = GAME.roundStart + 300;
  }

  function faceTrigger() {
    if (GAME.state === "idle") {
      startGame();
      return;
    }
    if (GAME.state !== "playing") return;
    // 每张嘴一次，给 2.2 秒自动吞鱼窗口
    GAME.suckUntil = performance.now() + 2200;
    GAME.lastChompAt = 0;
    eatLocked();
  }

  function flashMouth() {
    if (!interactionEl) return;
    interactionEl.classList.remove("is-flash");
    void interactionEl.offsetWidth;
    interactionEl.classList.add("is-flash");
    window.setTimeout(function () {
      interactionEl.classList.remove("is-flash");
    }, 380);
  }

  function updateInteractionText() {
    if (!interactionEl) return;
    const strong = interactionEl.querySelector(".interaction__text strong");
    const small = interactionEl.querySelector(".interaction__text small");
    if (!strong || !small) return;

    if (GAME.state === "playing") {
      strong.textContent = "张嘴吃鱼 · 已吃 " + GAME.score + " 条";
      small.textContent =
        GAME.combo > 1
          ? "连击 x" + GAME.combo + " · 空格键也能吃"
          : "鱼游到嘴边时张嘴，或按空格键";
    } else if (!cameraReady()) {
      strong.textContent = "点击开启摄像头";
      small.textContent = "需要授权相机权限，画面不离开本机";
    } else {
      strong.textContent = "张嘴一下，开始互动";
      small.textContent = "或使用空格键确认";
    }
  }

  function cameraReady() {
    const cam = window.MindFlowCamera;
    return Boolean(cam && cam.isRunning());
  }

  if (interactionEl) {
    interactionEl.addEventListener("click", function () {
      if (!cameraReady()) {
        const toggle = document.getElementById("monitor-toggle");
        if (toggle) toggle.click();
        return;
      }
      faceTrigger();
    });
  }

  window.addEventListener("mindflow:camera", function (event) {
    const on = Boolean(event.detail && event.detail.running);
    if (interactionEl) {
      if (on) {
        delete interactionEl.dataset.state;
      } else {
        interactionEl.dataset.state = "camera";
      }
    }
    updateInteractionText();
  });

  if (interactionEl && !cameraReady()) {
    interactionEl.dataset.state = "camera";
    updateInteractionText();
  }

  window.addEventListener("keydown", function (event) {
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (!event.repeat) {
        GAME.keyHold = true;
        faceTrigger();
      }
      return;
    }
    if (event.code === "Escape" && (GAME.state === "playing" || GAME.state === "roundEnd")) {
      exitImmersive();
    }
  });

  window.addEventListener("keyup", function (event) {
    if (event.code === "Space" || event.key === " ") {
      GAME.keyHold = false;
    }
  });

  if (hudExitEl) {
    hudExitEl.addEventListener("click", function () {
      exitImmersive();
    });
  }

  if (hudMusicEl) {
    hudMusicEl.addEventListener("click", function () {
      setBgmOn(!bgmOn);
    });
  }

  if (bgmEl) {
    bgmEl.addEventListener("ended", bgmNext);
  }

  if (roundAgainEl) {
    roundAgainEl.addEventListener("click", function () {
      startAgain();
    });
  }

  if (roundExitEl) {
    roundExitEl.addEventListener("click", function () {
      exitImmersive();
    });
  }

  window.addEventListener("mindflow:mouth", function () {
    const now = performance.now();
    if (now - GAME.lastMouthAt < 320) return;
    GAME.lastMouthAt = now;
    faceTrigger();
  });

  window.MindFlowGame = {
    trigger: faceTrigger,
    toast: showGameToast,
    task: function () {
      return {
        index: GAME.taskIndex,
        eaten: GAME.taskEaten,
        goal: TASKS[GAME.taskIndex].goal,
        done: GAME.completedTasks
      };
    },
    guide: function () {
      const elapsed = GAME.roundStart ? performance.now() - GAME.roundStart : 0;
      const phase = currentPhase(elapsed);
      const target = GAME.pendingGuide || GAME.activeFish;
      return {
        phase: phase.id,
        elapsed: Math.round(elapsed),
        remain: Math.max(0, Math.round(GUIDE.roundMs - elapsed)),
        dir: target ? target.dir : 0,
        needYaw: target ? target.needYaw : 0,
        poseYaw: Math.round(GAME.poseYaw),
        locked: GAME.fishes.some(function (fish) {
          return fish.locked;
        }),
        fishMode: GAME.activeFish ? GAME.activeFish.mode : "",
        tally: { ...GAME.tally }
      };
    },
    endRound: endRound,
    moveToMouth: function () {
      if (!GAME.fishes.length) return false;
      const fish = GAME.fishes[0];
      const mouth = mouthCenter();
      fish.x = mouth.x - fish.w / 2;
      fish.y = mouth.y - fish.h / 2;
      return true;
    },
    state: function () {
      return GAME.state;
    },
    score: function () {
      return GAME.score;
    },
    fishCount: function () {
      return GAME.fishes.length;
    }
  };

  updateTaskUI();
  prefetchPlan();
  /* ================= 互动结束 ================= */

  window.addEventListener("resize", resize);

  window.addEventListener("pointermove", function (event) {
    pointer.tx = (event.clientX / window.innerWidth - 0.5) * 22;
    pointer.ty = (event.clientY / window.innerHeight - 0.5) * 16;
    GAME.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    GAME.pointerY = 1 - (event.clientY / window.innerHeight) * 2;
  });

  window.addEventListener("pointerdown", function (event) {
    spawnBubbles(event.clientX, event.clientY);
  });

  resize();
  measureStage();

  if (window.LiquidGlass) {
    [
      [".sidebar", { strength: 0.28, blur: 3 }],
      [".doc-picker", { strength: 0.32, blur: 2.5 }],
      [".status-pill", { strength: 0.34, blur: 2.5 }],
      [".interaction", { strength: 0.3, blur: 3 }],
      [".card", { strength: 0.3, blur: 3.5 }],
      [".monitor", { strength: 0.3, blur: 3.5 }],
      [".dock", { strength: 0.28, blur: 3.5 }]
    ].forEach(function (spec) {
      window.LiquidGlass.autoAttach(spec[0], spec[1]);
    });

    window.setTimeout(function () {
      window.LiquidGlass.refresh();
    }, 600);
  }

  if (!prefersReduced) {
    requestAnimationFrame(loop);
  } else {
    drawBubbles();
    drawWaves(0);
    updateFish(0, 16.7);
  }
})();