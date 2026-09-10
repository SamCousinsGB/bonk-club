// One small, reusable GPU surface per renderer. The lens samples this frame's
// arena; it never changes world geometry or reads pixels back to the CPU.
const vertex = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D scene;
uniform float time;
uniform float strength;

float bell(float x, float width) { return exp(-x*x/(width*width)); }
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx)*.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y)*q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), t = fract(p); t = t*t*(3.-2.*t);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), t.x),
             mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), t.x), t.y);
}
void main() {
  vec2 p = (uv - .5) * 2.;
  float radius = length(p);
  float edge = 1. - smoothstep(.36, 1., radius);
  float twist = edge * edge * (.18 + .025*sin(time*.8));
  float turn = twist * strength;
  mat2 rotation = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
  vec2 bent = rotation * p * (1. + .20*edge*edge/max(.16, radius)*strength);
  vec4 background = texture2D(scene, .5 + bent*.5);

  // Noise follows circular coordinates, so gas filaments flow continuously
  // around the wrap without tiled seams or a regular crosshatch pattern.
  float angle = atan(p.y, p.x);
  vec2 orbit = vec2(cos(angle + time*.55), sin(angle + time*.55));
  float flow = .72*noise(orbit*4. + radius*vec2(116.,37.)) +
               .28*noise(orbit*13. + radius*vec2(240.,83.));
  float brightSide = .75 + .25*cos(angle - .7);
  float upper = .55 + .45*smoothstep(-.15, .3, p.y);
  float gas = bell(radius - .398, .048) * (.20 + flow*.9) * upper;
  float photon = bell(radius - .333 - flow*.0015, .0055);
  float inner = bell(radius - .348, .012) * (.65 + flow*.35);
  float halo = bell(radius - .365, .135) * .13;

  // The equatorial stream is hidden by the central shadow, while its lensed
  // image wraps above and below it. The simulation itself remains planar.
  vec2 disk = mat2(.998, .06, -.06, .998) * p;
  float streamY = -.018 - .012*sin(disk.x*9. - time*.45);
  float stream = bell(disk.y - streamY, .016 + .014*abs(disk.x));
  stream *= 1. - smoothstep(.45, .96, abs(disk.x));
  stream *= .7 + .3*noise(vec2(disk.x*18. - time*.9, disk.y*120.));
  float streamGlow = bell(disk.y - streamY, .065) *
                    (1. - smoothstep(.38, 1., abs(disk.x))) * .15;
  float outside = smoothstep(.319, .327, radius);
  float shadow = 1. - outside;
  vec3 warm = vec3(1., .46, .13);
  vec3 light = warm * (gas*1.65 + halo + streamGlow) * brightSide;
  light += vec3(1., .79, .43) * (inner*.95 + stream*1.5) * brightSide;
  light += vec3(1., .95, .78) * photon * 1.2;
  light *= outside;
  // Keep the central void black and let the hot ring bloom to white, without
  // applying a colour grade to the rest of the scene.
  vec3 color = background.rgb * (1. - shadow) + light;
  // Composite a complete lensed image near the core; partial alpha would
  // superimpose an unwarped copy of each player and create ghost outlines.
  float alpha = 1. - smoothstep(.88, 1., radius);
  gl_FragColor = vec4(color, alpha * strength);
}
`;

function createLens() {
  const canvas = document.createElement("canvas"), source = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true, premultipliedAlpha: false, antialias: false,
    depth: false, stencil: false, preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, code); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader); gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
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
  const lens = { canvas, source, gl, program, texture,
    sourceContext: source.getContext("2d"),
    time: gl.getUniformLocation(program, "time"),
    strength: gl.getUniformLocation(program, "strength") };
  // Allocate once while warming. Growing/shrinking holes should not repeatedly
  // resize two canvases and reallocate a texture during combat.
  canvas.width = canvas.height = source.width = source.height = 256;
  gl.viewport(0, 0, 256, 256);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); lens.lost = true; });
  return lens;
}

export function warmBlackholeLens(r) {
  const warm = () => {
    if (r.blackholeLens === undefined) r.blackholeLens = createLens();
  };
  // Compile while the menu/countdown is idle, not on the first explosion frame.
  if (globalThis.requestIdleCallback) globalThis.requestIdleCallback(warm, { timeout: 1500 });
  else globalThis.setTimeout(warm, 60);
}

export function drawBlackholeLens(r, f, size, fade, time) {
  if (r.blackholeLens === undefined) r.blackholeLens = createLens();
  const lens = r.blackholeLens;
  if (!lens || lens.lost) return false;
  const c = r.ctx, transform = c.getTransform(), radius = size / .322,
    pixels = 256,
    { gl, source, canvas, sourceContext } = lens;
  sourceContext.clearRect(0, 0, pixels, pixels);
  sourceContext.drawImage(c.canvas,
    (f.x - radius)*transform.a + transform.e, (f.y - radius)*transform.d + transform.f,
    radius*2*transform.a, radius*2*transform.d, 0, 0, pixels, pixels);
  gl.bindTexture(gl.TEXTURE_2D, lens.texture);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.uniform1f(lens.time, time); gl.uniform1f(lens.strength, fade);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  c.drawImage(canvas, f.x - radius, f.y - radius, radius * 2, radius * 2);
  return true;
}
