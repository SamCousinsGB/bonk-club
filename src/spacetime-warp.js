// A presentation-only pass over the completed arena. Field age/life come from
// the existing snapshots, so guests and hot joiners share the same envelope.
const MAX_HOLES = 4;
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function spacetimeSources(fields, transform, width, height, reduced = false) {
  return fields.filter(f => f.kind === "blackhole" && f.life > 0 && f.age > 0)
    .map(f => ({
      x: (f.x * transform.a + f.y * transform.c + transform.e) / height,
      y: 1 - (f.x * transform.b + f.y * transform.d + transform.f) / height,
      strength: smooth(f.age / .85) * smooth(f.life / 1.1) * (reduced ? .25 : 1),
      time: reduced ? 0 : f.age,
    }))
    .filter(f => Number.isFinite(f.x + f.y + f.strength + f.time) && f.strength > 0)
    .sort((a, b) => b.strength - a.strength || a.x - b.x || a.y - b.y)
    .slice(0, MAX_HOLES);
}

const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D scene;
uniform vec2 resolution;
uniform vec4 holes[4]; // centre in screen-height units, strength, field age

void main() {
  vec2 aspect = vec2(resolution.x / resolution.y, 1.);
  vec2 position = uv * aspect;
  vec2 displacement = vec2(0.);
  vec2 fringe = vec2(0.);
  float total = 0.;
  for (int i = 0; i < 4; i++) {
    vec2 delta = position - holes[i].xy;
    float distance = length(delta);
    vec2 radial = delta / max(.001, distance);
    vec2 tangent = vec2(-radial.y, radial.x);
    float age = holes[i].w;
    // The outer field reaches every part of the screen. Leave the small local
    // horizon circular, with its existing stronger lens doing the close work.
    float field = holes[i].z * smoothstep(.045, .18, distance) / (1. + distance * .45);
    float ripple = sin(distance * 19. - age * 2.3);
    float swell = .009 + .0035 * sin(age * .85);
    displacement += field * (radial * (swell + .004 * ripple) +
      tangent * (.006 * sin(distance * 6. - age * .75)));
    fringe += radial * field * (.00045 + .0002 * ripple);
    total += holes[i].z;
  }
  // Overlapping holes blend into one bounded bend, never multiply the amplitude.
  displacement *= 3.0 / max(1., total);
  fringe *= 1.2 / max(1., total);
  // Fade over more than the maximum displacement in screen-height units.
  // Heavy refraction must not repeatedly sample a clamped outer pixel.
  vec2 borderWidth = vec2(.075) / aspect;
  vec2 border = smoothstep(vec2(0.), borderWidth, uv) *
                smoothstep(vec2(0.), borderWidth, 1. - uv);
  vec2 sampleUV = uv + displacement / aspect * border;
  vec2 chroma = fringe / aspect * border;
  vec2 low = .5 / resolution, high = 1. - low;
  vec4 base = texture2D(scene, clamp(sampleUV, low, high));
  float red = texture2D(scene, clamp(sampleUV + chroma, low, high)).r;
  float blue = texture2D(scene, clamp(sampleUV - chroma, low, high)).b;
  gl_FragColor = vec4(red, base.g, blue, base.a);
}
`;

function createWarp() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true, premultipliedAlpha: false, antialias: false,
    depth: false, stencil: false, preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  const warp = { canvas, gl, lost: false };
  const initialise = () => {
    const program = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, code); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader); gl.deleteProgram(program); return false;
      }
      gl.attachShader(program, shader); gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return false; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    Object.assign(warp, { texture, pixels: 0,
      resolution: gl.getUniformLocation(program, "resolution"),
      holes: gl.getUniformLocation(program, "holes[0]"), values: new Float32Array(MAX_HOLES * 4),
    });
    return true;
  };
  if (!initialise()) return null;
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); warp.lost = true; });
  canvas.addEventListener("webglcontextrestored", () => { warp.lost = !initialise(); });
  return warp;
}

export function warmSpacetimeWarp(renderer) {
  const warm = () => {
    if (renderer.spacetimeWarp === undefined) renderer.spacetimeWarp = createWarp();
  };
  if (globalThis.requestIdleCallback) globalThis.requestIdleCallback(warm, { timeout: 1500 });
  else globalThis.setTimeout(warm, 60);
}

// Canvas-only two-pass refraction for unavailable/lost WebGL. Reuse both buffers
// and a fixed strip budget; no readback, per-pixel JS or persistent frame trails.
function drawFallback(renderer, sources) {
  const target = renderer.ctx, { width, height } = target.canvas;
  const buffers = renderer.spacetimeFallback ||= Array.from({ length: 2 }, () => {
    const canvas = document.createElement("canvas");
    return { canvas, context: canvas.getContext("2d") };
  });
  for (const buffer of buffers) {
    if (buffer.canvas.width !== width || buffer.canvas.height !== height) {
      buffer.canvas.width = width; buffer.canvas.height = height;
    }
    buffer.context.clearRect(0, 0, width, height);
  }
  buffers[0].context.drawImage(target.canvas, 0, 0);
  const total = Math.max(1, sources.reduce((sum, f) => sum + f.strength, 0));
  const offset = (position, axis) => sources.reduce((sum, f) => {
    const centre = axis ? f.x : 1 - f.y;
    const distance = position - centre;
    return sum + f.strength * Math.sin(distance * 8 - f.time * .9) * .018 * height;
  }, 0) / total;
  // A slight overscan fills the displaced sides without stretched edge bands.
  const activity = sources.reduce((sum, f) => sum + f.strength, 0) / total;
  const margin = .024 * height * activity;
  for (let y = 0; y < height; y += 8) {
    const h = Math.min(8, height - y), dx = offset((y + h / 2) / height, 0);
    buffers[1].context.drawImage(buffers[0].canvas, 0, y, width, h,
      dx - margin, y, width + margin * 2, h);
  }
  target.clearRect(0, 0, width, height);
  for (let x = 0; x < width; x += 8) {
    const w = Math.min(8, width - x), dy = offset((x + w / 2) / height, 1);
    target.drawImage(buffers[1].canvas, x, 0, w, height,
      x, dy - margin, w, height + margin * 2);
  }
}

export function drawSpacetimeWarp(renderer, fields) {
  const c = renderer.ctx, { width, height } = c.canvas;
  const sources = spacetimeSources(fields, c.getTransform(), width, height, renderer.reduced);
  if (!sources.length) return false;
  if (renderer.spacetimeWarp === undefined) renderer.spacetimeWarp = createWarp();
  const warp = renderer.spacetimeWarp;
  c.save(); c.resetTransform();
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  if (!warp || warp.lost) {
    drawFallback(renderer, sources);
  } else {
    const { gl, canvas, values } = warp;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
      gl.viewport(0, 0, width, height);
      warp.pixels = 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, warp.texture);
    if (!warp.pixels) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      warp.pixels = width * height;
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c.canvas);
    values.fill(0);
    sources.forEach((f, i) => values.set([f.x, f.y, f.strength, f.time], i * 4));
    gl.uniform4fv(warp.holes, values); gl.uniform2f(warp.resolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    c.clearRect(0, 0, width, height);
    c.drawImage(canvas, 0, 0);
  }
  c.restore();
  return true;
}
