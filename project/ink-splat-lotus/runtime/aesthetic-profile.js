// Canonical generated runtime. Edit this file in the skill, then sync consumers.

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function deviceValue(mapping, deviceClass) {
  const value = mapping?.[deviceClass];
  if (value === undefined) throw new Error(`Missing aesthetic quality value for ${deviceClass}`);
  return value;
}

export function createAestheticContext(config, environment = {}) {
  const aesthetic = config.aesthetic;
  const quality = aesthetic?.quality;
  if (!aesthetic || !quality) throw new Error("scene config is missing aesthetic quality logic");
  if (quality.strategy !== "adaptive-record-density") {
    throw new Error(`Unsupported aesthetic quality strategy: ${quality.strategy}`);
  }

  const mediaMobile = environment.mediaMobile ?? window.matchMedia(quality.mobileMediaQuery).matches;
  const maxTouchPoints = environment.maxTouchPoints ?? navigator.maxTouchPoints;
  const touchMobile = quality.touchAsMobile && maxTouchPoints > quality.touchPointsThreshold;
  const deviceClass = mediaMobile || touchMobile ? "mobile" : "desktop";
  const hardware = quality.hardwareScale;
  const memoryGb = Number(environment.deviceMemory ?? navigator.deviceMemory) || hardware.referenceMemoryGb;
  const logicalCores = Number(environment.hardwareConcurrency ?? navigator.hardwareConcurrency)
    || hardware.referenceLogicalCores;
  const memoryScale = memoryGb / hardware.referenceMemoryGb;
  const concurrencyScale = logicalCores / hardware.referenceLogicalCores;
  const capabilityScale = clamp(
    Math.min(memoryScale, concurrencyScale),
    hardware.minimum,
    hardware.maximum
  );

  function particleBudget(recordCount) {
    const density = deviceValue(quality.recordDensity, deviceClass);
    const [minimum, maximum] = deviceValue(quality.particleRange, deviceClass);
    return Math.round(clamp(recordCount * density * capabilityScale, minimum, maximum));
  }

  return {
    name: aesthetic.name,
    principles: aesthetic.principles,
    validation: aesthetic.validation,
    deviceClass,
    isMobile: deviceClass === "mobile",
    capabilityScale,
    particleBudget,
    pixelRatioCap: deviceValue(quality.pixelRatioCap, deviceClass),
    streakAspectCap: deviceValue(quality.streakAspectCap, deviceClass)
  };
}
