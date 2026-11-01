(function () {
  'use strict';

  var canvas = document.getElementById('water-light');
  if (!canvas || !window.THREE) return;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) }
  };

  var vertexShader = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'precision highp float;',
    'uniform float uTime;',
    'uniform vec2 uRes;',
    'varying vec2 vUv;',

    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',

    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',

    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * noise(p);',
    '    p *= 2.03;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',

    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 p = uv;',
    '  p.x *= uRes.x / max(uRes.y, 1.0);',

    '  float shade = 0.0;',
    '  for (int i = 0; i < 5; i++) {',
    '    float fi = float(i);',
    '    float base = 0.18 + fi * 0.2;',
    '    float sway = sin(uTime * 0.16 + fi * 1.9) * 0.05 + sin(uTime * 0.06 + fi * 0.7) * 0.02;',
    '    float slant = (1.0 - uv.y) * 0.5;',
    '    float axis = base + sway + slant;',
    '    float d = abs(p.x - axis);',
    '    float width = 0.04 + 0.018 * sin(uTime * 0.22 + fi * 2.1);',
    '    float beam = smoothstep(width, 0.0, d);',
    '    beam *= 0.55 + 0.45 * fbm(vec2(p.x * 5.5 + fi, p.y * 2.4 - uTime * 0.07));',
    '    shade += beam;',
    '  }',

    '  float topFade = smoothstep(0.02, 1.0, uv.y);',
    '  float bottomFade = smoothstep(0.0, 0.3, uv.y);',
    '  float surface = smoothstep(0.62, 1.0, uv.y) * (0.55 + 0.45 * sin(uTime * 0.5 + p.x * 14.0));',
    '  float alpha = (shade * topFade * 0.4 + surface * 0.16) * bottomFade;',

    '  vec3 cold = vec3(0.32, 0.74, 1.0);',
    '  vec3 warm = vec3(0.9, 0.98, 1.0);',
    '  vec3 col = mix(cold, warm, clamp(shade, 0.0, 1.0));',
    '  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));',
    '}'
  ].join('\n');

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  var visible = true;

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  }

  function update(time) {
    if (!visible) return;
    uniforms.uTime.value = time * 0.001;
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();

  window.MindFlowLight = { update: update, resize: resize };
})();