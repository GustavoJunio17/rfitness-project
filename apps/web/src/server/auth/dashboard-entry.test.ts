import { describe, expect, it } from "vitest";
import { resolveDashboardEntry } from "./dashboard-entry";

describe("resolveDashboardEntry", () => {
  it("gestor com academia ativa fica na visão geral", () => {
    expect(resolveDashboardEntry({ isPlatformAdmin: false, gymId: "gym-1" })).toBeNull();
  });

  it("gestor sem academia fica em /dashboard — não há ação dele que resolva", () => {
    expect(resolveDashboardEntry({ isPlatformAdmin: false, gymId: "" })).toBeNull();
  });

  it("admin de plataforma vai para o console", () => {
    expect(resolveDashboardEntry({ isPlatformAdmin: true, gymId: "" })).toBe("/dashboard/plataforma");
  });

  it("gestor nunca cai no console, mesmo sem academia", () => {
    for (const gymId of ["", "gym-1"]) {
      expect(resolveDashboardEntry({ isPlatformAdmin: false, gymId })).not.toBe(
        "/dashboard/plataforma",
      );
    }
  });

  it("admin de plataforma vai ao console mesmo tendo vínculo com academia", () => {
    expect(resolveDashboardEntry({ isPlatformAdmin: true, gymId: "gym-1" })).toBe(
      "/dashboard/plataforma",
    );
  });
});
