export const EMB_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const EMB_FRAG = `

precision highp float;

varying vec2 vUV;

uniform sampler2D uArt;
uniform sampler2D uField;
uniform sampler2D uWeave;
uniform vec2  uTexel;
uniform vec2  uLight;
uniform float uLightZ;
uniform vec2  uWash;
uniform float uHover;
uniform float uPress;
uniform vec2  uPressPos;
uniform float uAspect;
uniform vec3  uFabric;
uniform float uDepth;
uniform float uWeaveScale;

float hash(vec2 p){
  p = mod(p, 137.0);
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p){

  p = mod(p, 137.0);
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float weaveAt(vec2 uv){ return texture2D(uWeave, fract(uv * vec2(uAspect,1.0) * uWeaveScale)).r; }

void main() {
  vec2 uv = vUV;
  vec2 texel = uTexel;

  vec4 fld = texture2D(uField, uv);
  float cover = fld.r;
  float inkM  = fld.g;
  float ringM = fld.b;
  float stitchAng = fld.a * 3.14159;

  vec2 dp = uv * vec2(uAspect, 1.0);
  float bw = weaveAt(uv + vec2(0.37, 0.11));
  float blotch = noise(dp * 3.0) * 0.1 + noise(dp * 7.0) * 0.05;
  vec3 fabric = uFabric * (0.72 + bw * 0.6 + (blotch - 0.075));
  fabric += (noise(dp * 240.0) - 0.5) * 0.025;
  vec3 col = fabric;

  float pdist = distance(uv * vec2(uAspect, 1.0), uPressPos * vec2(uAspect, 1.0));
  float pressLocal = uPress * (1.0 - smoothstep(0.0, 0.5, pdist));

  float lift = 1.0 - pressLocal * 0.85;
  vec2 shOff = vec2(6.0, -6.0) * texel * lift;
  float shc = texture2D(uField, uv - shOff).r;
  col = mix(col, col * mix(0.42, 0.62, pressLocal), smoothstep(0.2, 0.8, shc) * 0.8);

  if (cover < 0.004) { gl_FragColor = vec4(col, 1.0); return; }

  float w0 = weaveAt(uv);
  float wL = weaveAt(uv - vec2(1.,0.)*texel), wR = weaveAt(uv + vec2(1.,0.)*texel);
  float wD = weaveAt(uv - vec2(0.,1.)*texel), wU = weaveAt(uv + vec2(0.,1.)*texel);
  vec2 wslope = vec2(wR - wL, wU - wD) * 22.0;
  vec3 Nw = normalize(vec3(-wslope.x, -wslope.y, 1.0));

  float cL = texture2D(uField, uv - vec2(1.,0.)*texel).r, cR = texture2D(uField, uv + vec2(1.,0.)*texel).r;
  float cD = texture2D(uField, uv - vec2(0.,1.)*texel).r, cU = texture2D(uField, uv + vec2(0.,1.)*texel).r;
  vec2 pslope = vec2(cR - cL, cU - cD) * uDepth * 16.0;
  vec3 Np = vec3(-pslope.x, -pslope.y, 1.0);
  float bevel = clamp(length(pslope), 0.0, 1.0);
  vec3 N = normalize(Np + Nw * 2.0);

  vec3 L = normalize(vec3(uLight, uLightZ));
  float diff = dot(N, L);
  float hi = pow(max(diff, 0.0), 1.25);
  float sh = pow(max(-diff, 0.0), 1.1);

  vec3 art = texture2D(uArt, uv).rgb;
  vec3 c = art * (0.72 + w0 * 0.6);

  float sc = cos(stitchAng), ss = sin(stitchAng);

  float across = (dp.x * ss - dp.y * sc);
  float rows = across * 260.0;

  float TWO_PI = 6.2831853;
  float satin = sin(mod(rows, TWO_PI));

  float ridge = 0.5 + 0.5 * satin;
  ridge = pow(ridge, 1.4);
  float jit = noise(vec2(floor(rows), (dp.x*sc+dp.y*ss)*90.0)) * 0.25;
  float satinShade = mix(0.82, 1.14, clamp(ridge + jit*ridge, 0.0, 1.0));

  float clothFace = cover * (1.0 - inkM);
  c *= mix(1.0, satinShade, clothFace * 0.9 + ringM * 0.6);

  c *= 1.0 - inkM * 0.05;

  c += hi * 0.46 * (0.5 + bevel * 0.5);
  c -= sh * 0.36;

  float edge = 1.0 - smoothstep(0.0, 0.32, cover);
  c *= 1.0 - edge * 0.28 * cover;

  c += (noise(dp * 380.0) - 0.5) * 0.045;

  if (uHover > 0.001) {
    float d = distance(dp, uWash * vec2(uAspect, 1.0));
    float halo = 1.0 - smoothstep(0.0, 0.42, d);
    float crown = smoothstep(0.72, 1.0, ridge);
    float glint = halo * halo * (0.35 + crown * 0.9) * uHover;
    c += glint * 0.16 * cover;
  }

  c *= 1.0 - pressLocal * 0.16 * cover;

  c = clamp(c, 0.0, 1.0);

  float aa = smoothstep(0.06, 0.2, cover);
  gl_FragColor = vec4(mix(col, c, aa), 1.0);
}
`;

