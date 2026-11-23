// Palkon Auto renderer: handwritten WebGL 2, no engine, no vendored library.
// One standard program draws the merged city (facades, roofs, ground, trees,
// props, lamps); a water program draws the bay, sea and canal; a sky program
// draws the dome, sun, moon and stars. A 2048 shadow map from the sun (or
// the moon at night) gives the city real shadows.
import { makeFacadeTextures, makeGroundTexture } from './textures.js';
import { presetByName } from './lighting.js';

// ---- small column-major mat4 helpers (no library) ----
function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far);
  o[11] = -1; o[14] = (2 * far * near) / (near - far);
  return o;
}
function mat4Ortho(l, r, b, t, n, f) {
  const o = new Float32Array(16);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  o[15] = 1;
  return o;
}
function mat4LookAt(eye, center, up) {
  const zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz); const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  // y = z cross x (the camera's true up, orthogonal to both).
  const yx = z[1] * xz - z[2] * xy, yy = z[2] * xx - z[0] * xz, yz = z[0] * xy - z[1] * xx;
  // The view matrix has the basis vectors as its ROWS (column-major
  // storage: row 0 sits at indices 0, 4, 8, 12), so a world point maps to
  // view space by dotting it with each axis. Storing the axes as columns
  // builds the camera transform instead, and the view comes out transposed.
  const o = mat4Identity();
  o[0] = xx; o[1] = yx; o[2] = z[0];
  o[4] = xy; o[5] = yy; o[6] = z[1];
  o[8] = xz; o[9] = yz; o[10] = z[2];
  o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  o[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  return o;
}
function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---- mesh builder: accumulate boxes, cylinders, cones and planes ----
class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  quad(a, b, c, d, n, uvs) {
    // Two triangles: a-b-c, a-c-d. uvs are [u0,v0,u1,v1] for the quad.
    const [u0, v0, u1, v1] = uvs;
    const vs = [a, b, c, a, c, d];
    const us = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 6; i++) {
      this.pos.push(...vs[i]);
      this.nor.push(...n);
      this.uv.push(...us[i]);
    }
  }
  box(cx, cy, cz, w, h, d, tile) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy, y1 = cy + h;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const us = (len) => [0, 0, len / tile, h / tile];
    // +x, -x, +z, -z faces; the top is handled by the caller elsewhere.
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], us(d));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], us(d));
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], us(w));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], us(w));
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], [0, 0, 1, 1]);
  }
  flatBox(cx, cy, cz, w, h, d) {
    // A box with plain UVs, for untextured props and roofs.
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy, y1 = cy + h;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const u = [0, 0, 1, 1];
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], u);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], u);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], u);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], u);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], u);
  }
  plane(x0, z0, x1, z1, y, u0, v0, u1, v1) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [u0, v0, u1, v1]);
  }
  cylinder(cx, cy, cz, r, h, seg) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r];
      const q0 = [p0[0], cy + h, p0[2]];
      const q1 = [p1[0], cy + h, p1[2]];
      const n0 = [Math.cos(a0), 0, Math.sin(a0)];
      const n1 = [Math.cos(a1), 0, Math.sin(a1)];
      this.tri(p0, p1, q1, n0, n1, n1);
      this.tri(p0, q1, q0, n0, n1, n0);
    }
  }
  cone(cx, cy, cz, r, h, seg) {
    const apex = [cx, cy + h, cz];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r];
      const n = normalize3([Math.cos((a0 + a1) / 2), 0.5, Math.sin((a0 + a1) / 2)]);
      this.tri(p0, p1, apex, n, n, n);
    }
  }
  tri(a, b, c, na, nb, nc) {
    this.pos.push(...a, ...b, ...c);
    this.nor.push(...na, ...nb, ...nc);
    this.uv.push(0, 0, 1, 0, 0.5, 1);
  }
  build(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const upload = (data, loc, size) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    upload(this.pos, 0, 3);
    upload(this.nor, 1, 3);
    upload(this.uv, 2, 2);
    gl.bindVertexArray(null);
    return { vao, count: this.pos.length / 3 };
  }
}

const STANDARD_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
uniform mat4 uProj, uView, uLight;
out vec3 vNormal; out vec3 vWorld; out vec2 vUV; out vec4 vLightPos;
void main() {
  vec4 world = vec4(aPos, 1.0);
  vWorld = aPos; vNormal = aNormal; vUV = aUV;
  vLightPos = uLight * world;
  gl_Position = uProj * uView * world;
}`;

const STANDARD_FRAG = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vWorld; in vec2 vUV; in vec4 vLightPos;
uniform sampler2D uDiffuse; uniform sampler2D uEmissive;
uniform vec3 uTint; uniform vec3 uEmissiveTint;
uniform vec3 uSunColor; uniform vec3 uSunDir; uniform vec3 uAmbient;
uniform vec3 uFogColor; uniform float uFogDensity;
uniform float uUseTexture; uniform float uWindowGlow; uniform float uShininess;
uniform sampler2D uShadow; uniform float uUseShadow;
uniform vec3 uCamPos;
out vec4 fragColor;
void main() {
  vec3 base = uTint;
  if (uUseTexture > 0.5) base = texture(uDiffuse, vUV).rgb * uTint;
  vec3 n = normalize(vNormal);
  vec3 L = normalize(-uSunDir);
  float diff = max(dot(n, L), 0.0);
  vec3 viewDir = normalize(uCamPos - vWorld);
  vec3 halfDir = normalize(L + viewDir);
  float spec = pow(max(dot(n, halfDir), 0.0), uShininess) * 0.35;
  float shadow = 1.0;
  if (uUseShadow > 0.5) {
    vec3 lp = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
    if (lp.x > 0.0 && lp.x < 1.0 && lp.y > 0.0 && lp.y < 1.0) {
      float depth = texture(uShadow, lp.xy).r;
      shadow = (lp.z - 0.0015 < depth) ? 1.0 : 0.5;
    }
  }
  vec3 color = base * (uAmbient + uSunColor * diff * shadow) + uSunColor * spec * shadow;
  vec3 emissive = uEmissiveTint * uWindowGlow;
  if (uUseTexture > 0.5) emissive += texture(uEmissive, vUV).rgb * uWindowGlow;
  color += emissive;
  float dist = distance(uCamPos, vWorld);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));
  fragColor = vec4(color, 1.0);
}`;

const WATER_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 2) in vec2 aUV;
uniform mat4 uProj, uView;
out vec3 vWorld; out vec2 vUV;
void main() {
  vWorld = aPos; vUV = aUV;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`;

const WATER_FRAG = `#version 300 es
precision highp float;
in vec3 vWorld; in vec2 vUV;
uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uTime; uniform vec3 uCamPos; uniform vec3 uFogColor; uniform float uFogDensity;
out vec4 fragColor;
void main() {
  float w1 = sin(vWorld.x * 0.08 + uTime * 1.1) * cos(vWorld.z * 0.06 + uTime * 0.8);
  float w2 = sin((vWorld.x + vWorld.z) * 0.05 - uTime * 0.6);
  vec3 n = normalize(vec3(w1 * 0.12, 1.0, w2 * 0.12));
  vec3 viewDir = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  vec3 color = mix(uDeep, uSky, 0.25 + fres * 0.6);
  vec3 L = normalize(-uSunDir);
  vec3 halfDir = normalize(L + viewDir);
  float glint = pow(max(dot(n, halfDir), 0.0), 90.0) * 1.4;
  color += uSunColor * glint;
  float dist = distance(uCamPos, vWorld);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));
  fragColor = vec4(color, 0.94);
}`;

const SKY_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uProj, uView;
uniform vec3 uCamPos;
out vec3 vDir;
void main() {
  vDir = aPos;
  vec4 p = uProj * uView * vec4(aPos + uCamPos, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = `#version 300 es
precision highp float;
in vec3 vDir;
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uStars; uniform float uTime;
out vec4 fragColor;
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}
void main() {
  vec3 d = normalize(vDir);
  float t = clamp(d.y * 1.6 + 0.25, 0.0, 1.0);
  vec3 color = mix(uHorizon, uTop, pow(t, 0.8));
  vec3 L = normalize(-uSunDir);
  float sunAmt = max(dot(d, L), 0.0);
  color += uSunColor * (pow(sunAmt, 350.0) * 1.6 + pow(sunAmt, 18.0) * 0.35);
  // Moon: opposite the sun, a pale disc.
  float moonAmt = max(dot(d, -L), 0.0);
  color += vec3(0.85, 0.88, 0.95) * smoothstep(0.9993, 0.9997, moonAmt) * 0.9;
  if (uStars > 0.01 && d.y > 0.05) {
    vec3 cell = floor(d * 220.0);
    float h = hash(cell);
    if (h > 0.997) color += vec3(0.9, 0.92, 1.0) * uStars * (0.5 + 0.5 * sin(uTime * 2.0 + h * 40.0));
  }
  fragColor = vec4(color, 1.0);
}`;

const DEPTH_VERT = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uLight;
void main() { gl_Position = uLight * vec4(aPos, 1.0); }`;

const DEPTH_FRAG = `#version 300 es
precision highp float;
void main() {}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader compile failed: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

function makeTexture(gl, image, srgb) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return t;
}

const TILE = 16;

export function createRenderer(canvas, city) {
  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL 2 is not available in this browser');

  const stdProg = program(gl, STANDARD_VERT, STANDARD_FRAG);
  const waterProg = program(gl, WATER_VERT, WATER_FRAG);
  const skyProg = program(gl, SKY_VERT, SKY_FRAG);
  const depthProg = program(gl, DEPTH_VERT, DEPTH_FRAG);

  const facades = makeFacadeTextures();
  const groundCanvas = makeGroundTexture(city);

  // ---- build the merged meshes ----
  const facadeMeshes = {};
  const roofBuilder = new Builder();
  for (const key of Object.keys(facades)) {
    facadeMeshes[key] = new Builder();
  }
  const groundBuilder = new Builder();
  const waterBuilder = new Builder();
  const trunkBuilder = new Builder();
  const canopyBuilder = new Builder();
  const propBuilder = new Builder();
  const lampPoleBuilder = new Builder();
  const lampHeadBuilder = new Builder();
  const poolBuilder = new Builder();

  const groupFor = (type) => {
    if (type === 'tower') return 'tower';
    if (type === 'glass') return 'glass';
    return type;
  };

  for (const b of city.buildings) {
    const g = facadeMeshes[groupFor(b.type)];
    const fb = new Builder();
    fb.box(b.x, 0, b.z, b.w, b.h, b.d, TILE);
    // box() emits 4 side faces first (24 vertices), then the roof face
    // (6 vertices). Sides go to the facade mesh; the roof to the roof mesh.
    g.pos.push(...fb.pos.slice(0, 72)); g.nor.push(...fb.nor.slice(0, 72)); g.uv.push(...fb.uv.slice(0, 48));
    roofBuilder.pos.push(...fb.pos.slice(72)); roofBuilder.nor.push(...fb.nor.slice(72)); roofBuilder.uv.push(...fb.uv.slice(48));
  }

  groundBuilder.plane(-1920, -1728, 1920, 1728, 0, 0, 0, 1, 1);

  // Water: the bay, the east sea and the canal, slightly above the ground.
  waterBuilder.plane(-1920, -1728, 1920, -1500, 0.6, 0, 0, 8, 1);
  waterBuilder.plane(1760, -1500, 1920, 1728, 0.6, 0, 0, 1, 8);
  waterBuilder.plane(-70, -1728, 70, 1728, 0.6, 0, 0, 1, 12);

  // Bridges: pale decks over the canal with low rails.
  for (const br of [{ z: -900 }, { z: 0 }, { z: 900 }]) {
    propBuilder.flatBox(0, 0.4, br.z, 220, 1.2, 40);
    propBuilder.flatBox(-108, 1.6, br.z, 4, 2.4, 40);
    propBuilder.flatBox(108, 1.6, br.z, 4, 2.4, 40);
  }

  // Marina piers and moored boats.
  for (let k = 0; k < 5; k++) {
    const px = -1000 + k * 260;
    propBuilder.flatBox(px, 0.4, -1575, 16, 1.0, 150);
  }
  for (const boat of city.boats) {
    propBuilder.flatBox(boat.x, 0.6, boat.z, boat.len, 3, 7);
    propBuilder.flatBox(boat.x, 3.4, boat.z, 1.4, 10, 1.4);
  }

  // Trees: trunks and canopies, coloured by kind.
  const canopyColors = { oak: [0.23, 0.42, 0.22], citrus: [0.35, 0.55, 0.25], palm: [0.25, 0.48, 0.28] };
  const canopyByKind = { oak: new Builder(), citrus: new Builder(), palm: new Builder() };
  for (const t of city.trees) {
    const h = t.kind === 'palm' ? 14 * t.s : 8 * t.s;
    trunkBuilder.cylinder(t.x, 0, t.z, 0.7 * t.s, h * 0.55, 6);
    const c = canopyByKind[t.kind];
    c.cone(t.x, h * 0.5, t.z, (t.kind === 'palm' ? 7 : 6) * t.s, h * 0.7, 8);
  }

  // Street lamps: dark poles, warm heads, and a pale pool of light on the
  // ground that only shows at night.
  for (const l of city.lamps) {
    lampPoleBuilder.cylinder(l.x, 0, l.z, 0.25, 9, 6);
    lampHeadBuilder.flatBox(l.x, 9, l.z, 1.6, 1.0, 1.6);
    poolBuilder.plane(l.x - 9, l.z - 9, l.x + 9, l.z + 9, 0.15, 0, 0, 1, 1);
  }

  // Sky dome: a big sphere around the camera.
  const skyBuilder = new Builder();
  {
    const seg = 24, rings = 12, R = 4200;
    for (let r = 0; r < rings; r++) {
      const phi0 = (r / rings) * Math.PI;
      const phi1 = ((r + 1) / rings) * Math.PI;
      for (let s = 0; s < seg; s++) {
        const th0 = (s / seg) * Math.PI * 2;
        const th1 = ((s + 1) / seg) * Math.PI * 2;
        const pt = (phi, th) => [
          R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(th),
        ];
        const a = pt(phi0, th0), b = pt(phi0, th1), c = pt(phi1, th1), d = pt(phi1, th0);
        skyBuilder.quad(a, b, c, d, [0, 0, 0], [0, 0, 1, 1]);
      }
    }
  }

  const meshes = {
    ground: groundBuilder.build(gl),
    roof: roofBuilder.build(gl),
    water: waterBuilder.build(gl),
    trunk: trunkBuilder.build(gl),
    prop: propBuilder.build(gl),
    lampPole: lampPoleBuilder.build(gl),
    lampHead: lampHeadBuilder.build(gl),
    pool: poolBuilder.build(gl),
    sky: skyBuilder.build(gl),
  };
  for (const [key, b] of Object.entries(facadeMeshes)) meshes['facade_' + key] = b.build(gl);
  for (const [kind, b] of Object.entries(canopyByKind)) meshes['canopy_' + kind] = b.build(gl);

  const facadeTex = {};
  for (const [key, pair] of Object.entries(facades)) {
    facadeTex[key] = {
      diffuse: makeTexture(gl, pair.diffuse, true),
      emissive: makeTexture(gl, pair.emissive, false),
    };
  }
  const groundTex = makeTexture(gl, groundCanvas, true);
  const whiteTex = (() => {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    c.getContext('2d').fillStyle = '#ffffff';
    c.getContext('2d').fillRect(0, 0, 1, 1);
    return makeTexture(gl, c, false);
  })();
  // The default emissive map is black: a surface with no lit windows must
  // add no light at night. (A white default made the whole ground glow.)
  const blackTex = (() => {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    c.getContext('2d').fillStyle = '#000000';
    c.getContext('2d').fillRect(0, 0, 1, 1);
    return makeTexture(gl, c, false);
  })();

  // Shadow map: one 2048 depth texture + framebuffer.
  const SHADOW_SIZE = 2048;
  const shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const shadowFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const state = {
    preset: presetByName('day'),
    camPos: [0, 40, 120],
    camTarget: [0, 10, 0],
    time: 0,
  };

  function bindTextureUnit(unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  function drawMesh(prog, mesh, u) {
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  function setStdUniforms(proj, view, lightMatrix, camPos, opts) {
    gl.useProgram(stdProg);
    const set = (name, fn) => {
      const loc = gl.getUniformLocation(stdProg, name);
      if (loc) fn(loc);
    };
    set('uProj', (l) => gl.uniformMatrix4fv(l, false, proj));
    set('uView', (l) => gl.uniformMatrix4fv(l, false, view));
    set('uLight', (l) => gl.uniformMatrix4fv(l, false, lightMatrix));
    set('uCamPos', (l) => gl.uniform3fv(l, camPos));
    set('uSunColor', (l) => gl.uniform3fv(l, state.preset.sunColor));
    set('uSunDir', (l) => gl.uniform3fv(l, state.preset.sunDir));
    set('uAmbient', (l) => gl.uniform3fv(l, state.preset.ambient));
    set('uFogColor', (l) => gl.uniform3fv(l, state.preset.fogColor));
    set('uFogDensity', (l) => gl.uniform1f(l, state.preset.fogDensity));
    set('uWindowGlow', (l) => gl.uniform1f(l, state.preset.windowGlow));
    set('uTint', (l) => gl.uniform3fv(l, opts.tint));
    set('uEmissiveTint', (l) => gl.uniform3fv(l, opts.emissiveTint || [0, 0, 0]));
    set('uUseTexture', (l) => gl.uniform1f(l, opts.useTexture ? 1 : 0));
    set('uShininess', (l) => gl.uniform1f(l, opts.shininess || 8));
    set('uUseShadow', (l) => gl.uniform1f(l, opts.useShadow === false ? 0 : 1));
    bindTextureUnit(0, opts.diffuse || whiteTex);
    bindTextureUnit(1, opts.emissive || blackTex);
    bindTextureUnit(2, shadowTex);
    set('uDiffuse', (l) => gl.uniform1i(l, 0));
    set('uEmissive', (l) => gl.uniform1i(l, 1));
    set('uShadow', (l) => gl.uniform1i(l, 2));
  }

  function renderShadowPass(lightMatrix) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(depthProg);
    const loc = gl.getUniformLocation(depthProg, 'uLight');
    gl.uniformMatrix4fv(loc, false, lightMatrix);
    gl.enable(gl.DEPTH_TEST);
    for (const key of Object.keys(meshes)) {
      if (key === 'water' || key === 'sky' || key === 'pool') continue;
      drawMesh(depthProg, meshes[key]);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function render(now) {
    state.time = now;
    const w = canvas.width, h = canvas.height;
    const aspect = w / h;
    const proj = mat4Perspective((62 * Math.PI) / 180, aspect, 0.5, 9000);
    const view = mat4LookAt(state.camPos, state.camTarget, [0, 1, 0]);
    const p = state.preset;
    const L = normalize3([-p.sunDir[0], -p.sunDir[1], -p.sunDir[2]]);
    const target = state.camTarget;
    const lightEye = [target[0] + L[0] * 1400, target[1] + L[1] * 1400, target[2] + L[2] * 1400];
    const lightView = mat4LookAt(lightEye, target, [0, 1, 0]);
    const lightProj = mat4Ortho(-550, 550, -550, 550, 1, 3200);
    const lightMatrix = mat4Multiply(lightProj, lightView);

    renderShadowPass(lightMatrix);

    gl.viewport(0, 0, w, h);
    gl.clearColor(p.fogColor[0], p.fogColor[1], p.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Sky dome first, depth writes and depth test off.
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(skyProg);
    {
      const set = (name, fn) => { const l = gl.getUniformLocation(skyProg, name); if (l) fn(l); };
      const skyView = mat4LookAt([0, 0, 0], [
        state.camTarget[0] - state.camPos[0],
        state.camTarget[1] - state.camPos[1],
        state.camTarget[2] - state.camPos[2],
      ], [0, 1, 0]);
      set('uProj', (l) => gl.uniformMatrix4fv(l, false, proj));
      set('uView', (l) => gl.uniformMatrix4fv(l, false, skyView));
      set('uCamPos', (l) => gl.uniform3fv(l, state.camPos));
      set('uTop', (l) => gl.uniform3fv(l, p.skyTop));
      set('uHorizon', (l) => gl.uniform3fv(l, p.skyHorizon));
      set('uSunDir', (l) => gl.uniform3fv(l, p.sunDir));
      set('uSunColor', (l) => gl.uniform3fv(l, p.sunColor));
      set('uStars', (l) => gl.uniform1f(l, p.stars));
      set('uTime', (l) => gl.uniform1f(l, now));
    }
    drawMesh(skyProg, meshes.sky);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);

    const std = (mesh, opts) => {
      setStdUniforms(proj, view, lightMatrix, state.camPos, opts);
      drawMesh(stdProg, mesh);
    };

    std(meshes.ground, { tint: [1, 1, 1], diffuse: groundTex, emissive: blackTex, useTexture: true, shininess: 4 });
    for (const [key, tex] of Object.entries(facadeTex)) {
      const mesh = meshes['facade_' + key];
      if (!mesh || mesh.count === 0) continue;
      const glassy = key === 'glass' || key === 'tower';
      std(mesh, {
        tint: [1, 1, 1], diffuse: tex.diffuse, emissive: tex.emissive,
        useTexture: true, shininess: glassy ? 70 : 10,
      });
    }
    std(meshes.roof, { tint: [0.18, 0.17, 0.16], useTexture: false, shininess: 4 });
    std(meshes.trunk, { tint: [0.4, 0.28, 0.18], useTexture: false, shininess: 4 });
    for (const [kind, color] of Object.entries(canopyColors)) {
      const mesh = meshes['canopy_' + kind];
      if (mesh.count > 0) std(mesh, { tint: color, useTexture: false, shininess: 4 });
    }
    std(meshes.prop, { tint: [0.75, 0.68, 0.55], useTexture: false, shininess: 12 });
    std(meshes.lampPole, { tint: [0.16, 0.17, 0.19], useTexture: false, shininess: 20 });
    std(meshes.lampHead, {
      tint: [0.9, 0.85, 0.7], useTexture: false, shininess: 4,
      emissiveTint: [1.0, 0.72, 0.35],
    });
    // Lamp light pools: additive discs, visible only when the lamps glow.
    if (p.lampGlow > 0.01) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.depthMask(false);
      setStdUniforms(proj, view, lightMatrix, state.camPos, {
        tint: [1.0, 0.75, 0.4], useTexture: false, shininess: 4,
        emissiveTint: [1.0, 0.7, 0.3], useShadow: false,
      });
      // Reuse windowGlow as the pool strength through the emissive tint.
      gl.uniform1f(gl.getUniformLocation(stdProg, 'uWindowGlow'), p.lampGlow * 0.5);
      drawMesh(stdProg, meshes.pool);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Water last among opaque, with its own program.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(waterProg);
    {
      const set = (name, fn) => { const l = gl.getUniformLocation(waterProg, name); if (l) fn(l); };
      set('uProj', (l) => gl.uniformMatrix4fv(l, false, proj));
      set('uView', (l) => gl.uniformMatrix4fv(l, false, view));
      set('uDeep', (l) => gl.uniform3fv(l, p.waterColor));
      set('uSky', (l) => gl.uniform3fv(l, p.skyHorizon));
      set('uSunDir', (l) => gl.uniform3fv(l, p.sunDir));
      set('uSunColor', (l) => gl.uniform3fv(l, p.sunColor));
      set('uTime', (l) => gl.uniform1f(l, now));
      set('uCamPos', (l) => gl.uniform3fv(l, state.camPos));
      set('uFogColor', (l) => gl.uniform3fv(l, p.fogColor));
      set('uFogDensity', (l) => gl.uniform1f(l, p.fogDensity));
    }
    drawMesh(waterProg, meshes.water);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  return {
    gl,
    setPreset(name) { state.preset = presetByName(name); },
    preset() { return state.preset; },
    setCamera(pos, target) { state.camPos = pos; state.camTarget = target; },
    camera() { return { pos: state.camPos, target: state.camTarget }; },
    render,
    resize(w, h) { canvas.width = w; canvas.height = h; },
  };
}
