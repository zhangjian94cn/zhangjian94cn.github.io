// Canonical generated runtime. Edit this file in the skill, then sync consumers.
// Relative runtime imports carry the runtime version so long-cached static
// hosting picks up synced runtime updates atomically.
import { createGaussianSplatExperience } from "./experience.js?v=0.3.0";

let experience = null;

try {
  experience = await createGaussianSplatExperience();
  window.__splatExperience = experience;
  window.__splatExperienceState = () => experience?.getState() ?? null;
  Object.defineProperty(window, "__splatExperienceReady", {
    configurable: true,
    get: () => Boolean(experience?.getState()?.ready)
  });
} catch (error) {
  console.error("Unable to bootstrap Gaussian Splat experience", error);
  window.__splatExperienceState = () => ({
    ready: false,
    bootPhase: "bootstrap-error",
    error: error.message
  });
}
