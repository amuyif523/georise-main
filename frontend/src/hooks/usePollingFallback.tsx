/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";

export const usePollingFallback = (shouldPoll: boolean, fn: () => void, intervalMs = 30000) => {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (shouldPoll) {
      fn();
      timer.current = setInterval(fn, intervalMs);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [shouldPoll, fn, intervalMs]);
};

export default usePollingFallback;
