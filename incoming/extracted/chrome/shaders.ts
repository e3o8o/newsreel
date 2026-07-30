export const CHROME_VERT = `
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const CHROME_FRAG = `
precision highp float;

varying vec2 vUV;

uniform sampler2D uField;
uniform vec2  uTexel;
uniform vec2  uTilt;
uniform float uAspect;
uniform float uTime;

uniform vec3  uS0;
uniform vec3  uS1;
uniform vec3  uS2;
uniform vec3  uS3;
uniform vec3  uS4;
uniform vec3  uSpark;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float heightAt(vec2 uv){
  vec4 f = texture2D(uField, uv);
  return f.g + f.b * 0.18;
}

vec3 ramp(float t){
  t = clamp(t, 0.0, 1.0);
  float x = t * 4.0;
  vec3 col = uS0;
  col = mix(col, uS1, smoothstep(0.0, 1.0, clamp(x - 0.0, 0.0, 1.0)));
  col = mix(col, uS2, smoothstep(0.0, 1.0, clamp(x - 1.0, 0.0, 1.0)));
  col = mix(col, uS3, smoothstep(0.0, 1.0, clamp(x - 2.0, 0.0, 1.0)));
  col = mix(col, uS4, smoothstep(0.0, 1.0, clamp(x - 3.0, 0.0, 1.0)));
  return col;
}

float envT(vec2 env){
  float t = clamp(0.5 - env.y * 0.9, 0.0, 1.0);
  t = t + (t - 0.5) * 0.35 * (1.0 - abs(env.x));
  return clamp(t, 0.0, 1.0);
}

vec3 toneMap(vec3 c){
  return c / (c + vec3(0.85)) * 1.85;
}

float fbm(vec2 p){
  return noise(p) * 0.6 + noise(p * 2.1 + 4.0) * 0.3 + noise(p * 4.3 + 9.0) * 0.1;
}

vec3 background(vec2 uv){
  vec2 p = uv * vec2(uAspect, 1.0);
  float t = uTime * 0.08;

  float f1 = fbm(p * 1.4 + vec2(t, -t * 0.7));
  float f2 = fbm(p * 1.9 + vec2(-t * 0.8, t) + f1);

  vec3 poolA = uS0   * 0.16;
  vec3 poolB = uS3   * 0.5;
  vec3 poolC = uSpark* 0.1;
  vec3 col = uS4 * 0.04 + vec3(0.015);
  col = mix(col, poolA, smoothstep(0.35, 0.75, f1));
  col = mix(col, poolB, smoothstep(0.4, 0.85, f2));
  col = mix(col, poolC, smoothstep(0.6, 0.95, f1 * f2 * 1.6));

  vec2 c = (uv - vec2(0.5, 0.44)) * vec2(uAspect, 1.0);
  float radial = 1.0 - smoothstep(0.0, 0.95, length(c));
  col += (uS0 * 0.08 + vec3(0.02)) * radial;

  vec3 studioTint = mix(uS0, uS1, 0.4);

  float horizon = 1.0 - smoothstep(0.0, 0.16, abs(uv.y - 0.30));
  col += studioTint * 0.09 * horizon * 0.6;

  float ray = uv.x * uAspect * 0.5 + uv.y - fract(uTime * 0.03) * 2.0;
  col += studioTint * 0.07 * (1.0 - smoothstep(0.0, 0.22, abs(ray - 0.4))) * 0.5 * radial;

  float temp = clamp((uv.x - uv.y) * 0.5 + 0.5, 0.0, 1.0);
  col += mix(uS0 * 0.03, uSpark * 0.03, temp) * radial;

  col *= mix(0.45, 1.0, radial);

  col += (noise(p * 320.0) - 0.5) * 0.012;
  return col;
}

void main() {
  vec2 uv = vUV;

  vec2 wuv = uv - uTilt * 0.012;

  float crisp = texture2D(uField, wuv).r;
  float height = heightAt(wuv);

  vec3 bg = background(uv);

  float shadow = 0.0;
  shadow += texture2D(uField, wuv - vec2(0.004, 0.03)).g * 0.5;
  shadow += texture2D(uField, wuv - vec2(0.006, 0.055)).g * 0.3;
  shadow += texture2D(uField, wuv - vec2(0.008, 0.085)).g * 0.2;
  bg *= 1.0 - clamp(shadow, 0.0, 1.0) * 0.6;

  if (height < 0.01) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  float g1 = 1.6, g2 = 3.4;

  float aL = heightAt(wuv - vec2(g1,0.)*uTexel), aR = heightAt(wuv + vec2(g1,0.)*uTexel);
  float aD = heightAt(wuv - vec2(0.,g1)*uTexel), aU = heightAt(wuv + vec2(0.,g1)*uTexel);

  float bL = heightAt(wuv - vec2(g2,0.)*uTexel), bR = heightAt(wuv + vec2(g2,0.)*uTexel);
  float bD = heightAt(wuv - vec2(0.,g2)*uTexel), bU = heightAt(wuv + vec2(0.,g2)*uTexel);
  vec2 slope = (vec2(aR - aL, aU - aD) * 0.6 + vec2(bR - bL, bU - bD) * 0.4) * 22.0;
  vec3 N = normalize(vec3(-slope.x, -slope.y, 1.0));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 R = reflect(-V, N);

  float tt = uTime;
  vec2 fp = uv * vec2(uAspect, 1.0) * 1.6;
  vec2 flow = vec2(
    fbm(fp + vec2(tt * 0.25, height * 3.0)) - 0.5,
    fbm(fp + vec2(-tt * 0.2 + 5.0, tt * 0.15)) - 0.5
  ) * 0.55;
  flow += vec2(sin(tt * 0.31) * 0.1, cos(tt * 0.24) * 0.08);
  vec2 env = R.xy + uTilt + flow;

  vec3 sharpRefl = ramp(envT(env));
  vec3 blurRefl = vec3(0.0);
  const int NB = 6;
  for (int i = 0; i < NB; i++) {
    float a = float(i) / float(NB) * 6.2831853;
    vec2 j = vec2(cos(a), sin(a)) * 0.14;
    blurRefl += ramp(envT(env + j));
  }
  blurRefl /= float(NB);

  float rough = 0.4 + 0.25 * clamp(length(slope), 0.0, 1.0);
  vec3 metal = mix(sharpRefl, blurRefl, rough);

  float tMid = envT(env);
  vec3 envColor = background(clamp(uv + env * 0.35, 0.0, 1.0));
  float envMix = (1.0 - abs(tMid - 0.5) * 2.0) * 0.3;
  metal = mix(metal, metal + envColor * 2.0, envMix);

  float streak = smoothstep(0.35, 0.5, abs(env.x + sin(env.y*3.0)*0.1));
  metal += (1.0 - streak) * 0.1 * uS1;

  float fres = pow(1.0 - N.z, 2.2);
  metal += fres * uS1 * 0.45;

  vec3 keyDir = normalize(vec3(cos(tt * 0.22) * 0.7, 0.5 + sin(tt * 0.18) * 0.3, 0.9));
  vec3 Hh = normalize(keyDir + V);

  vec3 Na = normalize(vec3(N.x * 0.6, N.y, N.z));
  float ndh = max(dot(Na, Hh), 0.0);
  float spec = pow(ndh, 120.0);
  metal += spec * uSpark * 1.3;

  metal += pow(max(dot(N, Hh), 0.0), 16.0) * uS1 * 0.25;

  float sweepPos = fract(uTime * 0.16);
  float diag = (uv.x * uAspect + (1.0 - uv.y)) * 0.42;
  float band = 1.0 - smoothstep(0.0, 0.06, abs(diag - sweepPos * 1.4 + 0.2));
  float facing = clamp(N.x * -0.6 + N.y * 0.6 + 0.4, 0.0, 1.0);
  metal += band * facing * uSpark * 0.5;

  float curv = length(slope);
  float bright = smoothstep(0.62, 1.0, tMid) * smoothstep(0.4, 1.2, curv);
  float tw = 0.5 + 0.5 * sin(uTime * 2.0 + height * 40.0 + uv.x * 30.0);
  metal += bright * tw * tw * uSpark * 1.1;

  float ao = smoothstep(0.15, 0.7, texture2D(uField, wuv).g);
  metal *= 0.7 + ao * 0.3;

  float face = smoothstep(0.3, 0.55, crisp);
  metal *= 0.86 + face * 0.14;

  metal += (noise(uv * vec2(uAspect,1.0) * 520.0) - 0.5) * 0.035;

  vec3 c = toneMap(metal);

  c += (hash(uv * 1024.0 + fract(uTime)) - 0.5) * (1.5 / 255.0);
  c = clamp(c, 0.0, 1.0);

  float aa = smoothstep(0.16, 0.4, height);
  gl_FragColor = vec4(mix(bg, c, aa), 1.0);
}
`;

