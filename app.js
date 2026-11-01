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

  window.addEventListener("resize", resize);

  window.addEventListener("pointermove", function (event) {
    pointer.tx = (event.clientX / window.innerWidth - 0.5) * 22;
    pointer.ty = (event.clientY / window.innerHeight - 0.5) * 16;
  });

  window.addEventListener("pointerdown", function (event) {
    spawnBubbles(event.clientX, event.clientY);
  });

  resize();
  measureStage();

  if (window.LiquidGlass) {
    [
      [".sidebar", { radius: 20, strength: 0.2, blur: 2.5 }],
      [".doc-picker", { radius: 16, strength: 0.24, blur: 2 }],
      [".status-pill", { radius: 18, strength: 0.26, blur: 2 }],
      [".interaction", { radius: 34, strength: 0.22, blur: 2.5 }],
      [".card", { radius: 20, strength: 0.22, blur: 3 }],
      [".dock", { radius: 20, strength: 0.2, blur: 3 }]
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