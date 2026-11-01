/*
 * Liquid Glass (MIT License)
 * Based on shuding/liquid-glass — https://github.com/shuding/liquid-glass
 * Copyright (c) 2025 Shu Ding
 * Modified to attach SVG displacement glass to arbitrary UI elements.
 */
(function () {
  'use strict';

  if (window.LiquidGlass) return;

  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;
  var registry = new Map();
  var resizeTimer = 0;

  function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function roundedRectSDF(x, y, halfW, halfH, radius) {
    var qx = Math.abs(x) - halfW;
    var qy = Math.abs(y) - halfH;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }

  function buildMap(w, h, radius, strength) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    var imageData = ctx.createImageData(w, h);
    var data = imageData.data;

    var hw = w / 2;
    var hh = h / 2;
    var r = Math.max(0, Math.min(radius, hw - 0.5, hh - 0.5));
    var innerW = Math.max(0.5, hw - r);
    var innerH = Math.max(0.5, hh - r);
    var band = Math.max(6, Math.min(w, h) * 0.22);

    var dxs = new Float32Array(w * h);
    var dys = new Float32Array(w * h);
    var max = 0.0001;

    for (var y = 0; y < h; y++) {
      var py = y + 0.5 - hh;
      for (var x = 0; x < w; x++) {
        var px = x + 0.5 - hw;
        var d = roundedRectSDF(px, py, innerW, innerH, r);
        var edge = 1 - smoothStep(-band, 0, d);
        var k = 1 - strength * edge;
        var dx = hw + px * k - (x + 0.5);
        var dy = hh + py * k - (y + 0.5);
        var idx = y * w + x;
        dxs[idx] = dx;
        dys[idx] = dy;
        if (Math.abs(dx) > max) max = Math.abs(dx);
        if (Math.abs(dy) > max) max = Math.abs(dy);
      }
    }

    var norm = 0.5 / max;
    for (var i = 0; i < w * h; i++) {
      var o = i * 4;
      data[o] = Math.round((dxs[i] * norm + 0.5) * 255);
      data[o + 1] = Math.round((dys[i] * norm + 0.5) * 255);
      data[o + 2] = 128;
      data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    return { url: canvas.toDataURL('image/png'), scale: max * 2 };
  }

  function detach(el) {
    var record = registry.get(el);
    if (!record) return;
    record.svg.remove();
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

    var radius = opts.radius != null ? opts.radius : 18;
    var strength = opts.strength != null ? opts.strength : 0.16;
    var blur = opts.blur != null ? opts.blur : 3;

    var map = buildMap(w, h, radius, strength);
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
    el.style.backdropFilter = 'blur(' + blur + 'px) saturate(1.2)';
    el.style.webkitBackdropFilter = 'blur(' + blur + 'px) saturate(1.2)';
    el.style.backdropFilter = 'url(#' + id + ') blur(' + blur + 'px) saturate(1.28) brightness(1.04)';
    el.style.webkitBackdropFilter = 'url(#' + id + ') blur(' + blur + 'px) saturate(1.28) brightness(1.04)';

    registry.set(el, { svg: svg, options: opts });
    return { id: id, svg: svg };
  }

  function refresh() {
    var items = [];
    registry.forEach(function (record, el) {
      items.push({ el: el, options: record.options });
    });
    items.forEach(function (item) {
      detach(item.el);
      attach(item.el, item.options);
    });
  }

  function autoAttach(selector, options) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) attach(nodes[i], options);
    return nodes.length;
  }

  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, 320);
  });

  window.LiquidGlass = {
    attach: attach,
    detach: detach,
    refresh: refresh,
    autoAttach: autoAttach
  };
})();