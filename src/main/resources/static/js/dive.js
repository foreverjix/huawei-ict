(function () {
  "use strict";

  if (!window.THREE || window.MindFlowDive) return;

  var DURATION = 2400;
  var FADE_OUT = 600;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = null;
  var renderer = null;
  var scene = null;
  var camera = null;
  var glowTex = null;
  var bubbleGroups = [];
  var columns = [];
  var raf = 0;
  var startTime = 0;
  var lastTime = 0;
  var resolvePlay = null;
  var active = false;
  var time = 0;

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(230,250,255,1)");
    g.addColorStop(0.28, "rgba(160,232,255,0.62)");
    g.addColorStop(0.62, "rgba(80,180,230,0.18)");
    g.addColorStop(1, "rgba(20,80,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function createBubbleGroup(count, size, opacity, vmin, vmax) {
    var positions = new Float32Array(count * 3);
    var baseX = new Float32Array(count);
    var speeds = new Float32Array(count);
    var phases = new Float32Array(count);
    var amps = new Float32Array(count);

    for (var i = 0; i < count; i++) {
      baseX[i] = (Math.random() - 0.5) * 1900;
      positions[i * 3] = baseX[i];
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      positions[i * 3 + 2] = -Math.random() * 2100 - 60;
      speeds[i] = vmin + Math.random() * (vmax - vmin);
      phases[i] = Math.random() * Math.PI * 2;
      amps[i] = 8 + Math.random() * 26;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    var mat = new THREE.PointsMaterial({
      size: size,
      map: glowTex,
      color: 0xd8f4ff,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    var points = new THREE.Points(geo, mat);
    points.userData = {
      baseX: baseX,
      speeds: speeds,
      phases: phases,
      amps: amps,
      count: count
    };
    scene.add(points);
    return points;
  }

  function build() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04121e, 0.0011);

    camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / Math.max(1, window.innerHeight),
      1,
      3400
    );
    camera.position.set(0, 20, 0);

    glowTex = makeGlowTexture();

    // 大泡：少而亮，负责近景掠过
    bubbleGroups.push(createBubbleGroup(130, 17, 0.55, 26, 68));
    // 小泡：多而淡，负责纵深体积
    bubbleGroups.push(createBubbleGroup(760, 4.5, 0.3, 10, 38));

    // 顶部斜射的光柱，随相机前进产生视差
    for (var i = 0; i < 5; i++) {
      var w = 90 + Math.random() * 150;
      var h = 1300 + Math.random() * 700;
      var column = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: 0x8ee2ff,
          transparent: true,
          opacity: 0.05 + Math.random() * 0.055,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      column.position.set((Math.random() - 0.5) * 1700, 220, -780 - Math.random() * 1500);
      column.rotation.x = -0.3 - Math.random() * 0.12;
      column.rotation.z = (Math.random() - 0.5) * 0.14;
      column.userData = {
        baseX: column.position.x,
        sway: 18 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2
      };
      scene.add(column);
      columns.push(column);
    }
  }

  function dispose() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    bubbleGroups.forEach(function (points) {
      if (points.geometry) points.geometry.dispose();
      if (points.material) points.material.dispose();
    });
    bubbleGroups = [];
    columns.forEach(function (mesh) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    columns = [];
    if (glowTex) {
      glowTex.dispose();
      glowTex = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    active = false;
  }

  function tick() {
    var now = performance.now();
    var elapsed = now - startTime;
    var dt = Math.min(0.05, (now - lastTime) / 1000) || 0.016;
    lastTime = now;
    time += dt;

    var p = Math.min(1, elapsed / DURATION);
    var eased = 1 - Math.pow(1 - p, 2.4);   // 先快后慢，像真正停下来
    var surge = Math.sin(Math.min(1, p * 1.15) * Math.PI);  // 中段最快

    bubbleGroups.forEach(function (points) {
      var data = points.userData;
      var attr = points.geometry.getAttribute("position");
      var arr = attr.array;

      for (var i = 0; i < data.count; i++) {
        var i3 = i * 3;
        arr[i3] = data.baseX[i] + Math.sin(time * 0.7 + data.phases[i]) * data.amps[i];
        arr[i3 + 1] += data.speeds[i] * dt * (1 + surge * 0.9);
        arr[i3 + 2] += 16 * dt;

        if (arr[i3 + 1] > 820) {
          arr[i3 + 1] = -820;
          data.baseX[i] = (Math.random() - 0.5) * 1900;
        }
        if (arr[i3 + 2] > 220) {
          arr[i3 + 2] = -2280;
          arr[i3 + 1] = (Math.random() - 0.5) * 1500;
          data.baseX[i] = (Math.random() - 0.5) * 1900;
        }
      }
      attr.needsUpdate = true;

    });

    for (var c = 0; c < columns.length; c++) {
      var column = columns[c];
      column.position.x =
        column.userData.baseX + Math.sin(time * 0.35 + column.userData.phase) * column.userData.sway;
    }

    // 相机缓慢前推 + 轻微俯冲，落定时几乎静止
    camera.position.z = -eased * 420;
    camera.position.y = 20 + eased * 70;
    camera.position.x = Math.sin(time * 0.5) * 14;
    camera.rotation.x = -0.015 + eased * 0.02;
    camera.rotation.z = Math.sin(eased * Math.PI * 1.4) * 0.018;

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    if (elapsed >= DURATION) {
      if (canvas) {
        canvas.classList.remove("is-on");
        canvas.classList.add("is-off");
      }
      raf = 0;
      var done = resolvePlay;
      resolvePlay = null;
      window.setTimeout(function () {
        dispose();
        if (done) done();
      }, FADE_OUT);
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  function play() {
    return new Promise(function (resolve) {
      if (reduced || active) {
        resolve();
        return;
      }

      active = true;
      resolvePlay = resolve;
      time = 0;

      canvas = document.createElement("canvas");
      canvas.className = "dive-canvas";
      document.body.appendChild(canvas);

      build();

      startTime = performance.now();
      lastTime = startTime;

      window.requestAnimationFrame(function () {
        if (canvas) canvas.classList.add("is-on");
      });

      raf = requestAnimationFrame(tick);
    });
  }

  window.addEventListener("resize", function () {
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  });

  window.MindFlowDive = {
    play: play,
    get active() {
      return active;
    }
  };
})();