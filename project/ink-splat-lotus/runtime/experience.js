import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh, dyno } from "@sparkjsdev/spark";
import { createAestheticContext } from "./aesthetic-profile.js?v=0.3.0";
import { createPostprocessing } from "./postprocessing.js?v=0.3.0";
import { createSplatBodyModifier, createSplatParticleLayer } from "./splat-vfx.js?v=0.3.0";

let rootEl;
let loadingEl;
let loadingLabel;
let fallbackEl;
let fallbackVideo;
let retryButton;
let modeButtons = [];
let stageEl;
let configUrl = "scene.json";
let runtimeAbortController;
let activeExperience;
let experienceReady = false;

let isMobile = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const tmpColor = new THREE.Color();

let sceneConfig;
let aestheticContext;
let scene;
let camera;
let renderer;
let composer;
let bloomPass;
let vfxPass;
let controls;
let splat;
let splatRoot;
let particlePoints;
let particleMaterial;
let activeMode = "calm";
let effectPhase = "intact";
let transitionProgress = 0;
let progressTransition = null;
let loaded = false;
let renderStarted = false;
let assetLoaded = false;
let isSculpting = false;
let hoverTarget = 0;
let hoverStrength = 0;
let lastHoverAt = -Infinity;
let lastHoverRaycastAt = -Infinity;
let passiveHoverTimer = null;
let pendingHoverPointer = null;
let defaultView;
let visualCenterLocal;
const visualCenterWorld = new THREE.Vector3();
let subjectRadius = 0;
let requestedParticleBudget = 0;
let bootPhase = "boot";
let bootError = null;
const pointerVelocityTarget = new THREE.Vector3();
const pointerVelocitySmoothed = new THREE.Vector3();
const lastHitLocal = new THREE.Vector3();
let hasLastHit = false;
let lastHitAt = 0;
let pointerSpeed = 0;
let rippleStartAt = 0;
let hoverRippleActive = false;
let sparkleStartAt = -Infinity;
let sparkleValue = 0;
let entrancePending = false;
let entranceStarted = false;
let particlesReady = false;
let particlesFailed = false;
let bodyVfx = null;

function getState() {
  return {
  ready: experienceReady,
  bootPhase,
  error: bootError,
  activeMode,
  phase: effectPhase,
  progress: transitionProgress,
  particleCount: particlePoints?.userData?.particleCount || 0,
  fallbackHidden: fallbackEl.hidden,
  canvasCount: rootEl.querySelectorAll("canvas").length,
  visualCenter: visualCenterWorld.toArray(),
  targetDistance: controls ? controls.target.distanceTo(visualCenterWorld) : null,
  targetErrorRatio: controls && subjectRadius > 0
    ? controls.target.distanceTo(visualCenterWorld) / subjectRadius
    : null,
  splatVisible: splat?.visible ?? null,
  splatOpacity: splat?.opacity ?? null,
  particleVisible: particlePoints?.visible ?? null,
  particleOpacity: particleMaterial?.uniforms?.uOpacity?.value ?? null,
  hover: hoverStrength,
  hoverTarget,
  hoverMode: isSculpting ? "sculpt" : hoverStrength > 0.02 ? "passive" : "idle",
  hoverPoint: particleMaterial?.uniforms?.uHoverPoint?.value?.toArray?.() ?? null,
  pointerSpeed,
  sparkle: sparkleValue,
  entrance: { pending: entrancePending, started: entranceStarted },
  aesthetic: aestheticContext ? {
    profile: aestheticContext.name,
    deviceClass: aestheticContext.deviceClass,
    qualityStrategy: sceneConfig.aesthetic.quality.strategy,
    capabilityScale: aestheticContext.capabilityScale,
    requestedParticleBudget,
    subjectRadius,
    principles: aestheticContext.principles,
    validation: aestheticContext.validation
  } : null,
  colorPipeline: {
    sparkLinear: true,
    toneMapping: "none",
    gradeEnabled: sceneConfig?.grade?.enabled ?? null,
    exposure: renderer?.toneMappingExposure ?? null
  }
  };
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smooth01(value) {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function hasWebGL2() {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2"));
}

function applyVector(target, values) {
  if (!values) return;
  target.set(values[0] || 0, values[1] || 0, values[2] || 0);
}

function sceneSize() {
  const rect = rootEl.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width || window.innerWidth)),
    height: Math.max(1, Math.floor(rect.height || window.innerHeight))
  };
}

async function loadConfig() {
  const response = await fetch(configUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load scene config: ${response.status}`);
  return response.json();
}

function setStageMode() {
  if (stageEl) stageEl.dataset.vfxMode = effectPhase;
  modeButtons.forEach((button) => {
    const mode = button.dataset.splatMode;
    const buttonMode = mode === "reset" ? "calm" : mode;
    button.classList.toggle("is-active", buttonMode === activeMode && mode !== "reset");
  });
}

function revealSceneLayers() {
  if (splat) splat.visible = true;
  if (particlePoints) particlePoints.visible = true;
  if (particleMaterial) particleMaterial.uniforms.uOpacity.value = 1;
}

function clampEmptyState() {
  transitionProgress = 1;
  progressTransition = null;
  effectPhase = "empty";
  if (splat) {
    splat.opacity = 0;
    splat.visible = false;
  }
  if (particlePoints) particlePoints.visible = false;
  if (particleMaterial) particleMaterial.uniforms.uOpacity.value = 0;
  clearHover(true);
  setStageMode();
}

function resetEffectState() {
  progressTransition = null;
  transitionProgress = 0;
  activeMode = "calm";
  effectPhase = "intact";
  revealSceneLayers();
  if (splat) {
    splat.opacity = 1;
    splat.recolor?.setRGB?.(1, 1, 1);
  }
  clearHover(true);
  setStageMode();
}

function beginProgressTransition(target, duration, phase) {
  revealSceneLayers();
  progressTransition = {
    from: transitionProgress,
    to: target,
    startedAt: clock.getElapsedTime(),
    duration: Math.max(duration, 0.01)
  };
  effectPhase = phase;
  setStageMode();
}

function applyEntranceBootState() {
  progressTransition = null;
  transitionProgress = 1;
  activeMode = "calm";
  effectPhase = "empty";
  if (splat) {
    splat.visible = true;
    splat.opacity = 0;
  }
  if (particlePoints) particlePoints.visible = true;
  if (particleMaterial) particleMaterial.uniforms.uOpacity.value = 1;
  clearHover(true);
  setStageMode();
}

function maybeStartEntrance() {
  if (!entrancePending || entranceStarted || !loaded) return;
  if (!particlesReady && !particlesFailed) return;
  entranceStarted = true;
  entrancePending = false;
  if (particlesFailed || !particleMaterial) {
    transitionProgress = 0;
    effectPhase = "intact";
    revealSceneLayers();
    setStageMode();
    return;
  }
  window.setTimeout(() => {
    if (effectPhase !== "empty" || progressTransition) return;
    activeMode = "calm";
    beginProgressTransition(0, sceneConfig.entrance.duration, "reforming");
  }, Math.max(0, sceneConfig.entrance.delay * 1000));
}

function setMode(mode) {
  if (!sceneConfig) return;
  if (mode === "reset") {
    resetEffectState();
    resetCamera();
    return;
  }

  if (mode === "dissolve") {
    activeMode = "dissolve";
    const remaining = Math.max(0.01, 1 - transitionProgress);
    beginProgressTransition(1, sceneConfig.dissolve.duration * remaining, "dissolving");
  } else if (mode === "reform" || mode === "calm") {
    activeMode = mode;
    if (transitionProgress <= 0.001) {
      transitionProgress = 0;
      effectPhase = "intact";
      revealSceneLayers();
      setStageMode();
    } else {
      beginProgressTransition(0, sceneConfig.dissolve.reformDuration * transitionProgress, "reforming");
    }
  } else if (mode === "sculpt") {
    activeMode = "sculpt";
    transitionProgress = 0;
    progressTransition = null;
    effectPhase = "sculpting";
    revealSceneLayers();
    setStageMode();
  }

  if (controls) controls.enabled = activeMode !== "sculpt";
}

function showFallback(message) {
  if (sceneConfig?.assets?.preview) fallbackVideo.src = sceneConfig.assets.preview;
  fallbackEl.hidden = false;
  loadingEl.style.display = "none";
  bootPhase = "fallback";
  bootError = message || null;
  if (message) console.warn(message);
}

function hideFallback() {
  fallbackEl.hidden = true;
  fallbackVideo.removeAttribute("src");
  fallbackVideo.load();
}

function applyCameraComposition(size = sceneSize()) {
  if (!camera || !sceneConfig) return;
  camera.clearViewOffset();
  const ratio = isMobile
    ? sceneConfig.composition.mobileViewOffsetX
    : sceneConfig.composition.desktopViewOffsetX;
  if (Math.abs(ratio) > 0.0001) {
    camera.setViewOffset(size.width, size.height, Math.round(size.width * ratio), 0, size.width, size.height);
  }
  camera.updateProjectionMatrix();
}

function captureDefaultView() {
  if (!camera || !controls) return;
  defaultView = {
    cameraPosition: camera.position.clone(),
    target: controls.target.clone(),
    fov: camera.fov,
    near: camera.near,
    far: camera.far
  };
}

function resetCamera() {
  if (!camera || !controls || !sceneConfig) return;
  if (defaultView) {
    camera.position.copy(defaultView.cameraPosition);
    controls.target.copy(defaultView.target);
    camera.fov = defaultView.fov;
    camera.near = defaultView.near;
    camera.far = defaultView.far;
  } else {
    applyVector(camera.position, sceneConfig.camera.position);
    applyVector(controls.target, sceneConfig.camera.target);
    camera.fov = sceneConfig.camera.fov;
    camera.near = sceneConfig.camera.near;
    camera.far = sceneConfig.camera.far;
  }
  applyCameraComposition();
  controls.update();
}

function updateVisualCenterWorld(fallbackCenter) {
  if (splat && visualCenterLocal) {
    splat.updateWorldMatrix(true, false);
    visualCenterWorld.copy(splat.localToWorld(visualCenterLocal.clone()));
  } else if (fallbackCenter) {
    visualCenterWorld.copy(fallbackCenter);
  }
  return visualCenterWorld;
}

function frameObjectOnce() {
  if (!splatRoot || !camera || !controls || loaded) return;
  const box = new THREE.Box3().setFromObject(splatRoot);
  if (box.isEmpty() || !Number.isFinite(box.min.x)) {
    if (assetLoaded) loadingLabel.textContent = "Preparing splat view";
    return;
  }

  const boxCenter = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(boxCenter);
  box.getSize(size);
  const center = updateVisualCenterWorld(boxCenter);
  const framing = sceneConfig.composition.framing;
  const radius = Math.max(size.x, size.y, size.z, framing.minimumRadius);
  subjectRadius = radius;
  const zOffset = radius * framing.distanceScale[aestheticContext.deviceClass];
  controls.target.copy(center);
  camera.position.set(
    center.x,
    center.y + radius * framing.verticalOffsetRatio,
    center.z + zOffset
  );
  camera.near = Math.max(radius / framing.nearRadiusDivisor, framing.nearFloor);
  camera.far = Math.max(radius * framing.farRadiusMultiplier, framing.farFloor);
  applyCameraComposition();
  controls.update();
  captureDefaultView();
  loaded = true;
  loadingEl.style.display = "none";
  experienceReady = true;
  maybeStartEntrance();
}

function finishLoadingWithDefaultCamera() {
  if (loaded || !assetLoaded) return;
  updateVisualCenterWorld(controls.target);
  controls.target.copy(visualCenterWorld);
  applyCameraComposition();
  controls.update();
  captureDefaultView();
  loaded = true;
  loadingEl.style.display = "none";
  experienceReady = true;
  maybeStartEntrance();
}

function setupComposer(size) {
  const postprocessing = createPostprocessing({
    renderer,
    scene,
    camera,
    size,
    config: sceneConfig
  });
  composer = postprocessing.composer;
  bloomPass = postprocessing.bloomPass;
  vfxPass = postprocessing.vfxPass;
}

function updateBodyFx(elapsed) {
  if (!bodyVfx || !particleMaterial) return;
  bodyVfx.update({
    elapsed,
    transitionProgress,
    hoverStrength,
    effectPhase,
    rippleStartAt,
    hoverRippleActive,
    hoverPoint: particleMaterial.uniforms.uHoverPoint.value
  });
}

function clearHover(immediate = false) {
  hoverTarget = 0;
  isSculpting = false;
  lastHoverAt = -Infinity;
  pendingHoverPointer = null;
  hasLastHit = false;
  pointerVelocityTarget.set(0, 0, 0);
  if (passiveHoverTimer !== null) {
    window.clearTimeout(passiveHoverTimer);
    passiveHoverTimer = null;
  }
  if (stageEl) delete stageEl.dataset.hoverActive;
  if (immediate === true) {
    hoverStrength = 0;
    hoverRippleActive = false;
    pointerSpeed = 0;
    pointerVelocitySmoothed.set(0, 0, 0);
    if (particleMaterial) {
      particleMaterial.uniforms.uHover.value = 0;
      particleMaterial.uniforms.uPointerSpeed.value = 0;
      particleMaterial.uniforms.uPointerVelocity.value.set(0, 0, 0);
    }
  }
}

function pointerEventToSplatLocal(event) {
  if (!renderer || !camera || !splat?.visible) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(splat, false);
  if (!hits.length) return null;
  return splat.worldToLocal(hits[0].point.clone());
}

function updateHoverFromPointer(event, force = false) {
  const passiveHover = activeMode === "calm" && effectPhase === "intact";
  const sculptHover = activeMode === "sculpt";
  if ((!passiveHover && !sculptHover) || !particleMaterial) return;
  const localPoint = pointerEventToSplatLocal(event);
  if (!localPoint) {
    hoverTarget = 0;
    hasLastHit = false;
    if (stageEl) delete stageEl.dataset.hoverActive;
    return;
  }
  if (stageEl) stageEl.dataset.hoverActive = "true";
  const hitTime = clock.getElapsedTime();
  if (hasLastHit) {
    const hitDelta = Math.max(hitTime - lastHitAt, 0.001);
    pointerVelocityTarget.copy(localPoint).sub(lastHitLocal).divideScalar(hitDelta);
    const velocityLimit = sceneConfig.interaction.pointerVelocityLimit;
    if (pointerVelocityTarget.length() > velocityLimit) pointerVelocityTarget.setLength(velocityLimit);
  }
  lastHitLocal.copy(localPoint);
  lastHitAt = hitTime;
  hasLastHit = true;
  const response = sceneConfig.interaction.response;
  particleMaterial.uniforms.uHoverPoint.value.lerp(
    localPoint,
    force ? 1 : response.hoverPointLerp
  );
  if (sculptHover) {
    hoverTarget = force
      ? sceneConfig.interaction.sculptStrength
      : sceneConfig.interaction.sculptStrength * response.sculptDragStrength;
  } else {
    hoverTarget = sceneConfig.interaction.passiveStrength;
  }
  hoverStrength = Math.max(
    hoverStrength,
    hoverTarget * (force ? response.forceInitialStrength : response.moveInitialStrength)
  );
  lastHoverAt = clock.getElapsedTime();
}

function updatePassiveHoverFromPointer(event) {
  if (activeMode !== "calm" || effectPhase !== "intact" || isMobile) return;
  pendingHoverPointer = { clientX: event.clientX, clientY: event.clientY };
  const now = performance.now();
  const remaining = sceneConfig.interaction.raycastIntervalMs - (now - lastHoverRaycastAt);
  if (remaining <= 0) {
    lastHoverRaycastAt = now;
    const pointer = pendingHoverPointer;
    pendingHoverPointer = null;
    updateHoverFromPointer(pointer);
    return;
  }
  if (passiveHoverTimer !== null) return;
  passiveHoverTimer = window.setTimeout(() => {
    passiveHoverTimer = null;
    if (!pendingHoverPointer) return;
    const pointer = pendingHoverPointer;
    pendingHoverPointer = null;
    lastHoverRaycastAt = performance.now();
    updateHoverFromPointer(pointer);
  }, remaining);
}

function updateTransition(elapsed) {
  if (!progressTransition) return;
  const raw = clamp01((elapsed - progressTransition.startedAt) / progressTransition.duration);
  transitionProgress = THREE.MathUtils.lerp(
    progressTransition.from,
    progressTransition.to,
    smooth01(raw)
  );
  if (raw < 1) return;

  const target = progressTransition.to;
  const finishedPhase = effectPhase;
  progressTransition = null;
  transitionProgress = target;
  if (target >= sceneConfig.dissolve.terminalThreshold) {
    clampEmptyState();
  } else {
    if (finishedPhase === "reforming" && target <= 0.001) {
      sparkleStartAt = elapsed;
    }
    effectPhase = activeMode === "sculpt" ? "sculpting" : "intact";
    if (activeMode === "reform") activeMode = "calm";
    revealSceneLayers();
    if (splat) splat.opacity = 1;
    setStageMode();
  }
}

function sparkleEnvelope(elapsed) {
  const cfg = sceneConfig.sparkle;
  const t = elapsed - sparkleStartAt;
  if (t < 0 || t > cfg.attack + cfg.decay) return 0;
  if (t < cfg.attack) return smooth01(t / cfg.attack) * cfg.peak;
  return cfg.peak * (1 - smooth01((t - cfg.attack) / cfg.decay));
}

function updateHover(elapsed, delta) {
  const response = sceneConfig.interaction.response;
  const hoverModeActive = activeMode === "sculpt" || (activeMode === "calm" && effectPhase === "intact");
  if (!hoverModeActive || elapsed - lastHoverAt > sceneConfig.interaction.recovery) {
    hoverTarget = 0;
  }
  const lambda = 5 / Math.max(sceneConfig.interaction.recovery, 0.1);
  hoverStrength = THREE.MathUtils.damp(hoverStrength, hoverTarget, lambda, delta);

  if (hoverStrength > response.activationThreshold && !hoverRippleActive) {
    hoverRippleActive = true;
    rippleStartAt = elapsed;
  } else if (hoverStrength <= response.activationThreshold && hoverRippleActive) {
    hoverRippleActive = false;
  }

  if (elapsed - lastHitAt > response.velocityIdleSeconds) {
    pointerVelocityTarget.multiplyScalar(Math.exp(-delta * response.velocityDecay));
  }
  const velocityLambda = hoverTarget > 0
    ? response.velocityDampingActive
    : response.velocityDampingIdle;
  pointerVelocitySmoothed.set(
    THREE.MathUtils.damp(pointerVelocitySmoothed.x, pointerVelocityTarget.x, velocityLambda, delta),
    THREE.MathUtils.damp(pointerVelocitySmoothed.y, pointerVelocityTarget.y, velocityLambda, delta),
    THREE.MathUtils.damp(pointerVelocitySmoothed.z, pointerVelocityTarget.z, velocityLambda, delta)
  );
  const velocityLimit = Math.max(sceneConfig.interaction.pointerVelocityLimit, 0.001);
  pointerSpeed = THREE.MathUtils.damp(
    pointerSpeed,
    clamp01(pointerVelocitySmoothed.length() / velocityLimit),
    response.pointerSpeedDamping,
    delta
  );
}

function updateSplat(elapsed, delta) {
  if (!splat) return;
  const dissolve = sceneConfig.dissolve;
  const body = sceneConfig.effects.body;
  const bodyFade = smooth01(
    (transitionProgress - dissolve.bodyFadeStart) /
      Math.max(0.001, dissolve.bodyFadeEnd - dissolve.bodyFadeStart)
  );
  const breathe = effectPhase === "intact"
    ? Math.sin(elapsed * body.breatheFrequency) * body.breatheAmplitude
    : 0;
  const targetOpacity = clamp01(1 - bodyFade + breathe);
  splat.opacity = THREE.MathUtils.damp(splat.opacity ?? 1, targetOpacity, body.opacityDamping, delta);
  tmpColor.setRGB(
    1,
    1 - hoverStrength * body.hoverTintGreen,
    1 - hoverStrength * body.hoverTintBlue
  );
  splat.recolor?.lerp?.(tmpColor, body.recolorLerp);
}

function updateParticles(elapsed) {
  sparkleValue = sceneConfig ? sparkleEnvelope(elapsed) : 0;
  if (!particleMaterial) return;
  const uniforms = particleMaterial.uniforms;
  uniforms.uTime.value = elapsed;
  uniforms.uHover.value = hoverStrength;
  uniforms.uDissolve.value = transitionProgress;
  uniforms.uSparkle.value = sparkleValue;
  uniforms.uGlowScale.value = effectPhase === "reforming"
    ? sceneConfig.effects.body.reformGlowScale
    : 1;
  uniforms.uRippleClock.value = hoverRippleActive ? elapsed - rippleStartAt : 0;
  uniforms.uPointerVelocity.value.copy(pointerVelocitySmoothed);
  uniforms.uPointerSpeed.value = pointerSpeed;
}

function updatePostprocessing(elapsed) {
  const post = sceneConfig.postprocessing;
  const activityWeights = post.activityWeights;
  const transitionEnergy = Math.sin(Math.PI * clamp01(transitionProgress));
  const activity = Math.max(
    transitionEnergy * activityWeights.transition,
    hoverStrength * activityWeights.hover,
    sparkleValue * activityWeights.sparkle
  );
  if (bloomPass) {
    bloomPass.strength = THREE.MathUtils.lerp(
      post.bloomBaseStrength,
      post.bloomActiveStrength,
      activity
    );
    bloomPass.radius = post.bloomRadius;
    bloomPass.threshold = post.bloomThreshold;
  }
  if (vfxPass) {
    vfxPass.uniforms.uTime.value = elapsed;
    vfxPass.uniforms.uActivity.value = activity;
  }
}

function updateFrame() {
  const delta = Math.min(clock.getDelta(), sceneConfig.runtime.maxFrameDeltaSeconds);
  const elapsed = clock.elapsedTime;

  updateTransition(elapsed);
  updateHover(elapsed, delta);
  updateSplat(elapsed, delta);
  updateParticles(elapsed);
  updateBodyFx(elapsed);
  updatePostprocessing(elapsed);

  if (controls) {
    controls.enabled = activeMode !== "sculpt";
    controls.enableRotate = activeMode !== "sculpt";
    controls.autoRotate =
      !reducedMotion &&
      activeMode === "calm" &&
      effectPhase === "intact" &&
      hoverStrength < sceneConfig.effects.hoverPauseStrength;
    controls.autoRotateSpeed = sceneConfig.effects.autoRotateSpeed;
    controls.update();
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

async function attachParticles(splatUrl) {
  try {
    loadingLabel.textContent = "Sampling splat particles";
    bootPhase = "particles";
    const layer = await createSplatParticleLayer({
      splatUrl,
      config: sceneConfig,
      aestheticContext
    });
    particlePoints = layer.points;
    particleMaterial = layer.material;
    visualCenterLocal = layer.visualCenterLocal;
    requestedParticleBudget = layer.requestedParticleBudget;
    splat.add(particlePoints);
    updateVisualCenterWorld();
    if (loaded && controls) {
      const centerDelta = visualCenterWorld.clone().sub(controls.target);
      controls.target.copy(visualCenterWorld);
      camera.position.add(centerDelta);
      controls.update();
      captureDefaultView();
    }
    particlesReady = true;
    try {
      bodyVfx = createSplatBodyModifier({
        splat,
        dyno,
        config: sceneConfig,
        fieldInfo: layer.fieldInfo
      });
    } catch (modifierError) {
      console.warn("Body modifier disabled", modifierError);
      bodyVfx = null;
    }
  } catch (error) {
    console.warn("Splat particle layer disabled", error);
    particlesFailed = true;
  }
  maybeStartEntrance();
}

async function initScene() {
  bootPhase = "config";
  sceneConfig = await loadConfig();
  aestheticContext = createAestheticContext(sceneConfig);
  isMobile = aestheticContext.isMobile;
  // The preview video is a heavy asset: it is only assigned in showFallback()
  // so a healthy load never downloads it.

  if (!hasWebGL2()) {
    showFallback("WebGL2 unavailable");
    return;
  }

  hideFallback();
  loadingEl.style.display = "inline-flex";
  loadingLabel.textContent = "Loading Gaussian Splat";
  bootPhase = "scene";

  const splatUrl = sceneConfig.assets.splat || sceneConfig.assets.ply;
  if (!splatUrl) {
    showFallback("No readable splat asset");
    return;
  }

  scene = new THREE.Scene();
  const size = sceneSize();
  camera = new THREE.PerspectiveCamera(
    sceneConfig.camera.fov,
    size.width / size.height,
    sceneConfig.camera.near,
    sceneConfig.camera.far
  );
  applyVector(camera.position, sceneConfig.camera.position);
  if (isMobile) applyVector(camera.position, sceneConfig.composition.mobileCameraPosition);

  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = sceneConfig.postprocessing.exposure;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, aestheticContext.pixelRatioCap));
  renderer.setSize(size.width, size.height);
  renderer.setClearColor(0x000000, 0);
  rootEl.replaceChildren(renderer.domElement);

  const spark = new SparkRenderer({
    renderer,
    focalAdjustment: sceneConfig.runtime.sparkFocalAdjustment,
    encodeLinear: true
  });
  scene.add(spark);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = sceneConfig.effects.dampingFactor;
  [controls.minDistance, controls.maxDistance] = sceneConfig.effects.distanceRange;
  controls.minPolarAngle = Math.PI * sceneConfig.effects.polarRange[0];
  controls.maxPolarAngle = Math.PI * sceneConfig.effects.polarRange[1];
  controls.enablePan = false;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = sceneConfig.effects.autoRotateSpeed;
  applyVector(controls.target, sceneConfig.camera.target);
  if (isMobile) applyVector(controls.target, sceneConfig.composition.mobileInitialTarget);

  splatRoot = new THREE.Group();
  applyVector(splatRoot.position, sceneConfig.model.position);
  splatRoot.scale.setScalar(sceneConfig.model.scale || 1);
  applyVector(splatRoot.rotation, sceneConfig.model.rootRotation);
  scene.add(splatRoot);

  splat = new SplatMesh({
    url: splatUrl,
    lod: false,
    raycastable: true,
    minRaycastOpacity: sceneConfig.runtime.minRaycastOpacity,
    onProgress: (event) => {
      if (event.total) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        loadingLabel.textContent = `Loading Gaussian Splat ${pct}%`;
      }
    },
    onLoad: () => {
      assetLoaded = true;
      bootPhase = "loaded";
      loadingLabel.textContent = "Framing scene";
      setTimeout(frameObjectOnce, sceneConfig.runtime.loading.frameDelayMs);
      setTimeout(
        finishLoadingWithDefaultCamera,
        sceneConfig.runtime.loading.fallbackFrameDelayMs
      );
    },
    onError: (error) => {
      if (sceneConfig.assets.ply && splatUrl !== sceneConfig.assets.ply) {
        console.warn("SPLAT load failed, PLY fallback is available but not hot-swapped", error);
      }
      showFallback("Unable to load splat asset");
    }
  });
  applyVector(splat.rotation, sceneConfig.model.splatRotation);
  splatRoot.add(splat);

  applyCameraComposition(size);
  setupComposer(size);
  if (sceneConfig.assets.splat) attachParticles(sceneConfig.assets.splat);
  entrancePending = Boolean(sceneConfig.entrance?.enabled) && !reducedMotion && Boolean(sceneConfig.assets.splat);
  if (entrancePending) {
    applyEntranceBootState();
    window.setTimeout(() => {
      if (entrancePending && !entranceStarted && !particlesReady) {
        particlesFailed = true;
        maybeStartEntrance();
      }
    }, sceneConfig.runtime.loading.particleTimeoutMs);
  } else {
    resetEffectState();
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (activeMode !== "sculpt") return;
    isSculpting = true;
    try {
      renderer.domElement.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic validation events do not always have an active capture target.
    }
    updateHoverFromPointer(event, true);
  }, { signal: runtimeAbortController.signal });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (activeMode === "sculpt" && (isSculpting || isMobile)) {
      updateHoverFromPointer(event);
    } else {
      updatePassiveHoverFromPointer(event);
    }
  }, { signal: runtimeAbortController.signal });
  renderer.domElement.addEventListener("pointerup", (event) => {
    isSculpting = false;
    hoverTarget = 0;
    try {
      renderer.domElement.releasePointerCapture?.(event.pointerId);
    } catch {
      // See pointerdown capture guard.
    }
  }, { signal: runtimeAbortController.signal });
  renderer.domElement.addEventListener("pointercancel", () => clearHover(), {
    signal: runtimeAbortController.signal
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    if (!isSculpting) clearHover();
  }, { signal: runtimeAbortController.signal });

  if (!renderStarted) {
    renderStarted = true;
    renderer.setAnimationLoop(updateFrame);
  }

  setTimeout(() => {
    if (!loaded && assetLoaded) frameObjectOnce();
    else if (!loaded) loadingLabel.textContent = "Still loading Gaussian Splat";
  }, sceneConfig.runtime.loading.statusTimeoutMs);
}

function resize() {
  if (!camera || !renderer) return;
  const size = sceneSize();
  camera.aspect = size.width / size.height;
  applyCameraComposition(size);
  renderer.setSize(size.width, size.height);
  if (composer) composer.setSize(size.width, size.height);
}

function requireElement(value, name) {
  if (!value) throw new Error(`Missing Gaussian Splat DOM hook: ${name}`);
  return value;
}

function destroyExperience() {
  runtimeAbortController?.abort();
  runtimeAbortController = null;
  if (passiveHoverTimer !== null) window.clearTimeout(passiveHoverTimer);
  passiveHoverTimer = null;
  renderer?.setAnimationLoop(null);
  controls?.dispose?.();
  particlePoints?.geometry?.dispose?.();
  particleMaterial?.dispose?.();
  composer?.dispose?.();
  renderer?.dispose?.();
  rootEl?.replaceChildren();
  experienceReady = false;
  renderStarted = false;
  activeExperience = null;
}

export async function createGaussianSplatExperience(options = {}) {
  if (activeExperience) return activeExperience;

  stageEl = requireElement(options.stage || document.querySelector("[data-splat-stage]"), "stage");
  rootEl = requireElement(options.root || stageEl.querySelector("[data-splat-root]"), "root");
  loadingEl = requireElement(
    options.loading || stageEl.querySelector("[data-splat-loading]"),
    "loading"
  );
  loadingLabel = requireElement(
    options.loadingLabel || stageEl.querySelector("[data-splat-loading-label]"),
    "loading label"
  );
  fallbackEl = requireElement(
    options.fallback || stageEl.querySelector("[data-splat-fallback]"),
    "fallback"
  );
  fallbackVideo = requireElement(
    options.fallbackVideo || stageEl.querySelector("[data-splat-fallback-video]"),
    "fallback video"
  );
  retryButton = requireElement(
    options.retryButton || stageEl.querySelector("[data-splat-retry]"),
    "retry button"
  );
  modeButtons = [
    ...(options.modeButtons || stageEl.querySelectorAll("[data-splat-mode]"))
  ];
  configUrl = options.configUrl || stageEl.dataset.splatConfig || "scene.json";
  runtimeAbortController = new AbortController();

  const modes = new Set(modeButtons.map((button) => button.dataset.splatMode));
  for (const mode of ["calm", "dissolve", "sculpt", "reform", "reset"]) {
    if (!modes.has(mode)) throw new Error(`Missing Gaussian Splat mode control: ${mode}`);
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.splatMode), {
      signal: runtimeAbortController.signal
    });
  });
  retryButton.addEventListener("click", () => {
    hideFallback();
    initScene().catch((error) => {
      console.error(error);
      bootError = error.message;
      showFallback(error.message);
    });
  }, { signal: runtimeAbortController.signal });
  window.addEventListener("resize", resize, { signal: runtimeAbortController.signal });

  activeExperience = {
    setMode,
    getState,
    reset: () => setMode("reset"),
    resize,
    destroy: destroyExperience
  };

  try {
    await initScene();
  } catch (error) {
    console.error(error);
    bootError = error.message;
    showFallback(error.message);
  }
  return activeExperience;
}
