"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTestSessionStore } from "@/stores/testSessionStore";

interface UseTimerOptions {
  onExpire: () => void;
  onWarning?: (secondsLeft: number) => void;
  warningThresholds?: number[];
}

export function useTimer({ onExpire, onWarning, warningThresholds = [300, 60] }: UseTimerOptions) {
  const tick = useTestSessionStore((s) => s.tick);
  const timeRemaining = useTestSessionStore((s) => s.timeRemainingSeconds);
  const status = useTestSessionStore((s) => s.status);

  const onExpireRef = useRef(onExpire);
  const onWarningRef = useRef(onWarning);
  const firedWarnings = useRef(new Set<number>());

  onExpireRef.current = onExpire;
  onWarningRef.current = onWarning;

  const handleTick = useCallback(() => {
    tick();
  }, [tick]);

  useEffect(() => {
    if (status !== "active") return;

    const interval = setInterval(handleTick, 1000);
    return () => clearInterval(interval);
  }, [status, handleTick]);

  useEffect(() => {
    if (timeRemaining === 0 && status === "active") {
      onExpireRef.current();
    }

    for (const threshold of warningThresholds) {
      if (timeRemaining === threshold && !firedWarnings.current.has(threshold)) {
        firedWarnings.current.add(threshold);
        onWarningRef.current?.(threshold);
      }
    }
  }, [timeRemaining, status, warningThresholds]);

  const urgency =
    timeRemaining < 60 ? "critical" : timeRemaining < 300 ? "warning" : "normal";

  return { timeRemaining, urgency };
}
