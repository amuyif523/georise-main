import { useEffect, useRef } from "react";

export const usePollingFallback = (shouldPoll: boolean, fn: () => void, intervalMs = 30000) => {
  const timer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (shouldPoll) {
      fn();
      timer.current = setInterval(fn, intervalMs);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [shouldPoll]);
};

export default usePollingFallback;
