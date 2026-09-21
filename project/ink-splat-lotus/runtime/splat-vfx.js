// Canonical generated runtime. Edit this file in the skill, then sync consumers.
import * as THREE from "three";

// Binary layout defined by the canonical 3D Gaussian Splat .splat format.
// These offsets are protocol invariants, not aesthetic tuning values.
const SPLAT_RECORD = Object.freeze({
  bytes: 32,
  position: Object.freeze({ x: 0, y: 4, z: 8 }),
  scale: Object.freeze({ x: 12, y: 16, z: 20 }),
  color: Object.freeze({ r: 24, g: 25, b: 26, a: 27 })
});

// Single source for the ink grade GLSL. The particle shader injects uniform
// names, the Dyno body modifier injects baked literals — both bodies stay
// identical by construction.
function buildGradeInkSrgbGlsl(p) {
  return `
  vec3 gradeInkSrgb(vec3 color) {
    color = clamp(color, 0.0, 1.0);
    if (${p.disabledExpr}) return color;

    const vec3 lumaWeights = vec3(0.299, 0.587, 0.114);
    float luma = dot(color, lumaWeights);
    float maxChannel = max(color.r, max(color.g, color.b));
    float minChannel = min(color.r, min(color.g, color.b));
    float chroma = maxChannel - minChannel;
    float roseDominance = color.r - max(color.g, color.b);
    float roseMask = smoothstep(0.015, 0.10, roseDominance) * smoothstep(0.02, 0.14, chroma);
    float goldWarmth = min(color.r - color.b, color.g - color.b);
    float goldMask = smoothstep(0.015, 0.10, goldWarmth)
      * smoothstep(0.02, 0.14, chroma)
      * smoothstep(0.12, 0.78, luma)
      * (1.0 - roseMask);
    float colorMask = smoothstep(0.015, 0.12, chroma) * (1.0 - smoothstep(0.45, 0.75, chroma));
    float saturationGain = 1.0
      + ${p.vibrance} * colorMask
      + (${p.roseSaturation} - 1.0) * roseMask
      + (${p.goldSaturation} - 1.0) * goldMask;
    color = clamp(mix(vec3(luma), color, saturationGain), 0.0, 1.0);

    luma = dot(color, lumaWeights);
    float inkMask = 1.0 - smoothstep(${p.inkLow}, ${p.inkHigh}, luma);
    color *= 1.0 - ${p.inkDepth} * inkMask;

    luma = max(dot(color, lumaWeights), 0.0001);
    float contrastLuma = clamp(
      (luma - ${p.contrastPivot}) * ${p.contrast} + ${p.contrastPivot},
      0.0,
      1.0
    );
    color *= contrastLuma / luma;

    luma = max(dot(color, lumaWeights), 0.0001);
    float shoulder = clamp(${p.highlightShoulder}, 0.5, 0.999);
    if (luma > shoulder) {
      float headroom = max(1.0 - shoulder, 0.001);
      float compressed = shoulder + (1.0 - exp(-(luma - shoulder) / headroom)) * headroom;
      color *= compressed / luma;
    }
    return clamp(color, 0.0, 1.0);
  }`;
}

const PARTICLE_GRADE_GLSL = buildGradeInkSrgbGlsl({
  disabledExpr: "uGradeEnabled < 0.5",
  vibrance: "uVibrance",
  roseSaturation: "uRoseSaturation",
  goldSaturation: "uGoldSaturation",
  inkLow: "uInkLow",
  inkHigh: "uInkHigh",
  inkDepth: "uInkDepth",
  contrast: "uContrast",
  contrastPivot: "uContrastPivot",
  highlightShoulder: "uHighlightShoulder"
});

export const PARTICLE_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aFlowDir;
  attribute float aPhase;
  attribute float aRole;
  attribute float aFlowBand;
  attribute float aTrailAspect;

  uniform float uTime;
  uniform float uHover;
  uniform vec3 uHoverPoint;
  uniform float uDissolve;
  uniform float uPixelRatio;
  uniform float uBaseSize;
  uniform float uHoverRadius;
  uniform float uHoverPush;
  uniform float uHoverSwirl;
  uniform float uHoverLift;
  uniform float uRippleClock;
  uniform float uRippleFrequency;
  uniform float uRippleSpeed;
  uniform vec3 uPointerVelocity;
  uniform float uPointerSpeed;
  uniform float uVelocityInfluence;
  uniform float uTailWindow;
  uniform float uEmitAlpha;
  uniform float uFlowFrequency;
  uniform float uCurlStrength;
  uniform float uMaxDistance;
  uniform float uStreakAspect;
  uniform float uGlowScale;
  uniform float uSparkle;
  uniform float uCalmOpacityMin;
  uniform float uCalmOpacityMax;
  uniform float uPaletteMinMix;
  uniform float uPaletteMaxMix;
  uniform float uGradeEnabled;
  uniform float uInkDepth;
  uniform float uInkLow;
  uniform float uInkHigh;
  uniform float uRoseSaturation;
  uniform float uGoldSaturation;
  uniform float uVibrance;
  uniform float uContrast;
  uniform float uContrastPivot;
  uniform float uHighlightShoulder;
  uniform vec3 uSmokeRose;
  uniform vec3 uPetalPink;
  uniform vec3 uIndigoInk;
  uniform vec3 uCeladon;
  uniform vec3 uMoonWhite;
  uniform vec3 uMutedGold;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlow;
  varying float vStretch;
  varying float vFlowAngle;
  varying float vTrailAspect;

  float saturate01(float x) {
    return clamp(x, 0.0, 1.0);
  }

  float ease(float x) {
    x = saturate01(x);
    return x * x * (3.0 - 2.0 * x);
  }

  vec3 safeNormalize(vec3 value) {
    float len = length(value);
    if (len < 0.0001) return vec3(0.0, 1.0, 0.0);
    return value / len;
  }

  vec3 linearToSrgbExact(vec3 color) {
    vec3 value = max(color, vec3(0.0));
    vec3 lower = value * 12.92;
    vec3 higher = 1.055 * pow(value, vec3(1.0 / 2.4)) - 0.055;
    return mix(lower, higher, step(vec3(0.0031308), value));
  }

  vec3 srgbToSparkLinear(vec3 color) {
    return pow(clamp(color, 0.0, 1.0), vec3(2.2));
  }

${PARTICLE_GRADE_GLSL}

  void main() {
    vec3 origin = position;
    float rolePetal = 1.0 - step(0.5, abs(aRole - 0.0));
    float roleGold = 1.0 - step(0.5, abs(aRole - 1.0));
    float roleInk = 1.0 - step(0.5, abs(aRole - 2.0));

    // Burn-edge sweep: every response is a function of the signed distance
    // between the global front (uDissolve) and this particle's timetable slot.
    // Life is short: emitted at the edge, a brief comet flight, then gone.
    float frontDelta = uDissolve - aPhase;
    float life = clamp(frontDelta / max(uTailWindow, 0.001), 0.0, 1.0);
    float emit = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.55, 1.0, life));
    float flash = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.1, 0.35, life));
    float flyT = 1.0 - pow(1.0 - life, 2.2);

    // Continuous low-frequency flow field: neighbours in origin space share direction.
    vec3 q = origin * uFlowFrequency + vec3(0.0, uTime * 0.06, 0.0);
    vec3 lowField = vec3(
      sin(q.y + cos(q.z * 0.7)),
      cos(q.z + sin(q.x * 0.8)),
      sin(q.x + cos(q.y * 0.6))
    );
    float bandPhase = aFlowBand * 2.1 + 0.7;
    vec3 flowDir = safeNormalize(
      aFlowDir + lowField * uCurlStrength + vec3(cos(bandPhase), 0.16, sin(bandPhase)) * 0.11
    );

    // Short comet flight away from the burn edge.
    float travel = uMaxDistance * 0.55 * flyT;
    travel *= 1.0 + roleInk * 0.12 - roleGold * 0.24;
    float arcPhase = bandPhase + flyT * (1.7 + rolePetal * 0.5) + uTime * 0.05;
    vec3 arcAxis = safeNormalize(cross(flowDir, vec3(0.0, 1.0, 0.0)) + vec3(0.0001));
    vec3 arc = (arcAxis * sin(arcPhase) + vec3(0.0, cos(arcPhase) * 0.35, 0.0)) * 0.05 * flyT;
    vec3 p = origin + flowDir * travel + arc;
    p += lowField * 0.012 * sin(uTime * 0.9 + aSeed * 12.0) * emit;

    // Streak while the comet is fast; round at birth and at the tail end.
    vStretch = smoothstep(0.1, 0.35, life) * (1.0 - smoothstep(0.55, 0.8, life));
    vec3 viewFlow = safeNormalize((modelViewMatrix * vec4(flowDir, 0.0)).xyz);
    vFlowAngle = atan(-viewFlow.y, viewFlow.x);
    vTrailAspect = aTrailAspect;

    // Hover: two travelling waves radiating from the raycast hit, like water.
    float intactMask = 1.0 - smoothstep(0.06, 0.22, uDissolve);
    float hoverDistance = distance(p, uHoverPoint);
    vec3 hoverDir = safeNormalize(p - uHoverPoint + vec3(0.001, 0.002, -0.001));
    float along = dot(hoverDir, safeNormalize(uPointerVelocity + vec3(0.0001)));
    float wake = saturate01(along) * uPointerSpeed * uVelocityInfluence;
    float hoverNorm = hoverDistance / max(uHoverRadius, 0.001) * (1.0 - clamp(wake * 2.2, 0.0, 0.75));
    float env = (1.0 - smoothstep(0.0, 1.0, hoverNorm)) * uHover * intactMask;
    float wave = sin(hoverDistance * uRippleFrequency - uRippleClock * uRippleSpeed) * 0.65
      + sin(hoverDistance * uRippleFrequency * 1.7 - uRippleClock * uRippleSpeed * 1.35 + 1.9) * 0.35;
    float crest = max(wave, 0.0) * env;
    vec3 hoverTangent = safeNormalize(cross(hoverDir, vec3(0.0, 1.0, 0.0)) + vec3(0.001));
    p += hoverDir * wave * env * uHoverPush;
    p.y += wave * env * uHoverLift;
    p += hoverTangent * env * uHoverSwirl * sin(uTime * 2.2 + aSeed * 8.0);

    // Arrival sparkle: brief per-particle twinkle as the lotus finishes gathering.
    float twinkle = pow(0.5 + 0.5 * sin(uTime * (2.6 + aSeed * 6.0) + aSeed * 40.0), 3.0);
    float arrival = uSparkle * twinkle * (1.0 - flyT);

    // Glittering dust right at the burn edge.
    float frontTwinkle = pow(0.5 + 0.5 * sin(uTime * (4.0 + aSeed * 7.0) + aSeed * 40.0), 3.0);
    float frontSparkle = flash * frontTwinkle;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float perspective = 1.0 / max(0.42, -mvPosition.z);
    float sizePulse = 0.94 + 0.08 * sin(uTime * 0.58 + aSeed * 10.0);
    float mistShrink = 1.0 - smoothstep(0.55, 1.0, life) * 0.4;
    float sizeScale = 1.0 + flash * 0.45 + env * (0.4 + crest * 1.5) + arrival * 0.4;
    sizeScale *= mistShrink;
    sizeScale *= 1.0 + vStretch * (uStreakAspect - 1.0) * 0.5;
    gl_PointSize = min(aSize * uBaseSize * uPixelRatio * sizePulse * sizeScale * perspective, 64.0);
    gl_Position = projectionMatrix * mvPosition;

    // Colour: keep most of the sampled splat colour, tint by role and stage.
    float paletteMix = mix(uPaletteMinMix, uPaletteMaxMix, aSeed);
    vec3 petalTarget = mix(uSmokeRose, uPetalPink, 0.28 + aSeed * 0.52);
    vec3 inkTarget = mix(uIndigoInk, uCeladon, 0.12 + aSeed * 0.48);
    vec3 roleTarget = petalTarget * rolePetal + uMutedGold * roleGold + inkTarget * roleInk;
    vec3 sourceSrgb = linearToSrgbExact(aColor);
    vec3 sourceGraded = srgbToSparkLinear(gradeInkSrgb(sourceSrgb));
    vec3 graded = mix(sourceGraded, roleTarget, paletteMix);
    vec3 frontTint = mix(uMoonWhite, uCeladon, roleInk * 0.55);
    vec3 color = mix(graded, frontTint, saturate01(flash * 0.3));
    vec3 crestTint = mix(uCeladon, uMoonWhite, 0.62 + 0.32 * saturate01(wave));
    color = mix(color, crestTint, saturate01(crest * 0.62));
    vec3 sparkleTint = mix(uMoonWhite, uMutedGold, 0.12 + roleGold * 0.3);
    color = mix(color, mix(uMoonWhite, uMutedGold, 0.18 + roleGold * 0.25), saturate01(frontSparkle) * 0.3);
    vColor = mix(color, sparkleTint, saturate01(arrival) * 0.32);
    vGlow = (flash * 0.8 + crest * 1.15 + arrival * 0.9 + frontSparkle * 0.6
      + roleGold * flash * 0.2) * uGlowScale;

    // Alpha lifecycle: a short bright burst at the burn edge, then strictly
    // gone. Ahead of the front the paint owns the pixel; behind it the paper.
    float calmPulse = 0.5 + 0.5 * sin(uTime * 0.5 + aSeed * 9.0);
    float calmAlpha = mix(uCalmOpacityMin, uCalmOpacityMax, calmPulse);
    float transitionAlpha = emit * uEmitAlpha * (0.85 + flash * 0.35);
    vAlpha = mix(calmAlpha, transitionAlpha, smoothstep(0.02, 0.08, uDissolve));
    vAlpha = max(vAlpha, env * 0.42 + crest * 0.5);
    vAlpha = max(vAlpha, saturate01(arrival) * 0.3 * (1.0 - uDissolve));
    vAlpha *= 1.0 - smoothstep(0.985, 1.0, uDissolve);
  }
`;

export const PARTICLE_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uOpacity;
  uniform float uStreakAspect;
  uniform vec3 uMoonWhite;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlow;
  varying float vStretch;
  varying float vFlowAngle;
  varying float vTrailAspect;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float c = cos(vFlowAngle);
    float s = sin(vFlowAngle);
    vec2 uv = mat2(c, -s, s, c) * centered;
    uv.x /= mix(1.0, max(uStreakAspect * vTrailAspect, 1.0), vStretch);
    float d = length(uv);
    float disc = smoothstep(0.5, 0.08, d);
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.48, 0.2, d) * (1.0 - core);
    float alpha = disc * uOpacity * vAlpha;
    if (alpha < 0.002) discard;

    vec3 color = vColor + uMoonWhite * (core * vGlow * 0.28 + halo * vGlow * 0.1);
    gl_FragColor = vec4(color, alpha);
  }
`;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function hash1(value) {
  const raw = Math.sin(value * 127.1 + 17.13) * 43758.5453123;
  return raw - Math.floor(raw);
}

function orientationQuaternion(config) {
  const root = new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.model.rootRotation));
  const child = new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.model.splatRotation));
  return root.multiply(child);
}

function classifyRole(config, r, g, b) {
  const classifier = config.roles.classifier;
  if (classifier.type !== "warm-gold-neutral-v1") {
    throw new Error(`Unsupported splat role classifier: ${classifier.type}`);
  }
  const warm = classifier.warm;
  if (r > warm.redMin && r > g * warm.redVsGreen && r > b * warm.redVsBlue) return 0;

  const gold = classifier.gold;
  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (
    brightness > gold.brightnessMin &&
    r > gold.redMin &&
    g > gold.greenMin &&
    b < gold.blueMax &&
    chroma > gold.chromaMin
  ) {
    return 1;
  }
  return 2;
}

function makeFlowDirection(config, displayPosition, displayCenter, role, seed, inverseOrientation) {
  const relative = displayPosition.clone().sub(displayCenter);
  const key = role === 0 ? "warm" : role === 1 ? "gold" : "neutral";
  const direction = new THREE.Vector3(...config.roles.flow[key]);
  const variation = config.roles.flowVariation;
  if (role === 0) {
    direction.x += relative.x * variation.warmRadialX;
    direction.z += Math.sin(seed * Math.PI * 2) * variation.warmDepth;
  } else if (role === 1) {
    direction.z += Math.sin(seed * Math.PI * 2) * variation.goldDepth;
  } else {
    direction.y += relative.y * variation.neutralVertical;
    direction.z += Math.cos(seed * Math.PI * 2) * variation.neutralDepth;
  }
  return direction.normalize().applyQuaternion(inverseOrientation).normalize();
}

function paletteColor(config, key) {
  return new THREE.Color(config.palette[key]);
}

export function createParticleMaterial({ config, aestheticContext }) {
  const particle = config.particleVfx;
  const interaction = config.interaction;
  const dissolve = config.dissolve;
  const flow = dissolve.flow;
  const grade = config.grade;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uHover: { value: 0 },
      uHoverPoint: { value: new THREE.Vector3() },
      uDissolve: { value: 0 },
      uPixelRatio: {
        value: Math.min(window.devicePixelRatio || 1, aestheticContext.pixelRatioCap)
      },
      uBaseSize: { value: particle.baseSize },
      uHoverRadius: { value: interaction.hoverRadius },
      uHoverPush: { value: interaction.push },
      uHoverSwirl: { value: interaction.swirl },
      uHoverLift: { value: interaction.lift },
      uRippleClock: { value: 0 },
      uRippleFrequency: { value: interaction.rippleFrequency },
      uRippleSpeed: { value: interaction.rippleSpeed },
      uPointerVelocity: { value: new THREE.Vector3() },
      uPointerSpeed: { value: 0 },
      uVelocityInfluence: { value: interaction.pointerVelocityInfluence },
      uTailWindow: { value: dissolve.band.tailWindow },
      uEmitAlpha: { value: dissolve.band.emitAlpha },
      uFlowFrequency: { value: flow.frequency },
      uCurlStrength: { value: flow.curlStrength },
      uMaxDistance: { value: flow.maxDistance },
      uStreakAspect: { value: Math.min(flow.streakAspect, aestheticContext.streakAspectCap) },
      uGlowScale: { value: 1 },
      uSparkle: { value: 0 },
      uCalmOpacityMin: { value: particle.calmOpacityMin },
      uCalmOpacityMax: { value: particle.calmOpacityMax },
      uPaletteMinMix: { value: config.palette.minMix },
      uPaletteMaxMix: { value: config.palette.maxMix },
      uGradeEnabled: { value: grade.enabled ? 1 : 0 },
      uInkDepth: { value: grade.inkDepth },
      uInkLow: { value: grade.inkLow },
      uInkHigh: { value: grade.inkHigh },
      uRoseSaturation: { value: grade.roseSaturation },
      uGoldSaturation: { value: grade.goldSaturation },
      uVibrance: { value: grade.vibrance },
      uContrast: { value: grade.contrast },
      uContrastPivot: { value: grade.contrastPivot },
      uHighlightShoulder: { value: grade.highlightShoulder },
      uSmokeRose: { value: paletteColor(config, "smokeRose") },
      uPetalPink: { value: paletteColor(config, "petalPink") },
      uIndigoInk: { value: paletteColor(config, "indigoInk") },
      uCeladon: { value: paletteColor(config, "celadon") },
      uMoonWhite: { value: paletteColor(config, "moonWhite") },
      uMutedGold: { value: paletteColor(config, "mutedGold") },
      uOpacity: { value: 1 }
    },
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER
  });
}

export async function createSplatParticleLayer({ splatUrl, config, aestheticContext }) {
  const response = await fetch(splatUrl, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`Unable to fetch splat particles: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const recordCount = Math.floor(buffer.byteLength / SPLAT_RECORD.bytes);
  if (!recordCount) throw new Error("No splat records found");

  const view = new DataView(buffer);
  const targetCount = Math.min(recordCount, aestheticContext.particleBudget(recordCount));
  const sampling = config.aesthetic.quality.sampling;
  const samples = [];
  const orientation = orientationQuaternion(config);
  const inverseOrientation = orientation.clone().invert();
  const displayBounds = new THREE.Box3();
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;
  let totalWeight = 0;

  for (let recordIndex = 0; recordIndex < recordCount; recordIndex += 1) {
    const offset = recordIndex * SPLAT_RECORD.bytes;
    const x = view.getFloat32(offset + SPLAT_RECORD.position.x, true);
    const y = view.getFloat32(offset + SPLAT_RECORD.position.y, true);
    const z = view.getFloat32(offset + SPLAT_RECORD.position.z, true);
    const sx = view.getFloat32(offset + SPLAT_RECORD.scale.x, true);
    const sy = view.getFloat32(offset + SPLAT_RECORD.scale.y, true);
    const sz = view.getFloat32(offset + SPLAT_RECORD.scale.z, true);
    const alpha = view.getUint8(offset + SPLAT_RECORD.color.a);
    if (![x, y, z, sx, sy, sz].every(Number.isFinite) || alpha < sampling.minAlpha) continue;
    if (
      Math.abs(x) > sampling.coordinateAbsMax ||
      Math.abs(y) > sampling.coordinateAbsMax ||
      Math.abs(z) > sampling.coordinateAbsMax
    ) continue;

    const area =
      Math.sqrt(Math.abs(sx * sy)) +
      Math.sqrt(Math.abs(sy * sz)) +
      Math.sqrt(Math.abs(sz * sx));
    const weight = (alpha / 255) * THREE.MathUtils.clamp(
      area,
      sampling.areaWeightRange[0],
      sampling.areaWeightRange[1]
    );
    weightedX += x * weight;
    weightedY += y * weight;
    weightedZ += z * weight;
    totalWeight += weight;
  }

  const visualCenterLocal = totalWeight > 0
    ? new THREE.Vector3(weightedX / totalWeight, weightedY / totalWeight, weightedZ / totalWeight)
    : new THREE.Vector3();
  const displayCenter = visualCenterLocal.clone().applyQuaternion(orientation);

  for (let index = 0; index < targetCount; index += 1) {
    const jitter = (hash1(index + 3.7) - 0.5) * sampling.stratifiedJitter;
    const recordIndex = THREE.MathUtils.clamp(
      Math.floor(((index + 0.5 + jitter) / targetCount) * recordCount),
      0,
      recordCount - 1
    );
    const offset = recordIndex * SPLAT_RECORD.bytes;
    const x = view.getFloat32(offset + SPLAT_RECORD.position.x, true);
    const y = view.getFloat32(offset + SPLAT_RECORD.position.y, true);
    const z = view.getFloat32(offset + SPLAT_RECORD.position.z, true);
    const r = view.getUint8(offset + SPLAT_RECORD.color.r);
    const g = view.getUint8(offset + SPLAT_RECORD.color.g);
    const b = view.getUint8(offset + SPLAT_RECORD.color.b);
    const alpha = view.getUint8(offset + SPLAT_RECORD.color.a);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (
      Math.abs(x) > sampling.coordinateAbsMax ||
      Math.abs(y) > sampling.coordinateAbsMax ||
      Math.abs(z) > sampling.coordinateAbsMax ||
      alpha < sampling.minAlpha
    ) continue;

    const position = new THREE.Vector3(x, y, z);
    const displayPosition = position.clone().applyQuaternion(orientation);
    const role = classifyRole(config, r, g, b);
    const seed = hash1(recordIndex + role * 13.7);
    const color = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    samples.push({ position, displayPosition, color, role, seed });
    displayBounds.expandByPoint(displayPosition);
  }
  if (!samples.length) throw new Error("No usable splat particle samples");

  const displaySize = new THREE.Vector3();
  displayBounds.getSize(displaySize);
  const roleVectors = Object.values(config.roles.flow).map((value) => new THREE.Vector3(...value));
  const sharedWind = roleVectors.reduce((sum, value) => sum.add(value), new THREE.Vector3())
    .normalize()
    .applyQuaternion(inverseOrientation)
    .normalize();
  const fieldInfo = {
    min: displayBounds.min.clone(),
    size: displaySize.clone(),
    orientation: orientation.clone(),
    windObject: sharedWind
  };

  const positions = new Float32Array(samples.length * 3);
  const colors = new Float32Array(samples.length * 3);
  const seeds = new Float32Array(samples.length);
  const sizes = new Float32Array(samples.length);
  const flowDirs = new Float32Array(samples.length * 3);
  const phases = new Float32Array(samples.length);
  const roles = new Float32Array(samples.length);
  const flowBands = new Float32Array(samples.length);
  const trailAspects = new Float32Array(samples.length);
  const bandCount = Math.max(1, Math.round(config.dissolve.flow.bandCount));
  const dissolveBand = config.dissolve.band;
  const ordering = config.dissolve.ordering;
  const pointStyle = config.particleVfx.pointStyle;

  samples.forEach((sample, index) => {
    const { position, displayPosition, color, role, seed } = sample;
    const xNorm = clamp01((displayPosition.x - displayBounds.min.x) / Math.max(displaySize.x, 0.001));
    const yNorm = clamp01((displayPosition.y - displayBounds.min.y) / Math.max(displaySize.y, 0.001));
    const coherentWave = 0.5 + 0.5 * Math.sin(
      displayPosition.x * ordering.waveFrequency[0] +
      displayPosition.y * ordering.waveFrequency[1]
    );
    const spatialOrder = clamp01(
      xNorm * ordering.xWeight +
      (1 - yNorm) * ordering.inverseYWeight +
      coherentWave * ordering.waveWeight
    );
    const phase =
      THREE.MathUtils.lerp(dissolveBand.phaseMin, dissolveBand.phaseMax, spatialOrder) +
      (role === 1 ? ordering.goldPhaseOffset : 0);
    const flowDirection = makeFlowDirection(
      config,
      displayPosition,
      displayCenter,
      role,
      seed,
      inverseOrientation
    );
    const bandNorm = clamp01(
      xNorm * ordering.bandXWeight +
      (1 - yNorm) * ordering.bandInverseYWeight +
      (hash1(index + 7.7) - 0.5) * ordering.bandJitter
    );
    const flowBand = Math.min(bandCount - 1, Math.floor(bandNorm * bandCount));

    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y;
    positions[index * 3 + 2] = position.z;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    seeds[index] = seed;
    sizes[index] = THREE.MathUtils.lerp(
      pointStyle.sizeRange[0],
      pointStyle.sizeRange[1],
      hash1(index + 91.3)
    ) + (role === 1 ? pointStyle.goldSizeBoost : 0);
    flowDirs[index * 3] = flowDirection.x;
    flowDirs[index * 3 + 1] = flowDirection.y;
    flowDirs[index * 3 + 2] = flowDirection.z;
    phases[index] = phase;
    roles[index] = role;
    flowBands[index] = flowBand;
    trailAspects[index] = THREE.MathUtils.lerp(
      pointStyle.trailAspectRange[0],
      pointStyle.trailAspectRange[1],
      hash1(index + 41.9)
    );
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aFlowDir", new THREE.BufferAttribute(flowDirs, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aRole", new THREE.BufferAttribute(roles, 1));
  geometry.setAttribute("aFlowBand", new THREE.BufferAttribute(flowBands, 1));
  geometry.setAttribute("aTrailAspect", new THREE.BufferAttribute(trailAspects, 1));
  geometry.computeBoundingSphere();

  const material = createParticleMaterial({ config, aestheticContext });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 12;
  points.userData.particleCount = samples.length;
  return {
    points,
    material,
    visualCenterLocal,
    fieldInfo,
    requestedParticleBudget: targetCount
  };
}

export function createSplatBodyModifier({ splat, dyno, config, fieldInfo }) {
  if (!splat || !dyno?.dynoBlock || !fieldInfo) return null;
  const interaction = config.interaction;
  const band = config.dissolve.band;
  const ordering = config.dissolve.ordering;
  const grade = config.grade;
  const fmt = (value) => Number(value).toFixed(4);
  const hover = dyno.dynoFloat(0);
  const rippleClock = dyno.dynoFloat(0);
  const hitPoint = dyno.dynoVec3(new THREE.Vector3());
  const dissolve = dyno.dynoFloat(0);
  const moon = paletteColor(config, "moonWhite").convertLinearToSRGB();
  const orientMatrix = new THREE.Matrix4().makeRotationFromQuaternion(fieldInfo.orientation);
  const matrix = orientMatrix.elements;
  const fieldMin = fieldInfo.min;
  const invSize = new THREE.Vector3(
    1 / Math.max(fieldInfo.size.x, 0.001),
    1 / Math.max(fieldInfo.size.y, 0.001),
    1
  );
  const bodyDyno = new dyno.Dyno({
    inTypes: {
      gsplat: dyno.Gsplat,
      hover: "float",
      clock: "float",
      point: "vec3",
      dissolve: "float"
    },
    outTypes: { gsplat: dyno.Gsplat },
    globals: () => [
      dyno.unindent(`
        const mat3 inkOrient = mat3(
          ${fmt(matrix[0])}, ${fmt(matrix[1])}, ${fmt(matrix[2])},
          ${fmt(matrix[4])}, ${fmt(matrix[5])}, ${fmt(matrix[6])},
          ${fmt(matrix[8])}, ${fmt(matrix[9])}, ${fmt(matrix[10])}
        );

${buildGradeInkSrgbGlsl({
  disabledExpr: grade.enabled ? "false" : "true",
  vibrance: fmt(grade.vibrance),
  roseSaturation: fmt(grade.roseSaturation),
  goldSaturation: fmt(grade.goldSaturation),
  inkLow: fmt(grade.inkLow),
  inkHigh: fmt(grade.inkHigh),
  inkDepth: fmt(grade.inkDepth),
  contrast: fmt(grade.contrast),
  contrastPivot: fmt(grade.contrastPivot),
  highlightShoulder: fmt(grade.highlightShoulder)
})}

        float inkBodyPhase(vec3 center) {
          vec3 display = inkOrient * center;
          float xN = clamp((display.x - ${fmt(fieldMin.x)}) * ${fmt(invSize.x)}, 0.0, 1.0);
          float yN = clamp((display.y - ${fmt(fieldMin.y)}) * ${fmt(invSize.y)}, 0.0, 1.0);
          float wave = 0.5 + 0.5 * sin(
            display.x * ${fmt(ordering.waveFrequency[0])}
            + display.y * ${fmt(ordering.waveFrequency[1])}
          );
          float order = clamp(
            xN * ${fmt(ordering.xWeight)}
            + (1.0 - yN) * ${fmt(ordering.inverseYWeight)}
            + wave * ${fmt(ordering.waveWeight)},
            0.0,
            1.0
          );
          return mix(${fmt(band.phaseMin)}, ${fmt(band.phaseMax)}, order);
        }

        void inkBodyErase(vec3 center, float progress, out float fade, out float glow, out float loosen) {
          fade = 1.0;
          glow = 0.0;
          loosen = 0.0;
          if (progress < 0.0005) return;
          float phase = inkBodyPhase(center);
          float delta = progress - phase;
          glow = (1.0 - smoothstep(0.0, ${fmt(band.edgeGlowWidth)}, abs(delta + 0.01)))
            * smoothstep(0.01, 0.05, progress);
          fade = 1.0 - smoothstep(0.0, ${fmt(band.bodyErase)}, delta);
          loosen = clamp(delta / ${fmt(band.bodyErase)}, 0.0, 1.0);
        }

        vec3 inkBodyRipple(vec3 center, float strength, float clock, vec3 point, out float crest) {
          crest = 0.0;
          vec3 rel = center - point;
          float dist = length(rel);
          float norm = dist / ${fmt(interaction.hoverRadius)};
          float env = (1.0 - smoothstep(0.0, 1.0, norm)) * strength;
          if (env < 0.0005) return center;
          float wave = sin(dist * ${fmt(interaction.rippleFrequency)} - clock * ${fmt(interaction.rippleSpeed)}) * 0.65
            + sin(dist * ${fmt(interaction.rippleFrequency * 1.7)} - clock * ${fmt(interaction.rippleSpeed * 1.35)} + 1.9) * 0.35;
          crest = max(wave, 0.0) * env;
          vec3 dir = rel / max(dist, 0.0001);
          return center + dir * wave * env * ${fmt(interaction.push * 0.85)};
        }
      `)
    ],
    statements: ({ inputs, outputs }) => dyno.unindentLines(`
      ${outputs.gsplat} = ${inputs.gsplat};
      ${outputs.gsplat}.rgba.rgb = gradeInkSrgb(${outputs.gsplat}.rgba.rgb);
      float inkFade;
      float inkGlow;
      float inkLoosen;
      inkBodyErase(${inputs.gsplat}.center, ${inputs.dissolve}, inkFade, inkGlow, inkLoosen);
      ${outputs.gsplat}.rgba.a *= inkFade;
      ${outputs.gsplat}.scales *= mix(1.0, ${fmt(band.swell)}, inkLoosen);
      float inkCrest;
      ${outputs.gsplat}.center = inkBodyRipple(
        ${outputs.gsplat}.center, ${inputs.hover}, ${inputs.clock}, ${inputs.point}, inkCrest
      );
      ${outputs.gsplat}.rgba.rgb = mix(
        ${outputs.gsplat}.rgba.rgb,
        vec3(${fmt(moon.r)}, ${fmt(moon.g)}, ${fmt(moon.b)}),
        clamp(inkGlow * 0.3 + inkCrest * 0.18, 0.0, 0.5)
      );
    `)
  });

  splat.objectModifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      gsplat = bodyDyno.apply({
        gsplat,
        hover,
        clock: rippleClock,
        point: hitPoint,
        dissolve
      }).gsplat;
      return { gsplat };
    }
  );
  splat.updateGenerator();

  let wasActive = false;
  return {
    update({ elapsed, transitionProgress, hoverStrength, effectPhase, rippleStartAt, hoverRippleActive, hoverPoint }) {
      const rippleActive =
        hoverStrength > 0.004 && (effectPhase === "intact" || effectPhase === "sculpting");
      const strength = rippleActive ? hoverStrength : 0;
      const transitionActive = transitionProgress > 0.0005 && transitionProgress < 0.9995;
      hover.value = strength;
      rippleClock.value = hoverRippleActive ? elapsed - rippleStartAt : 0;
      hitPoint.value.copy(hoverPoint);
      dissolve.value = transitionProgress;
      const active = strength > 0 || transitionActive;
      if (active || wasActive) splat.updateVersion();
      wasActive = active;
    }
  };
}
