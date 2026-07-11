// Canonical generated runtime. Edit this file in the skill, then sync consumers.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const POST_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uRadial: { value: 0 },
    uChromatic: { value: 0 },
    uActivity: { value: 0 },
    uChromaMix: { value: new THREE.Vector2() },
    uRadialRange: { value: new THREE.Vector2(1, 0) },
    uRadialColor: { value: new THREE.Color() },
    uRadialMix: { value: new THREE.Vector2() },
    uVignetteRange: { value: new THREE.Vector2(0, 1) },
    uGrainFramesPerSecond: { value: 1 },
    uBloomAlphaCoverage: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uRadial;
    uniform float uChromatic;
    uniform float uActivity;
    uniform vec2 uChromaMix;
    uniform vec2 uRadialRange;
    uniform vec3 uRadialColor;
    uniform vec2 uRadialMix;
    uniform vec2 uVignetteRange;
    uniform float uGrainFramesPerSecond;
    uniform float uBloomAlphaCoverage;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 delta = vUv - vec2(0.5);
      float chroma = uChromatic * (uChromaMix.x + uActivity * uChromaMix.y);
      vec4 col;
      col.r = texture2D(tDiffuse, vUv + delta * chroma).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - delta * chroma).b;
      col.a = texture2D(tDiffuse, vUv).a;

      float dist = length(delta);
      float glow = smoothstep(uRadialRange.x, uRadialRange.y, dist) * uRadial;
      col.rgb += uRadialColor * glow * (uRadialMix.x + uActivity * uRadialMix.y);
      col.rgb *= 1.0 - smoothstep(uVignetteRange.x, uVignetteRange.y, dist) * uVignette;

      float grain = hash(vUv * vec2(1367.0, 907.0) + floor(uTime * uGrainFramesPerSecond)) - 0.5;
      col.rgb += grain * uGrain;

      float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.a = max(col.a, min(luma, 1.0) * uBloomAlphaCoverage);

      // OutputPass is nonlinear, so convert the premultiplied render target
      // back to straight colour before output conversion.
      float safeAlpha = max(col.a, 0.0015);
      col.rgb = clamp(col.rgb / safeAlpha, 0.0, 8.0);
      gl_FragColor = col;
    }
  `
};

const PREMULT_SHADER = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(texel.rgb * texel.a, texel.a);
    }
  `
};

export function createPostprocessing({ renderer, scene, camera, size, config }) {
  const post = config.postprocessing;
  const style = post.style;
  const composer = new EffectComposer(renderer);
  composer.setSize(size.width, size.height);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.width, size.height),
    post.bloomBaseStrength,
    post.bloomRadius,
    post.bloomThreshold
  );
  // Preserve scene alpha while retaining additive bloom colour.
  const bloomBlend = bloomPass.blendMaterial;
  if (bloomBlend) {
    bloomBlend.blending = THREE.CustomBlending;
    bloomBlend.blendEquation = THREE.AddEquation;
    bloomBlend.blendSrc = THREE.OneFactor;
    bloomBlend.blendDst = THREE.OneFactor;
    bloomBlend.blendEquationAlpha = THREE.AddEquation;
    bloomBlend.blendSrcAlpha = THREE.ZeroFactor;
    bloomBlend.blendDstAlpha = THREE.OneFactor;
  }
  composer.addPass(bloomPass);

  const vfxPass = new ShaderPass(POST_SHADER);
  vfxPass.uniforms.uVignette.value = post.vignette;
  vfxPass.uniforms.uGrain.value = post.filmGrain;
  vfxPass.uniforms.uRadial.value = post.radialGlow;
  vfxPass.uniforms.uChromatic.value = post.chromatic;
  vfxPass.uniforms.uChromaMix.value.set(style.chromaBase, style.chromaActivity);
  vfxPass.uniforms.uRadialRange.value.fromArray(style.radialRange);
  vfxPass.uniforms.uRadialColor.value.set(style.radialColor);
  vfxPass.uniforms.uRadialMix.value.set(style.radialBase, style.radialActivity);
  vfxPass.uniforms.uVignetteRange.value.fromArray(style.vignetteRange);
  vfxPass.uniforms.uGrainFramesPerSecond.value = style.grainFramesPerSecond;
  vfxPass.uniforms.uBloomAlphaCoverage.value = style.bloomAlphaCoverage;
  composer.addPass(vfxPass);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(PREMULT_SHADER));
  return { composer, bloomPass, vfxPass };
}
