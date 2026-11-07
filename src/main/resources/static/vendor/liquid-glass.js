/*
 * Liquid Glass adapter (MIT License)
 * Upstream: https://github.com/shuding/liquid-glass
 * Copyright (c) 2025 Shu Ding
 *
 * The upstream Shader engine renders a per-pixel SVG displacement map and
 * samples the page background through feDisplacementMap. This file keeps that
 * engine but lets it mount on any existing UI element, and adds a real
 * background-capture layer so the refraction is visible in Chromium too
 * (Chromium ignores `backdrop-filter: url(#filter)`).
 */
(function () {
  'use strict';

  if (window.LiquidGlass) return;

  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;
  var registry = new Map();
  var resizeTimer = 0;
  var MAX_SAMPLE = 560;

  function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function roundedRectSDF(x, y, halfW, halfH, radius) {
    var qx = Math.abs(x) - halfW;
    var qy = Math.abs(y) - halfH;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }

  function readRadius(el, fallback) {
    var styles = window.getComputedStyle(el);
    var value = parseFloat(styles.borderTopLeftRadius);
    if (!isFinite(value)) return fallback;
    var rect = el.getBoundingClientRect();
    var limit = Math.min(rect.width, rect.height) / 2;
    return Math.max(0, Math.min(value, limit));
  }

  function buildMap(w, h, radius, strength, options) {
    var opts = options || {};
    var scale = Math.min(1, MAX_SAMPLE / Math.max(w, h));
    var sw = Math.max(24, Math.round(w * scale));
    var sh = Math.max(24, Math.round(h * scale));

    var canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    var ctx = canvas.getContext('2d');
    var imageData = ctx.createImageData(sw, sh);
    var data = imageData.data;

    var hw = sw / 2;
    var hh = sh / 2;
    var r = Math.max(0, Math.min(radius * scale, hw, hh));

    // 超椭圆指数：2 为纯椭圆，越大越接近直角矩形。3.6 是 squircle 观感
    var expo = opts.expo || 3.6;
    // 剖面柔和度：越大，折射越集中在边缘、内部越清透
    var gamma = opts.gamma || 1.75;

    // 归一化尺度：扣掉圆角，让等值线在拐角处自然收拢
    var innerX = Math.max(0.5, hw - r * 0.55);
    var innerY = Math.max(0.5, hh - r * 0.55);

    var dxs = new Float32Array(sw * sh);
    var dys = new Float32Array(sw * sh);
    var max = 0.0001;

    for (var y = 0; y < sh; y++) {
      var py = y + 0.5 - hh;
      for (var x = 0; x < sw; x++) {
        var px = x + 0.5 - hw;

        // 超椭圆半径：中心为 0，直边中点约 1，拐角处大于 1
        var ax = Math.abs(px) / innerX;
        var ay = Math.abs(py) / innerY;
        var q = Math.pow(Math.pow(ax, expo) + Math.pow(ay, expo), 1 / expo);
        var t = Math.min(1, q);

        // 连续透镜剖面：两端导数为 0，等值线圆润 -> 不再出现直线折痕
        var lens = Math.pow(smoothStep(0, 1, t), gamma);
        var k = 1 - strength * lens;

        var dx = hw + px * k - (x + 0.5);
        var dy = hh + py * k - (y + 0.5);
        var idx = y * sw + x;
        dxs[idx] = dx;
        dys[idx] = dy;
        if (Math.abs(dx) > max) max = Math.abs(dx);
        if (Math.abs(dy) > max) max = Math.abs(dy);
      }
    }

    var norm = 0.5 / max;
    for (var i = 0; i < sw * sh; i++) {
      var o = i * 4;
      data[o] = Math.round((dxs[i] * norm + 0.5) * 255);
      data[o + 1] = Math.round((dys[i] * norm + 0.5) * 255);
      data[o + 2] = 128;
      data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // 采样空间 -> 显示空间的换算，避免大元素位移被削弱
    var displayScale = Math.min(260, (max * 2) / scale);
    return { url: canvas.toDataURL('image/png'), scale: displayScale, sampleScale: scale };
  }

  function layoutOffset(el) {
    var x = 0;
    var y = 0;
    var node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      x += node.offsetLeft || 0;
      y += node.offsetTop || 0;
      node = node.offsetParent;
    }
    return { x: x, y: y };
  }

  function ensureScene(el, id) {
    var wrap = el.querySelector(':scope > .lg-refract');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'lg-refract';
      wrap.setAttribute('aria-hidden', 'true');
      el.insertBefore(wrap, el.firstChild);
    }

    var scene = wrap.querySelector('.lg-refract__scene');
    if (!scene) {
      scene = document.createElement('div');
      scene.className = 'lg-refract__scene';
      wrap.appendChild(scene);
    }

    var pos = layoutOffset(el);
    scene.style.left = -pos.x + 'px';
    scene.style.top = -pos.y + 'px';
    scene.style.width = window.innerWidth + 'px';
    scene.style.height = window.innerHeight + 'px';
    scene.style.filter = 'url(#' + id + ') blur(0.75px)';

    return wrap;
  }

  function detach(el) {
    var record = registry.get(el);
    if (!record) return;
    if (record.svg && record.svg.parentNode) record.svg.parentNode.removeChild(record.svg);
    var wrap = el.querySelector(':scope > .lg-refract');
    if (wrap) wrap.parentNode.removeChild(wrap);
    el.style.backdropFilter = '';
    el.style.webkitBackdropFilter = '';
    el.classList.remove('liquid');
    registry.delete(el);
  }

  function attach(el, options) {
    if (!el || !el.isConnected) return null;
    var opts = options || {};
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    if (w < 12 || h < 12) return null;

    detach(el);

    var radius = opts.radius != null && opts.radius !== 'auto' ? opts.radius : readRadius(el, 18);
    var strength = opts.strength != null ? opts.strength : 0.28;
    var blur = opts.blur != null ? opts.blur : 3;
    var tint = opts.tint != null ? opts.tint : 0.82;
    var refract = opts.refract !== false;

    var map = buildMap(w, h, radius, strength, opts);
    var id = 'liquid-glass-' + ++uid;

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;';

    var defs = document.createElementNS(NS, 'defs');
    var filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', String(w));
    filter.setAttribute('height', String(h));

    var feImage = document.createElementNS(NS, 'feImage');
    feImage.setAttribute('id', id + '-map');
    feImage.setAttribute('href', map.url);
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');
    feImage.setAttribute('width', String(w));
    feImage.setAttribute('height', String(h));
    feImage.setAttribute('preserveAspectRatio', 'none');

    var displacement = document.createElementNS(NS, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', id + '-map');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    displacement.setAttribute('scale', String(map.scale));

    filter.appendChild(feImage);
    filter.appendChild(displacement);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);

    el.classList.add('liquid');
    el.style.setProperty('--liquid-blur', blur + 'px');
    el.style.setProperty('--liquid-radius', radius + 'px');
    el.style.setProperty('--liquid-tint', String(tint));
    el.style.backdropFilter = 'blur(' + blur + 'px)';
    el.style.webkitBackdropFilter = 'blur(' + blur + 'px)';
    el.style.backdropFilter = 'url(#' + id + ') blur(' + blur + 'px)';
    el.style.webkitBackdropFilter = 'url(#' + id + ') blur(' + blur + 'px)';

    var wrap = refract ? ensureScene(el, id) : null;
    if (wrap) {
      wrap.style.setProperty('--liquid-tint', String(tint));
      wrap.style.setProperty('--liquid-radius', radius + 'px');
    }

    registry.set(el, { svg: svg, options: opts });
    return { id: id, svg: svg };
  }

  var specs = [];

  function refresh() {
    var known = [];
    registry.forEach(function (record, el) {
      known.push({ el: el, options: record.options });
    });
    known.forEach(function (item) {
      detach(item.el);
    });

    var covered = new Set();
    specs.forEach(function (spec) {
      var nodes = document.querySelectorAll(spec.selector);
      for (var i = 0; i < nodes.length; i++) {
        covered.add(nodes[i]);
        attach(nodes[i], spec.options);
      }
    });

    known.forEach(function (item) {
      if (!covered.has(item.el) && item.el.isConnected) attach(item.el, item.options);
    });
  }

  function autoAttach(selector, options) {
    specs.push({ selector: selector, options: options });
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) attach(nodes[i], options);
    return nodes.length;
  }

  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, 260);
  });

  if (window.ResizeObserver) {
    var observer = new ResizeObserver(function (entries) {
      var changed = false;
      entries.forEach(function (entry) {
        if (registry.has(entry.target)) changed = true;
      });
      if (changed) {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(refresh, 220);
      }
    });
    var originalAttach = attach;
    attach = function (el, options) {
      var result = originalAttach(el, options);
      if (result) observer.observe(el);
      return result;
    };
  }

  window.LiquidGlass = {
    attach: attach,
    detach: detach,
    refresh: refresh,
    autoAttach: autoAttach,
    version: 'upstream-shuding/liquid-glass'
  };
})();