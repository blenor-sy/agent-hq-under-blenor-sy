"use client";

import { useEffect, useState } from "react";
import { durationMs, formatDuration } from "@/lib/time";

export function Elapsed({ start, end }: { start: string | null; end?: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (end || !start) return;
    const timer = setInterval(() => tick((value) => value + 1), 1_000);
    return () => clearInterval(timer);
  }, [end, start]);
  return <>{formatDuration(durationMs(start, end ?? null))}</>;
}
