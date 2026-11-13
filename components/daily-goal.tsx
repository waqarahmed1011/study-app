"use client";
import { useLocalSetting } from "@/lib/use-local-setting";

/** Answers today vs the daily goal saved in Settings (per device). */
export function DailyGoal({ answered }: { answered: number }) {
  const [goal] = useLocalSetting("dailyGoal", "20");
  return (
    <div className="mt-1 text-2xl font-bold">
      {answered}
      <span className="text-base font-medium text-muted"> / {Number(goal) || 20}</span>
    </div>
  );
}
