"use client";

import { Check, X } from "lucide-react";
import type { PasswordStrength } from "@rfitness/core";
import { cn } from "@/lib/utils";

const BAR_COLORS: Record<number, string> = {
  0: "bg-border",
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-lime-500",
  4: "bg-emerald-500",
};

const TEXT_COLORS: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-red-600",
  2: "text-amber-600",
  3: "text-lime-600",
  4: "text-emerald-600",
};

interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
  /** Sem digitar nada ainda: mostra só a lista de requisitos, sem cor de erro. */
  pristine?: boolean;
}

export function PasswordStrengthMeter({ strength, pristine = false }: PasswordStrengthMeterProps) {
  const score = pristine ? 0 : strength.score;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" role="presentation">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                step <= score ? BAR_COLORS[score] : "bg-border",
              )}
            />
          ))}
        </div>
        <span
          className={cn("w-20 text-right text-xs font-medium tabular-nums", TEXT_COLORS[score])}
          // A força muda enquanto o usuário digita; anunciar tudo seria ruidoso,
          // então só o rótulo final é lido pelo leitor de tela.
          aria-live="polite"
        >
          {pristine ? "" : strength.label}
        </span>
      </div>

      <ul className="grid gap-1">
        {strength.requirements.map((requirement) => {
          const ok = requirement.met;
          const Icon = ok ? Check : X;
          return (
            <li
              key={requirement.id}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                ok ? "text-emerald-600" : pristine ? "text-muted-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", ok ? "text-emerald-600" : "text-border")} aria-hidden />
              {requirement.label}
            </li>
          );
        })}
      </ul>

      {!pristine && strength.hint && !strength.acceptable && (
        <p className="text-xs text-brand">{strength.hint}</p>
      )}
    </div>
  );
}
