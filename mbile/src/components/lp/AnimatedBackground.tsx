import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/app-store";

type LayerIndex = 0 | 1 | 2 | 3 | 4;

type SmokeRibbon = {
  seed: number;
  layer: LayerIndex;
  side: -1 | 1;
  startOffset: number;
  spread: number;
  lift: number;
  width: number;
  alpha: number;
  curl: number;
  speed: number;
  phase: number;
  branch: number;
};

type SmokeCurl = {
  seed: number;
  layer: LayerIndex;
  side: -1 | 1;
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  phase: number;
};

const layers = [
  { count: 18, alpha: 0.27, width: 5.4, spread: 0.28, blur: 4.5, speed: 0.13 },
  { count: 20, alpha: 0.2, width: 4.4, spread: 0.38, blur: 6, speed: 0.11 },
  { count: 22, alpha: 0.15, width: 3.6, spread: 0.48, blur: 8, speed: 0.09 },
  { count: 18, alpha: 0.1, width: 2.9, spread: 0.58, blur: 10, speed: 0.075 },
  { count: 14, alpha: 0.07, width: 2.2, spread: 0.68, blur: 13, speed: 0.06 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function lifecycle(value: number) {
  const fadeIn = smoothstep(value / 0.18);
  const fadeOut = 1 - smoothstep((value - 0.72) / 0.28);
  return fadeIn * fadeOut;
}

function makeRibbons() {
  const ribbons: SmokeRibbon[] = [];
  layers.forEach((layer, layerIndex) => {
    for (let index = 0; index < layer.count; index += 1) {
      const seed = (index + 1) * (layerIndex + 1.731);
      const side = Math.sin(seed * 2.7) < 0 ? -1 : 1;
      ribbons.push({
        seed,
        layer: layerIndex as LayerIndex,
        side,
        startOffset: Math.sin(seed) * 18,
        spread: layer.spread * (0.82 + (index % 7) * 0.055),
        lift: 0.72 + layerIndex * 0.05 + (index % 5) * 0.025,
        width: layer.width * (0.82 + (index % 6) * 0.08),
        alpha: layer.alpha * (0.82 + (index % 5) * 0.06),
        curl: 0.7 + (index % 8) * 0.17,
        speed: layer.speed * (0.86 + (index % 5) * 0.055),
        phase: seed * 3.41,
        branch: 0.26 + (index % 6) * 0.07,
      });
    }
  });
  return ribbons;
}

function makeCurls() {
  const curls: SmokeCurl[] = [];
  layers.forEach((layer, layerIndex) => {
    const count = layerIndex < 2 ? 8 : 10;
    for (let index = 0; index < count; index += 1) {
      const seed = (index + 3.5) * (layerIndex + 2.29);
      curls.push({
        seed,
        layer: layerIndex as LayerIndex,
        side: Math.sin(seed) < 0 ? -1 : 1,
        x: 0.12 + ((index * 0.17 + layerIndex * 0.09) % 0.76),
        y: 0.08 + ((index * 0.13 + layerIndex * 0.11) % 0.72),
        radius: 34 + layerIndex * 18 + (index % 5) * 12,
        alpha: layer.alpha * 0.46,
        speed: layer.speed * (0.7 + index * 0.018),
        phase: seed * 2.13,
      });
    }
  });
  return curls;
}

function drawRibbon(
  context: CanvasRenderingContext2D,
  ribbon: SmokeRibbon,
  width: number,
  height: number,
  time: number,
  wind: number,
  tilt: number,
  density: number,
) {
  const layer = layers[ribbon.layer];
  const progress = (time * ribbon.speed + ribbon.phase) % 1;
  const visible = lifecycle(progress);
  if (visible <= 0.015) {
    return;
  }

  const centerX = width * 0.5;
  const sourceY = height + 150;
  const sourceX = centerX + ribbon.startOffset;
  const maxSpread = width * ribbon.spread;
  const rise = height * ribbon.lift;
  const ageLift = progress * height * 0.16;
  const branchSide = progress > ribbon.branch ? ribbon.side : ribbon.side * 0.35;
  const branch = smoothstep((progress - ribbon.branch) / 0.45);
  const heightInfluence = (value: number) => smoothstep(value) * (wind + tilt);

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = `blur(${layer.blur}px)`;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha = visible;

  const segmentCount = 9;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const t0 = segment / segmentCount;
    const t1 = (segment + 1) / segmentCount;
    const tm = (t0 + t1) * 0.5;
    const localFade = Math.sin(Math.PI * tm) * (1 - smoothstep((tm - 0.82) / 0.18));
    const alpha = ribbon.alpha * localFade * density;

    if (alpha <= 0.004) {
      continue;
    }

    const x0 = sourceX + branchSide * maxSpread * smoothstep(t0) * (0.18 + branch * 0.82);
    const x1 = sourceX + branchSide * maxSpread * smoothstep(t1) * (0.18 + branch * 0.82);
    const y0 = sourceY - rise * t0 - ageLift;
    const y1 = sourceY - rise * t1 - ageLift;
    const curl0 =
      Math.sin(time * (1.6 + ribbon.curl * 0.22) + ribbon.phase + t0 * 7.2) * 46 * tm +
      Math.cos(time * (0.9 + ribbon.curl * 0.16) + ribbon.seed + t0 * 4.8) * 28 * smoothstep(t0);
    const curl1 =
      Math.sin(time * (1.6 + ribbon.curl * 0.22) + ribbon.phase + t1 * 7.2) * 46 * tm +
      Math.cos(time * (0.9 + ribbon.curl * 0.16) + ribbon.seed + t1 * 4.8) * 28 * smoothstep(t1);
    const wind0 = heightInfluence(t0) * (0.35 + t0 * 0.95);
    const wind1 = heightInfluence(t1) * (0.35 + t1 * 0.95);
    const controlX = (x0 + x1) * 0.5 + Math.sin(time * ribbon.curl + ribbon.phase + segment) * (22 + ribbon.layer * 9);
    const controlY = (y0 + y1) * 0.5 + Math.cos(time * 0.7 + ribbon.seed + segment) * 18;

    context.strokeStyle = `rgba(126, 142, 166, ${alpha})`;
    context.lineWidth = ribbon.width * (0.9 + tm * 3.8) * (1 + Math.sin(time * 2.2 + ribbon.phase + segment) * 0.12);
    context.beginPath();
    context.moveTo(x0 + curl0 + wind0, y0);
    context.quadraticCurveTo(controlX + wind1 * 0.8, controlY, x1 + curl1 + wind1, y1);
    context.stroke();

    context.strokeStyle = `rgba(213, 220, 232, ${alpha * 0.72})`;
    context.lineWidth *= 0.38;
    context.stroke();
  }

  context.restore();
}

function drawAtmosphericCurl(
  context: CanvasRenderingContext2D,
  curl: SmokeCurl,
  width: number,
  height: number,
  time: number,
  wind: number,
  tilt: number,
  density: number,
) {
  const layer = layers[curl.layer];
  const pulse = (Math.sin(time * curl.speed * 7 + curl.phase) + 1) * 0.5;
  const alpha = curl.alpha * (0.45 + pulse * 0.55) * density;
  const x =
    width * curl.x +
    curl.side * Math.sin(time * curl.speed * 4.2 + curl.phase) * width * 0.045 +
    (wind + tilt) * (0.4 + curl.y);
  const y = height * curl.y + Math.cos(time * curl.speed * 3.8 + curl.seed) * height * 0.035;
  const radius = curl.radius * (0.84 + pulse * 0.34);

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = `blur(${layer.blur + 2}px)`;
  context.strokeStyle = `rgba(126, 142, 166, ${alpha})`;
  context.lineWidth = 2.2 + curl.layer * 0.55;
  context.globalAlpha = 0.8;
  context.beginPath();
  context.ellipse(
    x,
    y,
    radius * (1.25 + Math.sin(time * 0.9 + curl.phase) * 0.18),
    radius * (0.54 + Math.cos(time * 0.8 + curl.seed) * 0.12),
    Math.sin(time * curl.speed * 2 + curl.phase) * 1.3,
    0.18 * Math.PI,
    1.9 * Math.PI,
  );
  context.stroke();
  context.restore();
}

export function AnimatedBackground() {
  const enabled = useAppStore((state) => state.settings.animatedBackgroundEnabled);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ribbonsRef = useRef<SmokeRibbon[]>(makeRibbons());
  const curlsRef = useRef<SmokeCurl[]>(makeCurls());
  const frameRef = useRef<number | null>(null);
  const tiltRef = useRef({ current: 0, target: 0, velocity: 0 });
  const windRef = useRef({ current: 0, target: 0, velocity: 0 });
  const visibleRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) {
      return undefined;
    }

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * ratio));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * ratio));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.gamma === "number") {
        tiltRef.current.target = clamp(event.gamma / 22, -1, 1) * 34;
      }
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const x = event.accelerationIncludingGravity?.x;
      if (typeof x === "number") {
        tiltRef.current.target = clamp(-x / 6, -1, 1) * 32;
      }
    };

    const handleVisibility = () => {
      visibleRef.current = document.visibilityState === "visible";
      if (visibleRef.current && frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(draw);
      }
    };

    const draw = (now: number) => {
      frameRef.current = null;
      if (!visibleRef.current) {
        return;
      }

      const time = now / 10000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const tilt = tiltRef.current;
      const wind = windRef.current;
      wind.target = Math.sin(time * 2.1) * 38 + Math.sin(time * 0.73 + 1.8) * 18;

      tilt.velocity = (tilt.velocity + (tilt.target - tilt.current) * 0.024) * 0.86;
      tilt.current += tilt.velocity;
      wind.velocity = (wind.velocity + (wind.target - wind.current) * 0.012) * 0.9;
      wind.current += wind.velocity;
      const density = 1.02 + Math.sin(now / 1600) * 0.05;

      context.clearRect(0, 0, width, height);

      for (const curl of curlsRef.current) {
        drawAtmosphericCurl(context, curl, width, height, time, wind.current, tilt.current, density);
      }

      for (const ribbon of ribbonsRef.current) {
        drawRibbon(context, ribbon, width, height, time, wind.current, tilt.current, density);
      }

      frameRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    window.addEventListener("devicemotion", handleMotion, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    frameRef.current = window.requestAnimationFrame(draw);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="central-smoke-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="central-smoke-canvas" />
    </div>
  );
}
