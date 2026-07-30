"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { HeatmapCell } from "@/types/finance";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function intensityClass(ratio: number): string {
  if (ratio === 0) return "bg-muted";
  if (ratio < 0.25) return "bg-brand-red/20";
  if (ratio < 0.5) return "bg-brand-red/40";
  if (ratio < 0.75) return "bg-brand-red/60";
  return "bg-brand-red/90";
}

export function SalesHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxCount = useMemo(() => Math.max(1, ...cells.map((cell) => cell.count)), [cells]);
  const cellByKey = useMemo(() => new Map(cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.count])), [cells]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid grid-cols-[auto_repeat(24,1.1rem)] gap-[2px] text-[10px]">
        <div />
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="text-center text-muted-foreground">
            {hour % 3 === 0 ? hour : ""}
          </div>
        ))}
        {DAY_LABELS.map((label, dayOfWeek) => (
          <div key={label} className="contents">
            <div className="pr-2 text-muted-foreground">{label}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = cellByKey.get(`${dayOfWeek}-${hour}`) ?? 0;
              return (
                <div
                  key={hour}
                  title={`${label} ${hour}h — ${count} venda(s)`}
                  className={cn("h-[1.1rem] w-[1.1rem] rounded-sm", intensityClass(count / maxCount))}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
