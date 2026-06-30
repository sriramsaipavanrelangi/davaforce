"use client";

import * as React from "react";

type UseMovingGlowBorderOptions = {
  idleDuration?: number;
  focusDuration?: number;
  smoothingMs?: number;
  initialAngle?: number;
  reducedMotionMultiplier?: number;
};

type UseMovingGlowBorderResult<T extends HTMLElement> = {
  onBlurCapture: React.FocusEventHandler<T>;
  onFocusCapture: React.FocusEventHandler<T>;
  ref: React.RefCallback<T>;
};

export function useMovingGlowBorder<T extends HTMLElement = HTMLDivElement>({
  idleDuration = 2,
  focusDuration = 3,
  smoothingMs = 240,
  initialAngle = 0,
  reducedMotionMultiplier = 2.5,
}: UseMovingGlowBorderOptions = {}): UseMovingGlowBorderResult<T> {
  const [element, setElement] = React.useState<T | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const lastFrameRef = React.useRef<number | null>(null);
  const angleRef = React.useRef(initialAngle);
  const isFocusedRef = React.useRef(false);
  const idleSpeedRef = React.useRef(360 / (idleDuration * 1000));
  const focusSpeedRef = React.useRef(360 / (focusDuration * 1000));
  const currentSpeedRef = React.useRef(idleSpeedRef.current);
  const targetSpeedRef = React.useRef(idleSpeedRef.current);
  const ref = React.useCallback<React.RefCallback<T>>((node) => {
    setElement(node);
  }, []);

  React.useEffect(() => {
    idleSpeedRef.current = 360 / (idleDuration * 1000);
    focusSpeedRef.current = 360 / (focusDuration * 1000);
    targetSpeedRef.current = isFocusedRef.current ? focusSpeedRef.current : idleSpeedRef.current;
  }, [focusDuration, idleDuration]);

  React.useEffect(() => {
    if (!element) return;

    angleRef.current = ((angleRef.current % 360) + 360) % 360;
    currentSpeedRef.current = targetSpeedRef.current;
    element.style.setProperty("--glow-angle", `${angleRef.current}deg`);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const getMotionScale = () => (motionQuery.matches ? 1 / reducedMotionMultiplier : 1);

    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }

      const delta = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      const speedMix = 1 - Math.exp(-delta / smoothingMs);
      const motionScale = getMotionScale();
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * speedMix;
      angleRef.current = (angleRef.current + currentSpeedRef.current * motionScale * delta) % 360;

      element.style.setProperty("--glow-angle", `${angleRef.current}deg`);
      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [element, reducedMotionMultiplier, smoothingMs]);

  const onFocusCapture = React.useCallback<React.FocusEventHandler<T>>(() => {
    isFocusedRef.current = true;
    targetSpeedRef.current = focusSpeedRef.current;
  }, []);

  const onBlurCapture = React.useCallback<React.FocusEventHandler<T>>((event) => {
    const nextFocused = event.relatedTarget;
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return;
    }

    isFocusedRef.current = false;
    targetSpeedRef.current = idleSpeedRef.current;
  }, []);

  return {
    ref,
    onFocusCapture,
    onBlurCapture,
  };
}
