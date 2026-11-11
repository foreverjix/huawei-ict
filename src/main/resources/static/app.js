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

  // 干扰物与诱饵鱼：只在进入沉浸态后按需加载，避免拖慢首屏
  const DECOR = {
    dir: "assets/mindflow_split_assets/",
    jellyPrefix: "jellyfish_swim_",
    decoyPrefix: "decoy_fish_frame_",
    jellyCount: 10,
    decoyCount: 21,
    jellyFps: 0.4
  };

  function padFrame(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function preloadDecor() {
    if (GAME.decorLoaded) return;
    GAME.decorLoaded = true;
    for (let i = 1; i <= DECOR.jellyCount; i++) {
      const img = new Image();
      img.src = DECOR.dir + DECOR.jellyPrefix + padFrame(i) + ".png";
    }
    for (let i = 1; i <= DECOR.decoyCount; i++) {
      const img = new Image();
      img.src = DECOR.dir + DECOR.decoyPrefix + padFrame(i) + ".png";
    }
  }

  function loadImages(urls) {
    urls.forEach(function (url) {
      const img = new Image();
      img.src = url;
    });
  }

  // 首屏稳定后再悄悄预热游戏素材，进入沉浸态时不出现逐帧加载
  function warmupGameAssets() {
    preloadDecor();

    const world = "assets/mindflow_world_assets/";
    loadImages([world + "tide_surge_01.png"]);

    window.setTimeout(function () {
      const urls = [
        world + "sea_shallow_01.png",
        world + "sea_middle_01.png",
        world + "sea_deep_01.png"
      ];
      for (let i = 1; i <= 8; i++) {
        urls.push(world + "badge_depth_" + padFrame(i) + ".png");
      }
      for (let i = 1; i <= 5; i++) {
        urls.push(world + "badge_streak_" + padFrame(i) + ".png");
      }
      loadImages(urls);
    }, 2600);
  }
  const stageBox = { w: 0, h: 0, heroTop: 0 };
  const fishes = [];
  const bootState = { total: 0, done: 0 };

  function finishBoot() {
    bootState.done += 1;
    if (bootState.done < bootState.total || !fishStage) return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        fishStage.classList.add("is-assets-ready");
      });
    });
  }

  if (fishStage) {
    FISH_CONFIG.forEach(function (conf) {
      const el = document.createElement("div");
      el.className =
        "fish " +
        (conf.type === "task" ? "fish--gold" : "fish--blue") +
        (conf.far ? " fish--far" : "") +
        " is-booting";
      el.setAttribute("data-fish", conf.type);
      bootState.total += 1;
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
      finishBoot();
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
    finishBoot();

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
  const praiseEl = document.getElementById("praise");
  const praiseTextEl = document.getElementById("praise-text");
  const praiseSubEl = document.getElementById("praise-sub");
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
  const hudFragmentsEl = document.getElementById("hud-fragments");
  const roundFragmentsEl = document.getElementById("round-fragments");
  const gameProgressEl = document.getElementById("game-progress");
  const gameProgressLabelEl = document.getElementById("game-progress-label");
  const gameProgressFillEl = document.getElementById("game-progress-fill");
  const gameProgressDropsEl = document.getElementById("game-progress-drops");

  // 当前任务同步自「文档阅读」的拆段任务：读一段，首页任务卡与游戏内进度一起切到这一段
  const DOC_TASK_KEY = "mindflow.docTask";
  const FRAGMENT_KEY = "mindflow.docFragments";
  let docTask = null;
  let docTaskDocumentId = "";
  let docTaskSeq = 0;

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
    lockBonus: 30,
    steadyUntil: 0,
    steadyCooldownUntil: 0,
    slowUntil: 0,
    slowCooldownUntil: 0,
    slowScale: 0.85,
    missStreak: 0,
    poseFresh: false,
    everPosed: false,
    lastHint: "",
    lastPoseFresh: null,
    suckUntil: 0,
    lastChompAt: 0,
    chompInterval: 190,
    keyHold: false,

    taskEaten: 0,
    completedTasks: 0,
    keywordCollected: [],

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
    posePitch: 0,
    poseRoll: 0,
    stillMs: 0,
    stillSince: 0,
    speedGuardUntil: 0,
    lastSpeedWarnAt: 0,
    lastGuideHudAt: 0,
    tally: {
      left: 0, right: 0, leftPeak: 0, rightPeak: 0,
      up: 0, down: 0,
      rollLeft: 0, rollRight: 0, rollLeftPeak: 0, rollRightPeak: 0,
      still: 0, standard: 0, missed: 0, ribbon: 0
    },
    verticalPlan: [],
    rollPlan: [],
    stillPlan: [],
    weakSide: null,
    eatenCount: 0,

    // ---- 干扰物与诱饵鱼 ----
    jellies: [],
    nextJellyAt: 0,
    nextForkAt: 0,
    jellyHintShown: false,
    forkHintShown: false,
    decorLoaded: false,

    // ---- 潮汐爆发与顺序连招 ----
    tide: {
      active: false, startedAt: 0, until: 0, nextAt: 0, fxRoot: null,
      eaten: 0, rewarded: false, waveIndex: 0, nextWaveAt: 0, lastSuckAt: 0, blackHoleEl: null
    },
    sequence: { active: false, steps: [], index: 0, nextAt: 0, el: null },
    ribbon: { active: false, startedAt: 0, until: 0, trail: [], sum: 0, samples: 0, perfect: 0, match: 0, el: null },
    eventCooldownUntil: 0,
    events: [],
    forkPending: false
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
    tideMs: 8000,
    tideGapMs: 340,
    tideCueMs: 200,
    tideHoverMs: 6000,
    maxYawRate: 70,
    reachRatio: 0.85,
    phases: [
      { id: "warmup", label: "热身", from: 0, to: 15000, yaw: 20 },
      { id: "main", label: "主训", from: 15000, to: 65000, yaw: 25 },
      { id: "cool", label: "放松", from: 65000, to: 90000, yaw: 15 }
    ],
    vertical: {
      at: [30000, 50000],
      upYaw: 15,
      downYaw: 20
    },
    roll: {
      at: [17000, 50000],
      angle: 18
    },
    still: {
      at: [42000, 60000],
      holdMs: 1600
    },
    specialOverdueMs: 14000,
    ribbonMs: 10000,
    ribbonScore: 20
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
  const WEAK_SIDE_KEY = "mindflow_weak_side_v1";

  function readWeakSide() {
    try {
      const raw = localStorage.getItem(WEAK_SIDE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && (data.side === "left" || data.side === "right") ? data.side : "balanced";
    } catch (ignored) {
      return "balanced";
    }
  }

  function saveWeakSide(side) {
    if (!side) return;
    try {
      localStorage.setItem(WEAK_SIDE_KEY, JSON.stringify({ side: side, ts: Date.now() }));
    } catch (ignored) {
      // 隐私模式忽略
    }
  }

  function computeWeakSide() {
    const tally = GAME.tally;
    const total = tally.left + tally.right;
    if (total < 6) return "balanced";
    const countBias = (tally.left - tally.right) / total;
    const peakBase = Math.max(12, tally.leftPeak, tally.rightPeak);
    const peakBias = (tally.leftPeak - tally.rightPeak) / peakBase;
    const score = countBias * 0.6 + peakBias * 0.4;
    if (Math.abs(score) < 0.1) return "balanced";
    return score > 0 ? "right" : "left";
  }

  function weakAdjustedYaw(dir, need) {
    if (!GAME.weakSide || GAME.weakSide === "balanced") return need;
    const weakDir = GAME.weakSide === "right" ? 1 : -1;
    return dir === weakDir ? Math.max(10, Math.round(need * 0.8)) : need;
  }

  function nextGuideDir() {
    if (!GAME.guideSeq.length) {
      const rightDue = GAME.tally.left - GAME.tally.right >= 1;
      const leftDue = GAME.tally.right - GAME.tally.left >= 1;
      const balancedNow = Math.abs(GAME.tally.left - GAME.tally.right) < 1;
      let first;
      if (rightDue) first = 1;
      else if (leftDue) first = -1;
      else if (balancedNow && GAME.weakSide === "right") first = 1;
      else if (balancedNow && GAME.weakSide === "left") first = -1;
      else if (planFocus === "right") first = 1;
      else if (planFocus === "left") first = -1;
      else first = GAME.lastGuideDir === 1 ? -1 : 1;

      const weakBoost = balancedNow && (GAME.weakSide === "right" || GAME.weakSide === "left");
      GAME.guideSeq = weakBoost ? [first, 0, first, -first] : [first, 0, -first, 0];
    }
    return GAME.guideSeq.shift();
  }

  function planGuide(now) {
    const elapsed = Math.max(0, now - GAME.roundStart);
    const phase = currentPhase(elapsed);

    // 顺序连招期间，出鱼严格按提示顺序来，不再走左右交替
    if (GAME.sequence.active && GAME.sequence.index < GAME.sequence.steps.length) {
      const step = GAME.sequence.steps[GAME.sequence.index];
      const axis = step.axis || "yaw";
      const stepDir = axis === "yaw" ? step.dir : 0;
      return {
        axis: axis,
        dir: stepDir,
        vertical: axis === "pitch",
        pitchDir: axis === "pitch" ? step.dir : 0,
        rollDir: axis === "roll" ? step.dir : 0,
        needYaw: stepDir === 0 ? 0 : weakAdjustedYaw(stepDir, phase.yaw),
        phase: phase.id,
        anchorX:
          axis === "roll" || axis === "pitch"
            ? stageBox.w * (step.dir > 0 ? 0.76 : 0.24)
            : stepDir < 0
              ? stageBox.w * 0.24
              : stepDir > 0
                ? stageBox.w * 0.76
                : stageBox.w * (0.46 + Math.random() * 0.08),
        anchorY:
          axis === "pitch"
            ? stageBox.h * (step.dir > 0 ? 0.2 : 0.8)
            : stageBox.h * (0.34 + Math.random() * 0.3)
      };
    }

    // 主训段插入纵向/侧倾/静止引导；超过 14 秒没轮到就跳过，不堆到放松段
    if (phase.id === "main") {
      const candidates = [];
      GAME.verticalPlan.forEach(function (slot) {
        if (!slot.done) candidates.push({ at: slot.at, kind: "pitch", slot: slot });
      });
      GAME.rollPlan.forEach(function (slot) {
        if (!slot.done) candidates.push({ at: slot.at, kind: "roll", slot: slot });
      });
      GAME.stillPlan.forEach(function (slot) {
        if (!slot.done) candidates.push({ at: slot.at, kind: "still", slot: slot });
      });
      candidates.sort(function (a, b) {
        return a.at - b.at;
      });
      const due = candidates.find(function (item) {
        return elapsed >= item.at && elapsed <= item.at + GUIDE.specialOverdueMs;
      });

      if (due) {
        due.slot.done = true;
        if (due.kind === "pitch") {
          return {
            axis: "pitch",
            dir: 0,
            vertical: true,
            pitchDir: due.slot.pitchDir,
            needYaw: 0,
            phase: phase.id,
            anchorX: stageBox.w * (0.4 + Math.random() * 0.2),
            anchorY: stageBox.h * (due.slot.pitchDir > 0 ? 0.2 : 0.8)
          };
        }
        if (due.kind === "roll") {
          return {
            axis: "roll",
            dir: 0,
            vertical: false,
            rollDir: due.slot.rollDir,
            needYaw: 0,
            phase: phase.id,
            anchorX: stageBox.w * (due.slot.rollDir > 0 ? 0.76 : 0.24),
            anchorY: stageBox.h * (0.36 + Math.random() * 0.24)
          };
        }
        return {
          axis: "still",
          dir: 0,
          vertical: false,
          needYaw: 0,
          phase: phase.id,
          anchorX: stageBox.w * (0.44 + Math.random() * 0.12),
          anchorY: stageBox.h * 0.42
        };
      }
    }

    const dir = nextGuideDir();
    const needYaw = dir === 0 ? 0 : weakAdjustedYaw(dir, phaseYaw(phase));

    // 幅度越大，驻留点越靠边；但仍留在准星 + 磁吸可达的范围内
    const edge = phase.id === "warmup" ? 0.27 : phase.id === "main" ? 0.21 : 0.31;
    const jitter = Math.random() * 0.04;
    let anchorX;
    if (dir < 0) anchorX = stageBox.w * (edge + jitter);
    else if (dir > 0) anchorX = stageBox.w * (1 - edge - jitter);
    else anchorX = stageBox.w * (0.46 + Math.random() * 0.08);

    return {
      axis: "yaw",
      dir: dir,
      vertical: false,
      needYaw: needYaw,
      phase: phase.id,
      anchorX: anchorX,
      anchorY: stageBox.h * (0.34 + Math.random() * 0.3)
    };
  }

  function createGameFish(guide, opts) {

    if (!fishStage || !stageBox.w) return;

    const plan = guide || planGuide(performance.now());
    const isDecoy = Boolean(opts && opts.decoy);
    // 只记录左右方向，中间的归中鱼不能覆盖交替依据
    if (!isDecoy && plan.dir !== 0) GAME.lastGuideDir = plan.dir;
    // 左右目标鱼推进任务，中央鱼只是回正的休息鱼，诱饵鱼什么都不推进
    // 左右目标鱼、侧倾鱼、抬头/低头鱼推进任务；回正与静止鱼只是休息
    const axis = plan.axis || "yaw";
    const isRest = axis === "still" || (axis === "yaw" && plan.dir === 0);
    const type = isDecoy ? "decoy" : isRest ? "rest" : "task";
    const fragment = !isDecoy && type === "task" ? nextPendingFragment() : null;
    const keywords = !isDecoy && type === "task" && docTask && docTask.status === "active"
      && Array.isArray(docTask.keywords) ? docTask.keywords : [];
    let keywordIndex = null;
    for (let i = 0; i < keywords.length; i++) {
      if (GAME.keywordCollected.indexOf(i) < 0) {
        keywordIndex = i;
        break;
      }
    }
    const sizeRatio = isDecoy ? 0.075 : isRest ? 0.088 : 0.075;
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
    } else if (axis === "roll") {
      const fromLeft = plan.rollDir < 0;
      heading = fromLeft ? 0 : Math.PI;
      startX = fromLeft ? -w - 70 : stageBox.w + 70;
      startY = plan.anchorY - h / 2;
    } else if (axis === "still") {
      const fromLeft = Math.random() < 0.5;
      heading = fromLeft ? 0 : Math.PI;
      startX = stageBox.w * 0.5 - w / 2 + (fromLeft ? -260 : 260);
      startY = plan.anchorY - h / 2;
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
    el.className =
      "fish game-fish " +
      (isDecoy ? "fish--decoy" : type === "task" ? "fish--gold" : "fish--blue");
    if (axis === "still") el.classList.add("fish--calm");
    if (GAME.tide.active && !isDecoy) el.classList.add("is-tide");
    el.setAttribute("data-fish", type);
    el.style.width = w + "px";
    el.style.zIndex = "60";
    el.innerHTML =
      '<span class="fish__glow"></span>' +
      '<div class="fish__sway"><div class="fish__frames"></div></div>' +
      (opts && opts.spark
        ? '<span class="fish__spark s1"></span><span class="fish__spark s2"></span>'
        : "");

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
      speed: axis === "still" ? 105 + Math.random() * 14 : speed,
      dir: plan.dir,
      axis: axis,
      vertical: Boolean(plan.vertical),
      pitchDir: plan.pitchDir || 0,
      rollDir: plan.rollDir || 0,
      stillMs: 0,
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
      isDecoy: isDecoy,
      spark: Boolean(opts && opts.spark),
      hoverMs: opts && opts.hoverMs ? opts.hoverMs : isDecoy ? 3500 : axis === "still" ? 4600 : GAME.tide.active ? GUIDE.tideHoverMs : GUIDE.hoverMs,
      fragmentIndex: fragment ? fragment.index : null,
      fragmentTitle: fragment ? fragment.title : "",
      keywordIndex: keywordIndex,
      reach: false,
      faceDir: vx >= 0 ? 1 : -1
    };

    wrap.style.setProperty("--dir", String(fish.faceDir));

    let loaded = 0;
    const frameCount = isDecoy ? DECOR.decoyCount : FRAME_COUNT;
    for (let i = 1; i <= frameCount; i++) {
      const num = padFrame(i);
      const img = new Image();
      img.className = "fish__frame";
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.style.opacity = i === 1 ? "1" : "0";
      img._o = i === 1 ? 1 : 0;
      img.addEventListener("load", function () {
        loaded += 1;
        if (loaded === frameCount) prepareGameFrames(fish);
      });
      img.src = isDecoy
        ? DECOR.dir + DECOR.decoyPrefix + num + ".png"
        : "assets/mindflow_fish_frames/" + type + "_fish_frame_" + num + ".png";
      wrap.appendChild(img);
      imgs.push(img);
    }

    el.style.transform = "translate3d(" + fish.x + "px, " + fish.y + "px, 0)";
    fishStage.appendChild(el);
    GAME.fishes.push(fish);
    if (!isDecoy) GAME.activeFish = fish;
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
    const scale = currentFishSpeedScale(time);

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
        const move = Math.min(dist, fish.speed * step * scale);
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
      const k = Math.min(1, (dt / 220) * scale);
      fish.x += (tx - fish.x) * k;
      fish.y += (ty - fish.y) * k;

      if (time - fish.hoverAt > (fish.hoverMs || GUIDE.hoverMs)) {
        fish.mode = "exit";
        fish.vx = (fish.dir === 0 ? (Math.random() < 0.5 ? -1 : 1) : fish.dir) * fish.speed;
        fish.vy = (Math.random() - 0.5) * fish.speed * 0.35;
        setFishFacing(fish, fish.vx);
      }
      return;
    }

    fish.x += fish.vx * step * scale;
    fish.y += fish.vy * step * scale;
  }

  function createJelly(now) {
    if (!fishStage || !stageBox.w) return;

    const size = Math.round(clamp(stageBox.w * 0.062, 76, 124));
    const el = document.createElement("div");
    el.className = "game-jelly";
    el.style.width = size + "px";
    el.style.zIndex = "58";
    el.innerHTML = '<div class="game-jelly__frames"></div>';

    const wrap = el.querySelector(".game-jelly__frames");
    const imgs = [];
    const jelly = {
      el: el,
      wrap: wrap,
      imgs: imgs,
      x: stageBox.w * (0.14 + Math.random() * 0.72) - size / 2,
      y: stageBox.h + size * 0.9,
      drawX: 0,
      w: size,
      h: size,
      speed: stageBox.h / 7,
      swayAmp: 12 + Math.random() * 16,
      swayW: 0.7 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      framePos: Math.random() * DECOR.jellyCount,
      fps: DECOR.jellyFps,
      ready: false,
      hit: false,
      spawnedAt: now
    };
    jelly.drawX = jelly.x;

    let loaded = 0;
    for (let i = 1; i <= DECOR.jellyCount; i++) {
      const img = new Image();
      img.className = "game-jelly__frame";
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.style.opacity = i === 1 ? "1" : "0";
      img._o = i === 1 ? 1 : 0;
      img.addEventListener("load", function () {
        loaded += 1;
        if (loaded === DECOR.jellyCount) {
          jelly.ready = true;
          el.classList.add("is-ready");
        }
      });
      img.src = DECOR.dir + DECOR.jellyPrefix + padFrame(i) + ".png";
      wrap.appendChild(img);
      imgs.push(img);
    }

    el.style.transform = "translate3d(" + jelly.x + "px, " + jelly.y + "px, 0)";
    fishStage.appendChild(el);
    GAME.jellies.push(jelly);
  }

  function updateJellies(time, dt) {
    const step = dt / 1000;

    for (let i = GAME.jellies.length - 1; i >= 0; i--) {
      const jelly = GAME.jellies[i];
      if (jelly.hit) continue;

      jelly.y -= jelly.speed * step;
      const sway = Math.sin((time / 1000) * jelly.swayW + jelly.phase) * jelly.swayAmp;
      jelly.drawX = jelly.x + sway;
      jelly.el.style.transform =
        "translate3d(" + jelly.drawX.toFixed(2) + "px, " + jelly.y.toFixed(2) + "px, 0)";

      if (jelly.ready) {
        const count = jelly.imgs.length;
        jelly.framePos = (jelly.framePos + (jelly.fps * dt) / 1000) % count;

        const base = Math.floor(jelly.framePos);
        const i0 = base % count;
        const i1 = (i0 + 1) % count;
        const blend = Math.max(0, Math.min(1, (jelly.framePos - base - 0.85) / 0.15));

        for (let k = 0; k < count; k++) {
          const o = k === i0 ? 1 - blend : k === i1 ? blend : 0;
          const img = jelly.imgs[k];
          if (img._o !== o) {
            img.style.opacity = o.toFixed(3);
            img._o = o;
          }
        }
      }

      if (jelly.y + jelly.h < -180) {
        if (jelly.el.parentNode) jelly.el.parentNode.removeChild(jelly.el);
        GAME.jellies.splice(i, 1);
      }
    }
  }

  function clearJellies() {
    GAME.jellies.forEach(function (jelly) {
      if (jelly.el.parentNode) jelly.el.parentNode.removeChild(jelly.el);
    });
    GAME.jellies.length = 0;
  }

  function checkJellyHit() {
    if (!GAME.jellies.length) return false;

    let hitIndex = -1;
    for (let i = 0; i < GAME.jellies.length; i++) {
      const jelly = GAME.jellies[i];
      if (jelly.hit) continue;
      const dx = jelly.drawX + jelly.w / 2 - GAME.aimDrawX;
      const dy = jelly.y + jelly.h / 2 - GAME.aimDrawY;
      if (Math.hypot(dx, dy) <= Math.max(56, GAME.lockRadius * 0.72)) {
        hitIndex = i;
        break;
      }
    }
    if (hitIndex < 0) return false;

    const jelly = GAME.jellies[hitIndex];
    jelly.hit = true;
    jelly.el.classList.add("is-hit");
    GAME.combo = Math.max(1, GAME.combo - 2);
    GAME.score = Math.max(0, GAME.score - 5);
    sfx("slow");
    showWarn("水母不能吃", "连击 -2 · 等它漂过去再张嘴");
    updateHud();

    window.setTimeout(function () {
      if (jelly.el.parentNode) jelly.el.parentNode.removeChild(jelly.el);
      const index = GAME.jellies.indexOf(jelly);
      if (index >= 0) GAME.jellies.splice(index, 1);
    }, 320);
    return true;
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
    if (missed) {
      GAME.tally.missed += 1;
      GAME.missStreak += 1;
      if (GAME.missStreak >= 2) {
        GAME.missStreak = 0;
        activateSlow(performance.now());
      }
    }
    GAME.nextSpawnAt = performance.now() + (GAME.tide.active ? GUIDE.tideGapMs : GUIDE.spawnGapMs);
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

    updateJellies(time, dt);

    const now = performance.now();

    // 入场动画播放期间先不刷鱼，等镜头落定后再开始
    if (now < GAME.introUntil) return;

    updateSuck(now);

    updateRound(now);
    if (GAME.state !== "playing") return;

updateGuideHud(now);
    updateTide(now);
    updateSequence(now);
    updateRibbon(now);
    updateEvents(now);
    updateSpawn(now);

  }

  function eatOne(fish) {
    if (fish.eaten) return;
    fish.eaten = true;

    // 基础价值看离中心多远；转头幅度到位再乘最多 1.5 倍，
    // 用奖励而不是硬门槛引导「做到位」。
    const base = fishValue(fish);
    const ratio = fishReachRatio(fish);
    const noNeed = fish.axis === "yaw" && (fish.needYaw || 0) <= 0;
    const quality = noNeed ? 1 : Math.min(1.2, ratio);
    const value = Math.max(1, Math.round(base * (0.6 + quality * 0.9)));
    GAME.score += value;
    GAME.eatenCount += 1;

    const prevCombo = GAME.combo;
    GAME.combo = nextCombo(GAME.combo, 1);
    popCombo(fish, GAME.combo);
    praiseForCombo(prevCombo, GAME.combo);
    updateHud();

    if (GAME.tide.active) {
      GAME.tide.eaten += 1;
      if (GAME.tide.eaten >= 3 && !GAME.tide.rewarded) {
        GAME.tide.rewarded = true;
        GAME.score += 6;
        GAME.combo = nextCombo(GAME.combo, 2);
        showPraise("洋流连吃三条", "分数 +6 · 连击 +2", "warm");
        updateHud();
      }
    }

    recordTally(fish);
    GAME.missStreak = 0;
    if (GAME.sequence.active) advanceSequence(fish);

    // 只有金色任务鱼推进任务进度，蓝色归中鱼只是休息
    if (fish.type === "task") {
      advanceTask(value);
      if (typeof fish.keywordIndex === "number") {
        collectKeyword(fish.keywordIndex);
      }
      if (typeof fish.fragmentIndex === "number") {
        collectFragment(fish.fragmentIndex, fish.fragmentTitle);
        showPraise("收集到碎片", fish.fragmentTitle || ("第 " + (fish.fragmentIndex + 1) + " 块"));
      }
    }

    fish.locked = false;
    fish.el.classList.remove("is-locked", "is-reach");
    fish.el.classList.add("is-eaten");

    const rect = stage.getBoundingClientRect();
    spawnBubbles(rect.left + fish.x + fish.w / 2, rect.top + fish.y + fish.h / 2);
    popScore(fish.x + fish.w / 2, fish.y + fish.h / 2, value);

    window.setTimeout(function () {
      if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
    }, 420);

    const index = GAME.fishes.indexOf(fish);
    if (index >= 0) GAME.fishes.splice(index, 1);

    releaseActiveFish(fish, false);
    sfx("eat", value);
  }

  function eatDecoy(fish) {
    if (fish.eaten) return;
    fish.eaten = true;

    GAME.combo = Math.max(1, GAME.combo - 1);

    fish.locked = false;
    fish.el.classList.remove("is-locked", "is-reach");
    fish.el.classList.add("is-eaten");

    sfx("slow");
    showWarn("这是诱饵", "真的一条在另一边，带光点的才算数");

    window.setTimeout(function () {
      if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
    }, 420);

    const index = GAME.fishes.indexOf(fish);
    if (index >= 0) GAME.fishes.splice(index, 1);
  }

  function recordTally(fish) {
    const tally = GAME.tally;
    const ratio = fishReachRatio(fish);
    if (fish.axis === "pitch") {
      if (fish.pitchDir > 0) tally.up += 1;
      else tally.down += 1;
    } else if (fish.axis === "roll") {
      if (fish.rollDir < 0) {
        tally.rollLeft += 1;
        tally.rollLeftPeak = Math.max(tally.rollLeftPeak, Math.abs(GAME.poseRoll));
      } else if (fish.rollDir > 0) {
        tally.rollRight += 1;
        tally.rollRightPeak = Math.max(tally.rollRightPeak, Math.abs(GAME.poseRoll));
      }
    } else if (fish.axis === "still") {
      if (ratio >= GUIDE.reachRatio) tally.still += 1;
    } else if (fish.dir < 0) {
      tally.left += 1;
      tally.leftPeak = Math.max(tally.leftPeak, Math.abs(GAME.poseYaw));
    } else if (fish.dir > 0) {
      tally.right += 1;
      tally.rightPeak = Math.max(tally.rightPeak, Math.abs(GAME.poseYaw));
    }
    if (fish.axis === "yaw" && fish.dir !== 0) {
      const elapsed = GAME.roundStart ? performance.now() - GAME.roundStart : 0;
      if (currentPhase(elapsed).id === "main") GAME.mainDone += 1;
    }
    if (ratio >= GUIDE.reachRatio) tally.standard += 1;
  }

  function eatLocked() {
    if (GAME.ribbon.active) return;
    let count = 0;
    let decoyCount = 0;

    GAME.fishes.slice().forEach(function (fish) {
      if (count + decoyCount >= 4) return;
      // 锁定记忆：张嘴瞬间头部会有微小抖动，450ms 内锁定过就仍算命中
      const remembered = performance.now() - (fish.lockedAt || 0) < 450;
      if ((fish.locked || remembered) && !fish.eaten) {
        if (fish.type === "decoy") {
          eatDecoy(fish);
          decoyCount += 1;
        } else {
          eatOne(fish);
          count += 1;
        }
      }
    });

    if (count > 0) {
      sfx("combo", GAME.combo);
      aimBite();
    } else if (decoyCount === 0) {
      GAME.combo = nextCombo(GAME.combo, -1);
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
    GAME.posePitch = usePose ? Number(pose.pitch) || 0 : 0;
    GAME.poseRoll = usePose ? Number(pose.roll) || 0 : 0;

    // 角速度安全保护：快速甩头时短暂断开锁定，逼用户慢下来
    if (usePose && fresh && Math.abs(Number(pose.yawRate) || 0) > GUIDE.maxYawRate) {
      GAME.speedGuardUntil = now + 500;
      if (now - GAME.lastSpeedWarnAt > 1500) {
        GAME.lastSpeedWarnAt = now;
        sfx("slow");
        showWarn("慢一点", "转头太快了，稳住再转");
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

  function currentLockRadius(now) {
    return GAME.lockRadius + (now < GAME.steadyUntil ? GAME.lockBonus : 0);
  }

  function currentFishSpeedScale(now) {
    return now < GAME.slowUntil ? GAME.slowScale : 1;
  }

  function updateLock() {
    if (!aimEl) return;

    let anyLocked = false;
    const now = performance.now();
    const guarded = now < GAME.speedGuardUntil;

    const stillFish = GAME.activeFish && GAME.activeFish.axis === "still" && GAME.activeFish.mode === "hover"
      ? GAME.activeFish
      : null;
    if (stillFish && GAME.everPosed && GAME.poseFresh && !guarded
      && Math.abs(GAME.poseYaw) <= 4
      && Math.abs(GAME.posePitch) <= 4
      && Math.abs(GAME.poseRoll) <= 4) {
      if (!GAME.stillSince) GAME.stillSince = now;
      stillFish.stillMs = now - GAME.stillSince;
      GAME.stillMs = stillFish.stillMs;
    } else {
      GAME.stillSince = 0;
      GAME.stillMs = 0;
      if (stillFish) stillFish.stillMs = 0;
    }

    GAME.fishes.forEach(function (fish) {
      const dx = fish.x + fish.w / 2 - GAME.aimDrawX;
      const dy = fish.y + fish.h / 2 - GAME.aimDrawY;
      const hit = !guarded && Math.hypot(dx, dy) <= currentLockRadius(now);

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
  function fishReachRatio(fish) {
    if (!fish) return 0;
    if (fish.axis === "still") {
      return clamp((fish.stillMs || 0) / GUIDE.still.holdMs, 0, 1.2);
    }
    if (fish.axis === "roll") {
      if (!fish.rollDir) return 0;
      return clamp((GAME.poseRoll * fish.rollDir) / GUIDE.roll.angle, 0, 1.2);
    }
    if (fish.axis === "pitch") {
      if (!fish.pitchDir) return 0;
      const need = fish.pitchDir > 0 ? GUIDE.vertical.upYaw : GUIDE.vertical.downYaw;
      return clamp((GAME.posePitch * fish.pitchDir) / need, 0, 1.2);
    }
    const need = fish.needYaw || 0;
    if (need <= 0) return 0;
    const signed = GAME.poseYaw * (fish.dir < 0 ? -1 : 1);
    return clamp(signed / need, 0, 1.2);
  }

  function fishNeedReach(fish) {
    return fishReachRatio(fish) >= GUIDE.reachRatio;
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
    if (GAME.ribbon.active) return;
    if (GAME.tide.active) return;

    // 每次只保留当前鱼群，避免上一群的光点鱼和诱饵留在场上造成误判
    if (!GAME.activeFish && !GAME.pendingGuide && now >= GAME.nextSpawnAt) {
      clearGameFish();
      hideCue();
      const guide = planGuide(now);
      GAME.pendingGuide = guide;
      showCue(guide);
      GAME.cueSpawnAt = now + (GAME.tide.active ? GUIDE.tideCueMs : GUIDE.cueMs);
      return;
    }

    if (GAME.pendingGuide && now >= GAME.cueSpawnAt) {
      const guide = GAME.pendingGuide;
      GAME.pendingGuide = null;
      hideCue();

      createGameFish(guide, null);

    }
  }

  function spawnGuideDecoys(guide) {
    const elapsed = Math.max(0, performance.now() - GAME.roundStart);
    const phase = currentPhase(elapsed);
    [-1, 1].forEach(function (dir, index) {
      createGameFish({
        axis: "yaw",
        dir: dir,
        vertical: false,
        needYaw: phaseYaw(phase),
        phase: phase.id,
        anchorX: stageBox.w * (dir < 0 ? 0.24 : 0.76),
        anchorY: stageBox.h * (0.32 + index * 0.36)
      }, { decoy: true });
    });
  }

  function buildEventPlan(roundStart) {
    const rand = function (min, max) {
      return min + Math.random() * (max - min);
    };
    const kinds = ["sequence", "current", "tide", "fork", "jelly"];
    for (let i = kinds.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = kinds[i];
      kinds[i] = kinds[j];
      kinds[j] = tmp;
    }
    // 连招可能占用 20 秒，不排最后，避免把后面的事件挤出 90 秒
    if (kinds[kinds.length - 1] === "sequence") {
      const tmp = kinds[kinds.length - 1];
      kinds[kinds.length - 1] = kinds[kinds.length - 2];
      kinds[kinds.length - 2] = tmp;
    }

    const duration = {
      sequence: 12000,
      current: 10000,
      tide: 8000,
      fork: 4000,
      jelly: 8000
    };
    const plan = [];
    let cursor = 14000 + rand(0, 4000);
    kinds.forEach(function (type) {
      plan.push({ type: type, at: cursor });
      cursor += duration[type] + 4000 + rand(0, 2000);
    });

    const last = plan[plan.length - 1];
    if (last.at > 86000) {
      const shift = (last.at - 86000) / Math.max(1, plan.length - 1);
      plan.forEach(function (item, index) {
        item.at -= shift * index;
      });
    }

    return plan
      .map(function (item) {
        return { type: item.type, at: roundStart + item.at };
      })
      .sort(function (a, b) {
        return a.at - b.at;
      });
  }

  function updateEvents(now) {
    if (!GAME.events.length) return;
    if (now < GAME.eventCooldownUntil) return;
    const next = GAME.events[0];
    if (now < next.at) return;

    if (GAME.tide.active || GAME.sequence.active || GAME.ribbon.active) {
      const until = GAME.tide.active
        ? GAME.tide.until
        : GAME.sequence.active
          ? GAME.sequence.until || now
          : GAME.ribbon.until || now;
      next.at = Math.max(next.at, until + 6000);
      return;
    }

    GAME.events.shift();
    if (next.type === "jelly") {
      const jellyCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < jellyCount; i += 1) {
        if (i === 0) {
          createJelly(now);
        } else {
          window.setTimeout(function () {
            if (GAME.state === "playing") createJelly(performance.now());
          }, i * 320);
        }
      }
      GAME.eventCooldownUntil = now + 8000;
      if (!GAME.jellyHintShown) {
        GAME.jellyHintShown = true;
        showWarn("水母群上来了 · 别张嘴", "一次 3-5 只，鱼照常出，先忍住");
      }
    } else if (next.type === "tide") {
      startTide(now);
    } else if (next.type === "sequence") {
      startSequence(now);
    } else if (next.type === "current") {
      startRibbon(now);
    } else if (next.type === "fork") {
      spawnForkSchool(now);
    }
  }

  function spawnForkSchool(now) {
    const elapsed = Math.max(0, now - GAME.roundStart);
    const phase = currentPhase(elapsed);
    clearGameFish();
    GAME.activeFish = null;
    GAME.pendingGuide = null;
    hideCue();

    const dirs = [-1, 1, -1, 1];
    const sparkIndex = Math.floor(Math.random() * dirs.length);
    dirs.forEach(function (dir, index) {
      createGameFish({
        axis: "yaw",
        dir: dir,
        vertical: false,
        needYaw: phaseYaw(phase),
        phase: phase.id,
        anchorX: stageBox.w * (dir < 0 ? 0.22 : 0.78),
        anchorY: stageBox.h * (0.28 + index * 0.14)
      }, index === sparkIndex ? { spark: true, hoverMs: 6000 } : { decoy: true, hoverMs: 5000 });
    });
    GAME.eventCooldownUntil = now + 6000;

    if (!GAME.forkHintShown) {
      GAME.forkHintShown = true;
      showWarn("鱼群 · 只吃带光点的", "一群里只有一条是真鱼，吃错会掉连击");
    }
  }

  function maybeCreateFork(now, plan) {
    if (!GAME.forkPending) return false;
    if (GAME.tide.active || GAME.sequence.active || GAME.ribbon.active) return false;
    if (plan.axis !== "yaw" || plan.dir === 0) return false;
    if (currentPhase(Math.max(0, now - GAME.roundStart)).id !== "main") {
      GAME.forkPending = false;
      return false;
    }

    GAME.forkPending = false;
    if (!GAME.forkHintShown) {
      GAME.forkHintShown = true;
      showWarn("两条鱼 · 只吃带光点的", "另一边是诱饵，吃错会掉连击");
    }

    createGameFish({
      dir: -plan.dir,
      needYaw: plan.needYaw,
      phase: plan.phase,
      anchorX: stageBox.w - plan.anchorX,
      anchorY: plan.anchorY
    }, { decoy: true });

    return true;
  }

  function updateDecorSpawn(now) {
    if (!GAME.roundStart) return;
    if (GAME.tide.active || GAME.sequence.active) return;
    const elapsed = Math.max(0, now - GAME.roundStart);
    if (currentPhase(elapsed).id !== "main") return;
    if (!GAME.nextJellyAt || now < GAME.nextJellyAt) return;

    createJelly(now);
    GAME.nextJellyAt = now + 20000;
    if (!GAME.jellyHintShown) {
      GAME.jellyHintShown = true;
      showWarn("水母不能吃", "它漂过来时忍住别张嘴");
    }
  }

  /* ---------- 潮汐爆发 ---------- */

  function mountTideFx() {
    if (!stage) return;
    unmountTideFx();
    const root = document.createElement("div");
    root.className = "tide-fx";
    root.innerHTML =
      '<span class="tide-fx__veil"></span>' +
      '<span class="tide-fx__veil"></span>' +
      '<span class="tide-fx__veil"></span>' +
      '<span class="tide-fx__stream"></span>' +
      '<span class="tide-fx__glow"></span>' +
      '<span class="tide-fx__ring"></span>';
    stage.appendChild(root);
    GAME.tide.fxRoot = root;
  }

  function unmountTideFx() {
    if (GAME.tide.fxRoot && GAME.tide.fxRoot.parentNode) {
      GAME.tide.fxRoot.parentNode.removeChild(GAME.tide.fxRoot);
    }
    GAME.tide.fxRoot = null;
  }

  function spawnTideWave(index) {
    const elapsed = Math.max(0, performance.now() - GAME.roundStart);
    const phase = currentPhase(elapsed);
    const count = 4;
    for (let i = 0; i < count; i += 1) {
      const dir = i % 2 === 0 ? -1 : 1;
      createGameFish({
        axis: "yaw",
        dir: dir,
        vertical: false,
        needYaw: phaseYaw(phase),
        phase: phase.id,
        anchorX: stageBox.w * (0.14 + i * 0.24),
        anchorY: stageBox.h * (0.3 + index * 0.16)
      });
    }
  }

  function mountBlackHole() {
    if (!stage) return;
    unmountBlackHole();
    const el = document.createElement("div");
    el.className = "black-hole";
    el.innerHTML =
      '<span class="black-hole__core"></span>' +
      '<span class="black-hole__ring"></span>' +
      '<span class="black-hole__ring"></span>' +
      '<span class="black-hole__ring"></span>';
    stage.appendChild(el);
    GAME.tide.blackHoleEl = el;
  }

  function unmountBlackHole() {
    if (GAME.tide.blackHoleEl && GAME.tide.blackHoleEl.parentNode) {
      GAME.tide.blackHoleEl.parentNode.removeChild(GAME.tide.blackHoleEl);
    }
    GAME.tide.blackHoleEl = null;
  }

  function updateBlackHole(now) {
    if (!GAME.tide.active || now >= GAME.suckUntil) {
      unmountBlackHole();
      return;
    }
    if (!GAME.tide.blackHoleEl) mountBlackHole();
    const el = GAME.tide.blackHoleEl;
    if (!el) return;
    el.style.transform =
      "translate3d(" + GAME.aimDrawX.toFixed(1) + "px, " + GAME.aimDrawY.toFixed(1) + "px, 0)";
    el.classList.add("is-active");

    if (now - (GAME.tide.lastSuckAt || 0) < 150) return;
    GAME.tide.lastSuckAt = now;

    let best = null;
    let bestDist = 340;
    GAME.fishes.forEach(function (fish) {
      if (fish.eaten || fish.type === "decoy") return;
      const dx = fish.x + fish.w / 2 - GAME.aimDrawX;
      const dy = fish.y + fish.h / 2 - GAME.aimDrawY;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = fish;
      }
    });
    if (best) {
      best.el.classList.add("is-sucked");
      window.setTimeout(function () {
        if (best.el) best.el.classList.remove("is-sucked");
      }, 180);
      eatOne(best);
    }
  }

  function startTide(now) {
    if (GAME.tide.active) return;
    clearGameFish();
    GAME.activeFish = null;
    GAME.pendingGuide = null;
    hideCue();
    GAME.tide.active = true;
    GAME.tide.startedAt = now;
    GAME.tide.until = now + GUIDE.tideMs;
    GAME.tide.nextAt = 0;
    GAME.tide.eaten = 0;
    GAME.tide.rewarded = false;
    GAME.tide.waveIndex = 0;
    GAME.tide.nextWaveAt = now + 900;
    GAME.tide.lastSuckAt = 0;
    GAME.nextSpawnAt = now + 120;

    document.body.dataset.tide = "on";
    mountTideFx();
    sfx("tide");
    showPraise("洋流来了", "鱼群一排排出现 · 持续张嘴吸进来", "warm");
    spawnTideWave(0);
    GAME.tide.waveIndex = 1;

    const rect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
    for (let i = 0; i < 3; i++) {
      window.setTimeout(function () {
        if (GAME.state !== "playing") return;
        spawnBubbles(
          rect.left + stageBox.w * (0.2 + Math.random() * 0.6),
          rect.top + stageBox.h * (0.3 + Math.random() * 0.5)
        );
      }, 140 + i * 240);
    }
  }

  function endTide() {
    if (!GAME.tide.active) return;
    GAME.tide.active = false;
    GAME.eventCooldownUntil = performance.now() + 6000;
    document.body.dataset.tide = "";
    clearGameFish();
    GAME.activeFish = null;
    GAME.pendingGuide = null;
    hideCue();
    unmountBlackHole();
    unmountTideFx();

  }

  function updateTide(now) {
    if (!GAME.tide.active) return;
    if (now >= GAME.tide.nextWaveAt && GAME.tide.waveIndex < 4) {
      spawnTideWave(GAME.tide.waveIndex);
      GAME.tide.waveIndex += 1;
      GAME.tide.nextWaveAt = now + 1100;
    }
    updateBlackHole(now);
    if (now >= GAME.tide.until) endTide();
  }

  /* ---------- 顺序连招 ---------- */

  function sequenceIcon(step) {
    if (step.axis === "pitch") {
      return { src: "arrow_center_01.png", cls: "is-down" };
    }
    if (step.axis === "roll") {
      return {
        src: step.dir > 0 ? "arrow_right_01.png" : "arrow_left_01.png",
        cls: step.dir > 0 ? "is-roll-right" : "is-roll-left"
      };
    }
    return {
      src: step.dir < 0 ? "arrow_left_01.png" : step.dir > 0 ? "arrow_right_01.png" : "arrow_center_01.png",
      cls: ""
    };
  }

  function sequenceLabel(step) {
    if (step.axis === "roll") return "歪头";
    if (step.axis === "pitch") return "低头";
    return step.dir < 0 ? "左转" : step.dir > 0 ? "右转" : "回中";
  }

  function mountSequenceUI() {
    if (!stage) return;
    unmountSequenceUI();
    const el = document.createElement("div");
    el.className = "tide-seq";
    el.innerHTML = GAME.sequence.steps
      .map(function (step) {
        const icon = sequenceIcon(step);
        return (
          '<span class="tide-seq__step"><img class="' +
          icon.cls +
          '" src="' +
          DECOR.dir +
          icon.src +
          '" alt=""><b class="tide-seq__step--label">' +
          sequenceLabel(step) +
          "</b></span>"
        );
      })
      .join("");
    stage.appendChild(el);
    GAME.sequence.el = el;
    updateSequenceUI();
  }

  function updateSequenceUI() {
    const el = GAME.sequence.el;
    if (!el) return;
    const stepEls = el.children;
    for (let i = 0; i < stepEls.length; i++) {
      stepEls[i].classList.toggle("is-done", i < GAME.sequence.index);
      stepEls[i].classList.toggle("is-current", i === GAME.sequence.index);
      const label = stepEls[i].querySelector(".tide-seq__step--label");
      if (label) label.classList.toggle("is-current", i === GAME.sequence.index);
    }
    el.classList.add("is-visible");
  }

  function unmountSequenceUI() {
    if (GAME.sequence.el && GAME.sequence.el.parentNode) {
      GAME.sequence.el.parentNode.removeChild(GAME.sequence.el);
    }
    GAME.sequence.el = null;
  }

  function sequenceText(steps) {
    return steps
      .map(function (step) {
        return sequenceLabel(step);
      })
      .join(" → ");
  }

  function startSequence(now) {
    if (GAME.sequence.active) return;
    // 先补欠的一侧，保证左右配平
    const first = GAME.tally.left <= GAME.tally.right ? -1 : 1;
    const weakDir = GAME.weakSide === "right" ? 1 : GAME.weakSide === "left" ? -1 : first;
    GAME.sequence.active = true;
    GAME.sequence.index = 0;
    GAME.sequence.steps = [
      { axis: "yaw", dir: first },
      { axis: "roll", dir: weakDir },
      { axis: "pitch", dir: -1 }
    ];
    GAME.sequence.nextAt = now + 40000;
    GAME.sequence.until = now + 20000;
    GAME.sequence.stepStartedAt = now;
    GAME.sequence.stepDeadlineMs = 6500;
    GAME.sequence.lastStepAt = 0;
    GAME.sequence.chain = 0;
    GAME.nextSpawnAt = now + 200;
    // 连招开始先清场，避免上一组旧鱼还停在另一侧造成方向错位
    clearGameFish();
    GAME.activeFish = null;
    GAME.pendingGuide = null;
    hideCue();

    mountSequenceUI();
    sfx("sequenceStep", 0);
    showPraise("三连动作 · 跟着箭头走", sequenceText(GAME.sequence.steps), "warm");
  }

  function failSequence(title, sub) {
    const seq = GAME.sequence;
    seq.active = false;
    seq.until = 0;
    seq.stepStartedAt = 0;
    GAME.eventCooldownUntil = performance.now() + 6000;
    unmountSequenceUI();
    sfx("slow");
    showWarn(title, sub);
  }

  function advanceSequence(fish) {
    const seq = GAME.sequence;
    if (!seq.active || fish.stale) return;
    if (seq.index >= seq.steps.length) return;
    const step = seq.steps[seq.index];
    const match = fish.axis === step.axis && (step.axis !== "yaw" || fish.dir === step.dir);
    if (!match) {
      failSequence("顺序断了", "等下一组三连再来");
      return;
    }

    const now = performance.now();
    if (seq.lastStepAt && now - seq.lastStepAt <= 5500) {
      seq.chain = Math.min(2, seq.chain + 1);
    }
    seq.lastStepAt = now;
    seq.index += 1;
    seq.stepStartedAt = now;
    if (seq.index >= seq.steps.length) {
      finishSequence();
      return;
    }
    sfx("sequenceStep", seq.index);
    updateSequenceUI();
  }

  function finishSequence() {
    const seq = GAME.sequence;
    const bonus = 8 + seq.chain * 3;
    seq.active = false;
    seq.until = 0;
    seq.stepStartedAt = 0;
    GAME.eventCooldownUntil = performance.now() + 6000;
    unmountSequenceUI();
    GAME.combo = nextCombo(GAME.combo, 2);
    GAME.score += bonus;
    updateHud();
    sfx("sequenceDone");
    showPraise("三连贯通", "衔接 x" + seq.chain + " · 连击 +2 · 分数 +" + bonus, "warm");
    mountTideFx();
    window.setTimeout(unmountTideFx, 1600);
  }

  function updateSequence(now) {
    const seq = GAME.sequence;
    if (!seq.active) return;
    if (seq.until && now > seq.until) {
      failSequence("三连超时", "下一组再跟箭头");
      return;
    }
    if (seq.stepStartedAt && now - seq.stepStartedAt > seq.stepDeadlineMs) {
      failSequence("这一步超时", "慢一点，跟上当前步骤");
    }
  }

  /* ---------- 洋流跟随 ---------- */

  function ribbonPointAt(p) {
    return {
      x: stageBox.w * (0.5 + Math.sin(p * Math.PI * 2 - Math.PI / 2) * 0.34),
      y: stageBox.h * (0.5 + Math.sin(p * Math.PI) * 0.16)
    };
  }

  function ribbonPath(points) {
    if (!points.length) return "";
    return points
      .map(function (point, index) {
        return (index === 0 ? "M" : "L") + point.x.toFixed(1) + "," + point.y.toFixed(1);
      })
      .join(" ");
  }

  function mountRibbonUI() {
    if (!stage) return;
    unmountRibbonUI();
    const el = document.createElement("div");
    el.className = "current-ribbon";
    el.innerHTML =
      '<svg class="current-ribbon__svg" aria-hidden="true">' +
      '<path class="current-ribbon__guide"></path>' +
      '<path class="current-ribbon__trail"></path>' +
      "</svg>" +
      '<span class="current-ribbon__leader"></span>';
    stage.appendChild(el);
    GAME.ribbon.el = el;
  }

  function unmountRibbonUI() {
    if (GAME.ribbon.el && GAME.ribbon.el.parentNode) {
      GAME.ribbon.el.parentNode.removeChild(GAME.ribbon.el);
    }
    GAME.ribbon.el = null;
  }

  function startRibbon(now) {
    if (GAME.ribbon.active) return;
    clearGameFish();
    GAME.activeFish = null;
    GAME.pendingGuide = null;
    hideCue();
    GAME.suckUntil = 0;
    GAME.ribbon.active = true;
    GAME.ribbon.startedAt = now;
    GAME.ribbon.until = Math.min(now + GUIDE.ribbonMs, GAME.roundStart + GUIDE.roundMs - 500);
    GAME.ribbon.trail = [];
    GAME.ribbon.sum = 0;
    GAME.ribbon.samples = 0;
    GAME.ribbon.perfect = 0;
    GAME.ribbon.match = 0;
    GAME.ribbon.lastSampleAt = 0;
    GAME.nextSpawnAt = GAME.ribbon.until + 700;
    mountRibbonUI();
    sfx("tide");
    showPraise("洋流跟随", "准星贴住领航鱼 · 10 秒", "warm");
  }

  function updateRibbon(now) {
    const ribbon = GAME.ribbon;
    if (!ribbon.active) return;
    const p = clamp((now - ribbon.startedAt) / GUIDE.ribbonMs, 0, 1);
    const point = ribbonPointAt(p);
    ribbon.trail.push(point);
    if (ribbon.trail.length > 46) ribbon.trail.shift();

    if (ribbon.el) {
      const trail = ribbon.el.querySelector(".current-ribbon__trail");
      const guide = ribbon.el.querySelector(".current-ribbon__guide");
      const leader = ribbon.el.querySelector(".current-ribbon__leader");
      if (trail) trail.setAttribute("d", ribbonPath(ribbon.trail));
      if (guide && !guide.getAttribute("d")) {
        const guidePoints = [];
        for (let i = 0; i <= 60; i += 1) guidePoints.push(ribbonPointAt(i / 60));
        guide.setAttribute("d", ribbonPath(guidePoints));
      }
      if (leader) {
        leader.style.transform =
          "translate3d(" + (point.x - 13).toFixed(1) + "px, " + (point.y - 13).toFixed(1) + "px, 0)";
      }
    }

    if (now - (ribbon.lastSampleAt || 0) >= 160) {
      ribbon.lastSampleAt = now;
      const dist = Math.hypot(point.x - GAME.aimDrawX, point.y - GAME.aimDrawY);
      const closeness = clamp(1 - dist / Math.max(120, stageBox.w * 0.17), 0, 1);
      ribbon.sum += closeness;
      ribbon.samples += 1;
      if (closeness >= 0.8) ribbon.perfect += 1;
      ribbon.match = ribbon.sum / ribbon.samples;
    }

    if (now >= ribbon.until) finishRibbon(now);
  }

  function finishRibbon(now) {
    const ribbon = GAME.ribbon;
    if (!ribbon.active) return;
    const avg = ribbon.samples ? ribbon.sum / ribbon.samples : 0;
    const bonus = Math.round(avg * 14) + Math.min(6, Math.floor(ribbon.perfect / 5));
    const pct = Math.round(avg * 100);
    ribbon.active = false;
    ribbon.until = 0;
    GAME.eventCooldownUntil = now + 6000;
    GAME.tally.ribbon = pct;
    GAME.score += bonus;
    if (avg >= 0.7) GAME.combo = nextCombo(GAME.combo, 1);
    updateHud();
    unmountRibbonUI();
    GAME.nextSpawnAt = now + 700;
    sfx("sequenceDone");
    showPraise("洋流结束", "重合 " + pct + "% · 分数 +" + bonus, "warm");
  }

  function showCue(guide) {
    if (!fishStage || GAME.cueEl) return;
    const info = guide && typeof guide === "object" ? guide : { dir: guide };
    let side = "center";
    if (info.axis === "roll") side = info.rollDir > 0 ? "right" : "left";
    else if (!info.axis || info.axis === "yaw") {
      side = info.dir < 0 ? "left" : info.dir > 0 ? "right" : "center";
    }
    const el = document.createElement("div");
    el.className = "fish-cue fish-cue--" + side;
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

  const COMBO_PRAISE = {
    3: ["稳住了", "连续三次到位"],
    5: ["这一串很顺", "肩颈正在慢慢松开"],
    7: ["越转越轻松", "保持这个幅度，别加快"],
    9: ["今天状态真好", "最后几下也稳住"]
  };

  let praiseTimer = 0;
  let praiseCooldownUntil = 0;

  function showPraise(text, sub, tone) {
    if (!praiseEl || !praiseTextEl || !text) return;
    const now = performance.now();
    if (now < praiseCooldownUntil) return;
    praiseCooldownUntil = now + 1800;

    praiseTextEl.textContent = text;
    if (praiseSubEl) praiseSubEl.textContent = sub || "";
    praiseEl.classList.toggle("is-warm", tone === "warm");
    praiseEl.classList.toggle("is-warn", tone === "warn");
    praiseEl.classList.remove("is-visible");
    void praiseEl.offsetWidth;
    praiseEl.classList.add("is-visible");

    if (praiseTimer) window.clearTimeout(praiseTimer);
    praiseTimer = window.setTimeout(function () {
      praiseEl.classList.remove("is-visible");
    }, 1700);
  }

  let warnCooldownUntil = 0;

  function showWarn(text, sub) {
    if (!praiseEl || !praiseTextEl || !text) return;
    const now = performance.now();
    if (now < warnCooldownUntil) return;
    warnCooldownUntil = now + 1500;

    praiseTextEl.textContent = text;
    if (praiseSubEl) praiseSubEl.textContent = sub || "";
    praiseEl.classList.remove("is-warm");
    praiseEl.classList.add("is-warn");
    praiseEl.classList.remove("is-visible");
    void praiseEl.offsetWidth;
    praiseEl.classList.add("is-visible");

    if (praiseTimer) window.clearTimeout(praiseTimer);
    praiseTimer = window.setTimeout(function () {
      praiseEl.classList.remove("is-visible");
    }, 1800);
  }

  function activateSteady(now) {
    if (now < GAME.steadyCooldownUntil) return false;
    GAME.steadyUntil = now + 5000;
    GAME.steadyCooldownUntil = now + 13000;
    showPraise("稳住", "锁定范围扩大 5 秒");
    return true;
  }

  function activateSlow(now) {
    if (now < GAME.slowCooldownUntil) return;
    GAME.slowUntil = now + 3000;
    GAME.slowCooldownUntil = now + 11000;
    showPraise("慢一点也没关系", "缓流 3 秒", "warm");
  }

  function praiseForCombo(prevCombo, combo) {
    if (prevCombo < 3 && combo >= 3) activateSteady(performance.now());
    const hit = [9, 7, 5, 3].find(function (milestone) {
      return prevCombo < milestone && combo >= milestone;
    });
    if (hit === 3) return;
    const entry = hit ? COMBO_PRAISE[hit] : null;
    if (entry) showPraise(entry[0], entry[1]);
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

    if (hudBarFillEl) {
      const pct = Math.min(100, Math.max(0, (elapsed / GUIDE.roundMs) * 100));
      hudBarFillEl.style.width = pct.toFixed(1) + "%";
    }

    let dirText = "等待下一条鱼";
    const hasDecoy = GAME.fishes.some(function (fish) {
      return fish.type === "decoy" && !fish.eaten;
    });
    const target = GAME.activeFish || GAME.pendingGuide;
    const axis = target ? target.axis || "yaw" : "";

    if (GAME.ribbon.active) {
      dirText = "跟随洋流 · 贴住领航鱼";
    } else if (GAME.tide.active) {
      dirText = "鱼群 · 持续张嘴吸进来";
    } else if (target && axis === "roll") {
      dirText = target.rollDir > 0
        ? "向右歪头 · 耳朵找右肩 " + GUIDE.roll.angle + "°"
        : "向左歪头 · 耳朵找左肩 " + GUIDE.roll.angle + "°";
    } else if (target && axis === "pitch") {
      dirText = target.pitchDir > 0
        ? "抬头后伸 " + GUIDE.vertical.upYaw + "°"
        : "低头收下巴 " + GUIDE.vertical.downYaw + "°";
    } else if (target && axis === "still") {
      dirText = "停住不动 · 等鱼靠近";
    } else if (hasDecoy) {
      const sparkFish = GAME.fishes.find(function (fish) {
        return fish.spark && !fish.eaten;
      });
      if (sparkFish) {
        const side = sparkFish.x + sparkFish.w / 2 < stageBox.w / 2 ? "向左" : "向右";
        dirText = side + "转头 " + (sparkFish.needYaw || 0) + "° · 只吃带光点的那条";
      } else {
        dirText = "鱼群 · 只吃带光点的那条";
      }
    } else if (target) {
      if (target.dir < 0) {
        dirText = "向左转头 " + target.needYaw + "°";
      } else if (target.dir > 0) {
        dirText = "向右转头 " + target.needYaw + "°";
      } else {
        dirText = "回正 · 蓝色休息鱼";
      }
    }
    if (hudDirEl && hudDirEl.textContent !== dirText) hudDirEl.textContent = dirText;

    if (hudAngleEl) {
      if (GAME.ribbon.active) {
        hudAngleEl.textContent = "重合 " + Math.round((GAME.ribbon.match || 0) * 100) + "%";
      } else if (GAME.tide.active) {
        hudAngleEl.textContent = now < GAME.suckUntil ? "黑洞吸力中" : "持续张嘴 · 吸";
      } else if (target && axis === "still") {
        hudAngleEl.textContent =
          "静止 " + (GAME.stillMs / 1000).toFixed(1) + " / " + (GUIDE.still.holdMs / 1000).toFixed(1) + "s";
      } else if (target && axis === "roll") {
        const roll = GAME.poseRoll;
        hudAngleEl.textContent = Math.abs(roll) < 2
          ? "当前 回正中"
          : "当前 " + (roll > 0 ? "右倾 " : "左倾 ") + Math.abs(roll).toFixed(0) + "°";
      } else if (target && axis === "pitch") {
        const pitch = GAME.posePitch;
        hudAngleEl.textContent = Math.abs(pitch) < 2
          ? "当前 回正中"
          : "当前 " + (pitch > 0 ? "抬头 " : "低头 ") + Math.abs(pitch).toFixed(0) + "°";
      } else {
        const yaw = GAME.poseYaw;
        hudAngleEl.textContent = Math.abs(yaw) < 2
          ? "当前 回正中"
          : "当前 " + (yaw > 0 ? "右 " : "左 ") + Math.abs(yaw).toFixed(0) + "°";
      }
    }
  }

  const DAILY_KEY = "mindflow_daily_v1";

  function todayStamp() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function readDaily() {
    const today = todayStamp();
    let data = null;
    try {
      const raw = localStorage.getItem(DAILY_KEY);
      data = raw ? JSON.parse(raw) : null;
    } catch (ignored) {
      data = null;
    }
    if (!data || data.date !== today) {
      data = {
        date: today,
        fish: 0,
        minutes: 0,
        standard: 0,
        missed: 0,
        sessions: 0,
        bestCombo: 1,
        totalMinutes: Number(data && data.totalMinutes) || 0,
        totalFish: Number(data && data.totalFish) || 0,
        totalSessions: Number(data && data.totalSessions) || 0
      };
    }
    return data;
  }

  function saveDaily(data) {
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(data));
    } catch (ignored) {
      // 隐私模式忽略
    }
  }

  function updateDailyStats() {
    const elapsed = GAME.roundStart
      ? Math.min(GUIDE.roundMs, Math.max(0, performance.now() - GAME.roundStart))
      : GUIDE.roundMs;
    const data = readDaily();
    data.fish += GAME.eatenCount || 0;
    data.minutes += elapsed / 60000;
    data.standard += GAME.tally.standard || 0;
    data.missed += GAME.tally.missed || 0;
    data.sessions += 1;
    data.bestCombo = Math.max(data.bestCombo || 1, GAME.combo);
    data.totalMinutes += elapsed / 60000;
    data.totalFish += GAME.eatenCount || 0;
    data.totalSessions = (Number(data.totalSessions) || 0) + 1;
    saveDaily(data);
    updateTodayStatus();
  }

  const DEPTH_TOTAL = 8;

  function getDepthProfile(data) {
    const sessions = Number(data.totalSessions) || 0;
    const minutes = Number(data.totalMinutes) || 0;
    const level = Math.min(
      DEPTH_TOTAL,
      1 + Math.max(Math.floor(sessions / 2), Math.floor(minutes / 10))
    );
    const maxed = level >= DEPTH_TOTAL;
    const next = Math.min(DEPTH_TOTAL, level + 1);
    const needSessions = maxed ? 0 : Math.max(0, (next - 1) * 2 - sessions);
    const needMinutes = maxed ? 0 : Math.max(0, Math.ceil((next - 1) * 10 - minutes));
    const sessionsProgress = Math.max(0, sessions - (level - 1) * 2) / 2;
    const minutesProgress = Math.max(0, minutes - (level - 1) * 10) / 10;
    const progress = maxed ? 1 : Math.min(1, Math.max(sessionsProgress, minutesProgress));
    const zone = level <= 3 ? "shallow" : level <= 6 ? "middle" : "deep";
    const zoneLabel = level <= 3 ? "浅海" : level <= 6 ? "中层" : "深海";
    return {
      level: level,
      next: next,
      needSessions: needSessions,
      needMinutes: needMinutes,
      progress: progress,
      zone: zone,
      zoneLabel: zoneLabel,
      maxed: maxed
    };
  }

  const DEPTH_SCENE = {
    shallow: "assets/mindflow_world_assets/sea_shallow_01.png",
    middle: "assets/mindflow_world_assets/sea_middle_01.png",
    deep: "assets/mindflow_world_assets/sea_deep_01.png"
  };

  function preloadDepthScene(zone) {
    const src = DEPTH_SCENE[zone];
    if (!src || !window.Image) return;
    try {
      const img = new Image();
      img.src = src;
      if (img.decode) img.decode().catch(function () {});
    } catch (ignored) {
      // 加载失败保留默认背景
    }
  }

  function applyDepthScene(zone) {
    if (!document.body) return;
    if (document.body.dataset.depth === zone) return;
    document.body.dataset.depth = zone;
  }

  function updateDepthProfile(data) {
    const profile = getDepthProfile(data);
    const badge = document.getElementById("depth-badge");
    if (badge) {
      badge.src =
        "assets/mindflow_world_assets/badge_depth_" +
        String(profile.level).padStart(2, "0") +
        ".png";
      badge.alt = "第 " + profile.level + " 潜徽章";
    }
    const title = document.getElementById("depth-title");
    if (title) title.textContent = "第 " + profile.level + " 潜 · " + profile.zoneLabel + "海域";
    const next = document.getElementById("depth-next");
    if (next) {
      if (profile.maxed) {
        next.textContent = "已达最深 · 保持这一潜";
      } else {
        const parts = [];
        if (profile.needSessions > 0) parts.push("再 " + profile.needSessions + " 组");
        if (profile.needMinutes > 0) parts.push(profile.needMinutes + " 分钟");
        next.textContent =
          (parts.length ? parts.join(" 或 ") : "即将升级") + " → 第 " + profile.next + " 潜";
      }
    }
    const fill = document.getElementById("depth-bar-fill");
    if (fill) fill.style.width = Math.round(profile.progress * 100) + "%";
    if (document.body && document.body.dataset.mode === "immersive") {
      applyDepthScene(profile.zone);
    }
    return profile;
  }

  function updateTodayStatus() {
    const data = readDaily();
    const target = 30;
    const pct = Math.min(100, Math.round((data.fish / target) * 100));
    const ringBar = document.querySelector(".ring__bar");
    if (ringBar) {
      ringBar.style.animation = "none";
      ringBar.style.strokeDashoffset = String(352 * (1 - pct / 100));
    }
    const ringValue = document.getElementById("today-ring-value");
    if (ringValue) ringValue.innerHTML = pct + "<small>%</small>";
    const ringLabel = document.getElementById("today-ring-label");
    if (ringLabel) ringLabel.textContent = "今日目标";
    const trendLabel = document.getElementById("today-trend-label");
    if (trendLabel) {
      trendLabel.innerHTML =
        "今日吃鱼 " + data.fish + " 条 <span class=\"trend__up\">目标 " + target + "</span>";
    }
    const fishEl = document.getElementById("today-stat-fish");
    if (fishEl) fishEl.innerHTML = data.fish + "<span>条</span>";
    const minutesEl = document.getElementById("today-stat-minutes");
    if (minutesEl) minutesEl.innerHTML = Math.round(data.minutes) + "<span>分钟</span>";
    const totalEl = document.getElementById("today-stat-total");
    if (totalEl) totalEl.innerHTML = (data.standard || 0) + "<span>次</span>";
    updateDepthProfile(data);
  }

  function endRound() {
    GAME.state = "roundEnd";
    sfx("roundEnd");
    bgmDuck();
    GAME.pendingGuide = null;
    hideCue();
    if (praiseEl) praiseEl.classList.remove("is-visible");
    if (gameProgressEl) gameProgressEl.hidden = true;
    clearGameFish();
    GAME.activeFish = null;
    GAME.suckUntil = 0;
    GAME.keyHold = false;
    if (aimEl) aimEl.classList.remove("is-locked", "is-sucking", "is-guarded", "is-bite");

    const weak = computeWeakSide();
    GAME.weakSide = weak;
    saveWeakSide(weak);
    GAME.ribbon.active = false;
    GAME.ribbon.until = 0;
    unmountRibbonUI();
    GAME.sequence.active = false;
    GAME.sequence.until = 0;
    unmountSequenceUI();
    GAME.tide.active = false;
    if (document.body) document.body.dataset.tide = "";
    unmountTideFx();
    updateDailyStats();

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
    if (roundFragmentsEl) {
      const fragmentState = readFragmentState();
      roundFragmentsEl.textContent = fragmentState && Array.isArray(fragmentState.fragments)
        ? (fragmentState.collected || []).length + " / " + fragmentState.fragments.length
        : "0 / 0";
    }

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
    if (tally.rollLeft || tally.rollRight) {
      balance += " · 侧倾 左" + tally.rollLeft + " / 右" + tally.rollRight;
    }
    if (tally.still) balance += " · 静止 " + tally.still + " 次";
    if (tally.ribbon) balance += " · 洋流重合 " + tally.ribbon + "%";
    if (!warn && GAME.weakSide === "right") {
      balance += " · 下一组多补右侧、幅度略降";
    } else if (!warn && GAME.weakSide === "left") {
      balance += " · 下一组多补左侧、幅度略降";
    }

    if (roundBalanceEl) {
      roundBalanceEl.textContent = balance;
      roundBalanceEl.classList.toggle("is-warn", warn);
    }

    requestAiReview(tally);
  }

  function localLlmKey() {
    try {
      return (window.localStorage.getItem("mindflow.llmKey") || "").trim();
    } catch (ignored) {
      return "";
    }
  }

  function jsonHeaders() {
    const headers = { "Content-Type": "application/json" };
    const key = localLlmKey();
    if (key) headers["X-Llm-Api-Key"] = key;
    return headers;
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
      headers: jsonHeaders(),
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
      headers: jsonHeaders(),
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
    GAME.posePitch = 0;
    GAME.poseRoll = 0;
    GAME.stillMs = 0;
    GAME.stillSince = 0;
    GAME.eatenCount = 0;
    GAME.speedGuardUntil = 0;
    GAME.lastSpeedWarnAt = 0;
    GAME.lastGuideHudAt = 0;
    GAME.steadyUntil = 0;
    GAME.steadyCooldownUntil = 0;
    GAME.slowUntil = 0;
    GAME.slowCooldownUntil = 0;
    GAME.missStreak = 0;
    GAME.nextJellyAt = 0;
    GAME.nextForkAt = 0;
    GAME.jellyHintShown = false;
    GAME.forkHintShown = false;
    GAME.tide.active = false;
    GAME.tide.startedAt = 0;
    GAME.tide.until = 0;
    GAME.tide.nextAt = 0;
    GAME.tide.eaten = 0;
    GAME.tide.rewarded = false;
    GAME.tide.waveIndex = 0;
    GAME.tide.nextWaveAt = 0;
    GAME.tide.lastSuckAt = 0;
    GAME.sequence.active = false;
    GAME.sequence.index = 0;
    GAME.sequence.steps = [];
    GAME.sequence.nextAt = 0;
    GAME.sequence.until = 0;
    GAME.sequence.stepStartedAt = 0;
    GAME.sequence.stepDeadlineMs = 0;
    GAME.sequence.lastStepAt = 0;
    GAME.sequence.chain = 0;
    GAME.ribbon.active = false;
    GAME.ribbon.startedAt = 0;
    GAME.ribbon.until = 0;
    GAME.ribbon.trail = [];
    GAME.ribbon.sum = 0;
    GAME.ribbon.samples = 0;
    GAME.ribbon.perfect = 0;
    GAME.ribbon.match = 0;
    GAME.ribbon.lastSampleAt = 0;
    GAME.events = [];
    GAME.forkPending = false;
    GAME.eventCooldownUntil = 0;
    unmountTideFx();
    unmountSequenceUI();
    unmountRibbonUI();
    unmountBlackHole();
    if (document.body) document.body.dataset.tide = "";
    clearJellies();
    GAME.tally = {
      left: 0, right: 0, leftPeak: 0, rightPeak: 0,
      up: 0, down: 0,
      rollLeft: 0, rollRight: 0, rollLeftPeak: 0, rollRightPeak: 0,
      still: 0, standard: 0, missed: 0, ribbon: 0
    };
    GAME.verticalPlan = GUIDE.vertical.at.map(function (at, index) {
      return { at: at, pitchDir: index === 0 ? 1 : -1, done: false };
    });
    GAME.rollPlan = GUIDE.roll.at.map(function (at, index) {
      return { at: at, rollDir: index === 0 ? 1 : -1, done: false };
    });
    GAME.stillPlan = GUIDE.still.at.map(function (at) {
      return { at: at, done: false };
    });
    GAME.weakSide = readWeakSide();
    hideCue();
    hideGameToast();
    if (roundEndEl) roundEndEl.hidden = true;
    if (roundAiEl) roundAiEl.hidden = true;
    updateFragmentHud();
  }

  function nextCombo(current, count) {
    return Math.max(1, Math.min(9, current + count));
  }

  function nextComboTarget(combo) {
    if (combo < 3) return 3;
    if (combo < 5) return 5;
    if (combo < 7) return 7;
    return 9;
  }

  function popCombo(fish, combo) {
    if (!stage || !fish) return;
    const el = document.createElement("span");
    el.className = "score-pop score-pop--combo";
    el.textContent = "连击 ×" + combo;
    el.style.left = (fish.x + fish.w / 2) + "px";
    el.style.top = (fish.y + fish.h / 2) + "px";
    stage.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 950);
  }

  function popScore(x, y, value) {
    if (!stage) return;
    const el = document.createElement("span");
    el.className = "score-pop";
    el.textContent = "+" + value;
    el.style.left = x + "px";
    el.style.top = y + "px";
    stage.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 900);
  }

  function updateHud() {
    if (hudScoreEl) hudScoreEl.textContent = String(GAME.score);
    if (hudComboEl) {
      hudComboEl.textContent = GAME.combo >= 9
        ? "连击 9 / 9 · 满"
        : "连击 " + GAME.combo + " / " + nextComboTarget(GAME.combo);
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
    const task = currentTask();
    if (task.kind !== "doc" || task.goal <= 0) return;
    if (GAME.taskEaten >= task.goal) return;

    GAME.taskEaten = Math.min(task.goal, GAME.taskEaten + value);
    saveDocTaskEaten();

    if (GAME.taskEaten >= task.goal) {
      completeTask();
      return;
    }
    updateTaskUI();
  }

  function readKeywordProgress(documentId, seq) {
    try {
      const raw = localStorage.getItem("mindflow.taskShards");
      const state = raw ? JSON.parse(raw) : null;
      if (!state || String(state.documentId || "") !== String(documentId || "")) return [];
      if (Number(state.seq) !== Number(seq)) return [];
      return Array.isArray(state.collected) ? state.collected : [];
    } catch (ignored) {
      return [];
    }
  }

  function saveKeywordProgress() {
    if (!docTask || docTask.status !== "active") return;
    try {
      localStorage.setItem("mindflow.taskShards", JSON.stringify({
        documentId: docTask.documentId || "",
        seq: docTask.seq || 0,
        collected: GAME.keywordCollected
      }));
    } catch (ignored) {
      // 存储不可用时只影响回程显示
    }
  }

  function collectKeyword(index) {
    if (!docTask || docTask.status !== "active") return;
    if (GAME.keywordCollected.indexOf(index) >= 0) return;

    GAME.keywordCollected.push(index);
    saveKeywordProgress();

    const keywords = Array.isArray(docTask.keywords) ? docTask.keywords : [];
    updateTaskUI();
    if (keywords.length && GAME.keywordCollected.length >= keywords.length) {
      showPraise("这一段抓到了", keywords.join(" / "), "warm");
    }
  }

  function completeTask() {
    GAME.taskEaten = currentTask().goal;
    GAME.completedTasks += 1;
    saveDocTaskEaten();
    updateTaskUI();
    updateHud();
    flashMouth();
    showPraise("这一段消化完成", "回文档页点「我读完了」进入下一段", "warm");
  }

  function currentTask() {
    if (docTask && docTask.status === "active" && docTask.goal > 0) {
      return {
        kind: "doc",
        title: "第 " + docTask.seq + " 段 · " + docTask.title,
        detail: docTask.summary || "",
        goal: docTask.goal,
        keywords: Array.isArray(docTask.keywords) ? docTask.keywords : []
      };
    }
    if (docTask && docTask.status === "done") {
      return { kind: "done", title: "文档已读完 · 自由训练", detail: "", goal: 0 };
    }
    if (docTask && docTask.status === "none") {
      return { kind: "none", title: "还没有阅读任务", detail: "", goal: 0 };
    }
    return { kind: "free", title: "自由训练", detail: "", goal: 0 };
  }

  function updateTaskUI() {
    const task = currentTask();
    const eaten = task.kind === "doc" ? Math.min(GAME.taskEaten, task.goal) : 0;
    const pct = task.goal > 0
      ? Math.min(100, Math.round((eaten / task.goal) * 100))
      : task.kind === "done" ? 100 : 0;

    if (taskTitleEl) {
      taskTitleEl.textContent = task.kind === "doc" && task.detail
        ? task.title + " · " + task.detail
        : task.title;
    }
    if (taskBadgeEl) {
      taskBadgeEl.textContent = task.kind === "doc" ? "进行中"
        : task.kind === "done" ? "已完成"
          : task.kind === "none" ? "未开始" : "自由训练";
      taskBadgeEl.classList.toggle("is-done", task.kind === "done");
    }
    if (taskProgressEl) taskProgressEl.style.width = pct + "%";
    if (taskCountEl) {
      taskCountEl.textContent = task.kind === "doc" ? eaten + " / " + task.goal + " 条"
        : task.kind === "done" ? (docTask.completed || 0) + " / " + (docTask.total || 0) + " 段"
          : "未绑定文档";
    }
    if (taskPercentEl) taskPercentEl.textContent = pct + "%";
    if (hudTaskEl) {
      const kwTotal = task.keywords ? task.keywords.length : 0;
      const kwDone = Math.min(GAME.keywordCollected.length, kwTotal);
      hudTaskEl.textContent = task.kind === "doc"
        ? "第 " + docTask.seq + " 段" + (kwTotal
          ? " · 关键词 " + kwDone + "/" + kwTotal
          : " · " + eaten + "/" + task.goal)
        : task.kind === "done" ? "自由训练 · 文档已读完" : "自由训练 · 未绑定文档";
    }
    updateGameProgress(task, eaten, pct);
  }

  function updateGameProgress(task, eaten, pct) {
    if (!gameProgressEl) return;
    if (task.kind !== "doc" || document.body.dataset.mode !== "immersive") {
      gameProgressEl.hidden = true;
      return;
    }

    gameProgressEl.hidden = false;
    if (gameProgressLabelEl) {
      gameProgressLabelEl.textContent =
        "第 " + docTask.seq + " 段 · " + eaten + " / " + task.goal + " 条";
    }
    if (gameProgressFillEl) {
      gameProgressFillEl.style.width = pct + "%";
      gameProgressFillEl.classList.toggle("is-full", pct >= 100);
    }
  }

  function readDocTask() {
    try {
      const raw = localStorage.getItem(DOC_TASK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (ignored) {
      return null;
    }
  }

  function saveDocTaskEaten() {
    if (!docTask || docTask.status !== "active") return;
    docTask.eaten = GAME.taskEaten;
    try {
      localStorage.setItem(DOC_TASK_KEY, JSON.stringify(docTask));
    } catch (ignored) {
      // 隐私模式或存储已满时忽略，任务仍可继续推进
    }
  }

  function applyDocTask(data) {
    if (!data || typeof data.status !== "string") {
      docTask = null;
      docTaskDocumentId = "";
      docTaskSeq = 0;
      GAME.taskEaten = 0;
      updateTaskUI();
      return;
    }

    const sameTask = data.status === "active"
      && data.documentId === docTaskDocumentId
      && data.seq === docTaskSeq;

    docTask = data;
    docTaskDocumentId = data.documentId || "";
    docTaskSeq = data.seq || 0;

    if (!sameTask) {
      GAME.taskEaten = data.status === "active" ? Math.max(0, Number(data.eaten) || 0) : 0;
      GAME.keywordCollected = data.status === "active"
        ? readKeywordProgress(data.documentId, data.seq)
        : [];
    }
    updateTaskUI();
  }

  function readFragmentState() {
    try {
      const raw = localStorage.getItem(FRAGMENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (ignored) {
      return null;
    }
  }

  function nextPendingFragment() {
    const state = readFragmentState();
    if (!state || !Array.isArray(state.fragments)) return null;
    const collected = new Set(state.collected || []);
    for (let i = 0; i < state.fragments.length; i++) {
      const fragment = state.fragments[i];
      if (!collected.has(fragment.index)) return fragment;
    }
    return null;
  }

  function updateFragmentHud() {
    const state = readFragmentState();
    if (hudFragmentsEl) {
      if (!state || !Array.isArray(state.fragments) || !state.fragments.length) {
        hudFragmentsEl.hidden = true;
      } else {
        hudFragmentsEl.hidden = false;
        hudFragmentsEl.textContent = "碎片 " + (state.collected || []).length + "/" + state.fragments.length;
      }
    }
    renderFragmentDrops(state);
  }

  function renderFragmentDrops(state) {
    if (!gameProgressDropsEl) return;
    if (!state || !Array.isArray(state.fragments) || !state.fragments.length) {
      gameProgressDropsEl.hidden = true;
      gameProgressDropsEl.textContent = "";
      gameProgressDropsEl.dataset.total = "";
      return;
    }

    const total = state.fragments.length;
    if (gameProgressDropsEl.dataset.total !== String(total)) {
      gameProgressDropsEl.textContent = "";
      for (let i = 0; i < total; i++) {
        const drop = document.createElement("i");
        drop.className = "game-drop";
        drop.setAttribute("aria-hidden", "true");
        gameProgressDropsEl.appendChild(drop);
      }
      gameProgressDropsEl.dataset.total = String(total);
    }

    const collected = new Set(state.collected || []);
    for (let i = 0; i < gameProgressDropsEl.children.length; i++) {
      gameProgressDropsEl.children[i].classList.toggle("is-collected", collected.has(i));
    }
    gameProgressDropsEl.hidden = false;
  }

  function collectFragment(index, title) {
    const state = readFragmentState();
    if (!state || !Array.isArray(state.fragments)) return;
    const collected = new Set(state.collected || []);
    if (collected.has(index)) return;

    collected.add(index);
    state.collected = Array.from(collected).sort(function (a, b) { return a - b; });
    try {
      localStorage.setItem(FRAGMENT_KEY, JSON.stringify(state));
    } catch (ignored) {
      return;
    }

    updateFragmentHud();
    window.dispatchEvent(new CustomEvent("mindflow:fragment-collected", {
      detail: {
        documentId: state.documentId,
        index: index,
        title: title || "",
        total: state.fragments.length,
        collectedCount: state.collected.length
      }
    }));
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
    preloadDecor();
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
    const depth = getDepthProfile(readDaily());
    preloadDepthScene(depth.zone);
    applyDepthScene(depth.zone);
    if (hudEl) hudEl.hidden = false;
    updateHud();
    updateTaskUI();
    updateFragmentHud();
    updateAim();
  }

  function exitImmersive() {
    bgmStop();
    document.body.dataset.mode = "";
    if (hudEl) hudEl.hidden = true;
    if (gameProgressEl) gameProgressEl.hidden = true;
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
      GAME.tide.nextAt = 0;
      GAME.sequence.nextAt = 0;
      GAME.events = buildEventPlan(GAME.roundStart);
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
    GAME.tide.nextAt = 0;
    GAME.sequence.nextAt = 0;
    GAME.events = buildEventPlan(GAME.roundStart);
  }

  function faceTrigger() {
    if (GAME.state === "idle") {
      startGame();
      return;
    }
    if (GAME.state !== "playing") return;
    // 张嘴瞬间只判一次水母，吸气窗口内漂过不重复扣
    checkJellyHit();
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
      const task = currentTask();
      return {
        kind: task.kind,
        title: task.title,
        eaten: GAME.taskEaten,
        goal: task.goal,
        done: GAME.completedTasks
      };
    },
    guide: function () {
      const elapsed = GAME.roundStart ? performance.now() - GAME.roundStart : 0;
      const phase = currentPhase(elapsed);
const target = GAME.activeFish || GAME.pendingGuide;
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
    },
    decor: function () {
      return {
        jellies: GAME.jellies.map(function (jelly) {
          return { x: Math.round(jelly.drawX), y: Math.round(jelly.y), w: jelly.w, hit: jelly.hit };
        }),
        decoys: GAME.fishes.filter(function (fish) {
          return fish.type === "decoy" && !fish.eaten;
        }).length,
        combo: GAME.combo,
        score: GAME.score,
        aim: { x: Math.round(GAME.aimDrawX), y: Math.round(GAME.aimDrawY) }
      };
    },
    tide: function () {
      return {
        active: GAME.tide.active,
        nextAt: Math.round(GAME.tide.nextAt || 0),
        until: Math.round(GAME.tide.until || 0)
      };
    },
    sequence: function () {
      return {
        active: GAME.sequence.active,
        index: GAME.sequence.index,
        steps: GAME.sequence.steps.map(sequenceLabel),
        nextAt: Math.round(GAME.sequence.nextAt || 0)
      };
    },
    events: function () {
      return GAME.events.map(function (event) {
        return { type: event.type, at: Math.round(event.at) };
      });
    },
    ribbon: function () {
      return {
        active: GAME.ribbon.active,
        match: GAME.ribbon.match,
        until: Math.round(GAME.ribbon.until || 0)
      };
    }
  };

  applyDocTask(readDocTask());
  updateFragmentHud();
  updateTodayStatus();
  window.addEventListener("mindflow:doc-task", function (event) {
    applyDocTask(event.detail);
  });
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
  window.setTimeout(warmupGameAssets, 1400);

  if (window.LiquidGlass) {
    [".sidebar", ".interaction", ".card", ".monitor", ".dock"].forEach(function (selector) {
      window.LiquidGlass.autoAttach(selector, { strength: 0.3, blur: 3.5 });
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