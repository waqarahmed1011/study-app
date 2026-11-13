"use client";
import { useEffect, useState } from "react";

/** Answers today vs the daily goal saved in Settings (per device). */
export function DailyGoal({ answered }: { answered: number }) {
  const [goal, setGoal] = useState(20);
  useEffect(() => {
    try {
      const g = Number(localStorage.getItem("dailyGoal"));
      if (g > 0) setGoal(g);
    } catch {}
  }, []);
  return (
    <div className="mt-1 text-2xl font-bold">
      {answered}
      <span className="text-base font-medium text-muted"> / {goal}</span>
    </div>
  );
}
