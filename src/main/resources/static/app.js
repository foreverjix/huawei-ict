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
  const hudTaskEl = document.getElementById("hud-task");
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
    completedTasks: 0
  };

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

  function createGameFish() {
    if (!fishStage || !stageBox.w || GAME.fishes.length >= GAME.maxFish) return;

    // 金色任务鱼为主，蓝色缓冲鱼穿插，保证任务推进但不会太单调
    const type = Math.random() < 0.72 ? "task" : "rest";

    const w = Math.round(clamp(stageBox.w * (0.07 + Math.random() * 0.07), 64, 190));
    const h = Math.round(w * 0.735);
    const speed = 26 + Math.random() * 44;

    // 随机航向：以水平为主，允许上下 ±32° 的斜向，避免鱼竖直游动
    const heading = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.12;
    const vx = Math.cos(heading) * speed;
    const vy = Math.sin(heading) * speed;

    // 先取舞台内一个随机目标点，再从目标点反向退出生点，
    // 这样鱼可能从上/下/斜角任何方向进入，且一定会穿过游戏区
    const targetX = stageBox.w * (0.12 + Math.random() * 0.76);
    const targetY = stageBox.h * (0.12 + Math.random() * 0.76);

    // 从目标点朝航向的反方向走到画面边界外，确保出生点贴着边缘、不会在屏幕外跑太久
    const backX = -Math.cos(heading);
    const backY = -Math.sin(heading);
    let exit = Infinity;
    if (backX > 0.001) exit = Math.min(exit, (stageBox.w - targetX) / backX);
    if (backX < -0.001) exit = Math.min(exit, (0 - targetX) / backX);
    if (backY > 0.001) exit = Math.min(exit, (stageBox.h - targetY) / backY);
    if (backY < -0.001) exit = Math.min(exit, (0 - targetY) / backY);
    if (!isFinite(exit) || exit < 0) exit = 80;

    const startX = targetX + backX * (exit + 90);
    const startY = targetY + backY * (exit + 90);

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
      entered: false,
      swayAmp: 6 + Math.random() * 14,
      swayW: 0.8 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      framePos: Math.random() * FRAME_COUNT,
      fps: FRAME_FPS,
      ready: false,
      eaten: false
    };

    wrap.style.setProperty("--dir", fish.vx >= 0 ? "1" : "-1");

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

  function updateGame(time, dt) {
    for (let i = GAME.fishes.length - 1; i >= 0; i--) {
      const fish = GAME.fishes[i];
      if (fish.eaten) continue;

      fish.x += fish.vx * (dt / 1000);
      fish.y += fish.vy * (dt / 1000);
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
        fish.x < -fish.w - 140 ||
        fish.x > stageBox.w + 140 ||
        fish.y < -fish.h - 140 ||
        fish.y > stageBox.h + 140
      ) {
        if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
        GAME.fishes.splice(i, 1);
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

    GAME.spawnTimer -= dt;
    if (GAME.spawnTimer <= 0) {
      createGameFish();
      GAME.spawnTimer = 1000 + Math.random() * 1000;
    }
  }

  function eatOne(fish) {
    if (fish.eaten) return;
    fish.eaten = true;

    // 分值取决于鱼离画面中心多远：边角鱼 ×3，中环 ×2，中心 ×1
    GAME.score += fishValue(fish);

    // 只有金色任务鱼推进任务进度，蓝色缓冲鱼只是休息
    if (fish.type === "task") {
      advanceTask(fish);
    }

    fish.locked = false;
    fish.el.classList.remove("is-locked");
    fish.el.classList.add("is-eaten");

    const rect = stage.getBoundingClientRect();
    spawnBubbles(rect.left + fish.x + fish.w / 2, rect.top + fish.y + fish.h / 2);

    window.setTimeout(function () {
      if (fish.el.parentNode) fish.el.parentNode.removeChild(fish.el);
    }, 420);

    const index = GAME.fishes.indexOf(fish);
    if (index >= 0) GAME.fishes.splice(index, 1);
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

    let hintText;
    if (!usePose) {
      hintText = "移动鼠标控制位置 · 按住空格可连续吸鱼";
    } else if (!fresh) {
      hintText = "面部暂时丢失 · 准星保持在原位，请回正";
    } else {
      hintText = "上下左右晃动头部 · 张嘴一次即可连续吸鱼";
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

    GAME.fishes.forEach(function (fish) {
      const dx = fish.x + fish.w / 2 - GAME.aimDrawX;
      const dy = fish.y + fish.h / 2 - GAME.aimDrawY;
      const hit = Math.hypot(dx, dy) <= GAME.lockRadius;

      if (hit !== fish.locked) {
        fish.locked = hit;
        fish.el.classList.toggle("is-locked", hit);
      }
      if (hit) {
        fish.lockedAt = now;
        anyLocked = true;
      }
    });

    aimEl.classList.toggle("is-locked", anyLocked);
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

  function advanceTask(fish) {
    const task = TASKS[GAME.taskIndex];
    GAME.taskEaten += fishValue(fish);

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

    document.body.dataset.mode = "immersive";
    if (hudEl) hudEl.hidden = false;
    updateHud();
    updateTaskUI();
    updateAim();
  }

  function exitImmersive() {
    document.body.dataset.mode = "";
    if (hudEl) hudEl.hidden = true;
    if (aimEl) aimEl.classList.remove("is-locked", "is-bite");

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
    GAME.spawnTimer = 160;
    GAME.introUntil = 0;
    if (interactionEl) interactionEl.dataset.state = "playing";
    // 开局前切回首页，避免在演示页上进入沉浸态
    setView("home");
    enterImmersive();
    updateInteractionText();

    const dive = window.MindFlowDive && window.MindFlowDive.play ? window.MindFlowDive.play() : null;
    if (dive) {
      GAME.introUntil = performance.now() + 2600;
      dive.then(function () {
        GAME.introUntil = 0;
      }).catch(function () {
        GAME.introUntil = 0;
        createGameFish();
      });
    } else {
      createGameFish();
    }
  }

  function faceTrigger() {
    if (GAME.state === "idle") {
      startGame();
      return;
    }
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
    } else {
      strong.textContent = "张嘴一下，开始互动";
      small.textContent = "或使用空格键确认";
    }
  }

  if (interactionEl) {
    interactionEl.addEventListener("click", function () {
      faceTrigger();
    });
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
    if (event.code === "Escape" && GAME.state === "playing") {
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

  window.addEventListener("mindflow:mouth", function () {
    const now = performance.now();
    if (now - GAME.lastMouthAt < 320) return;
    GAME.lastMouthAt = now;
    faceTrigger();
  });

  window.MindFlowGame = {
    trigger: faceTrigger,
    task: function () {
      return {
        index: GAME.taskIndex,
        eaten: GAME.taskEaten,
        goal: TASKS[GAME.taskIndex].goal,
        done: GAME.completedTasks
      };
    },
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