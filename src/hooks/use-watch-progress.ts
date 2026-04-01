"use client";

import { useRef, useCallback } from "react";

export function useWatchProgress(mediaFileId: string) {
  const lastReportedRef = useRef(0);

  const reportProgress = useCallback(
    (currentTime: number, duration: number) => {
      // Debounce: only report every 10 seconds of real playback change
      if (Math.abs(currentTime - lastReportedRef.current) < 10) return;
      lastReportedRef.current = currentTime;

      fetch(`/api/watch-history/${mediaFileId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: currentTime,
          duration,
        }),
      }).catch(() => {
        // Silent fail — don't interrupt playback
      });
    },
    [mediaFileId]
  );

  return { reportProgress };
}
