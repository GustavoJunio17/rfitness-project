import { describe, expect, it } from "vitest";
import { authContextFromUser } from "./context";

const user = (appMetadata: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  id: "auth-user-1",
  email: "admin@demo.com",
  app_metadata: appMetadata,
  user_metadata: { name: "Admin Demo" },
  ...overrides,
});

describe("authContextFromUser", () => {
  it("extrai gymId e papéis de app_metadata", () => {
    const context = authContextFromUser(user({ gym_id: "gym-1", roles: ["ADMIN", "FINANCE"] }));

    expect(context).toEqual({
      authUserId: "auth-user-1",
      gymId: "gym-1",
      email: "admin@demo.com",
      name: "Admin Demo",
      roles: ["ADMIN", "FINANCE"],
    });
  });

  it("descarta papéis desconhecidos em vez de confiar no metadata", () => {
    const context = authContextFromUser(user({ gym_id: "gym-1", roles: ["ADMIN", "SUPERUSER"] }));
    expect(context?.roles).toEqual(["ADMIN"]);
  });

  it("devolve null quando falta gym_id — usuário sem tenant não acessa nada", () => {
    expect(authContextFromUser(user({ roles: ["ADMIN"] }))).toBeNull();
  });

  it("devolve null para usuário ausente", () => {
    expect(authContextFromUser(null)).toBeNull();
    expect(authContextFromUser(undefined)).toBeNull();
  });

  it("aceita usuário sem papéis (autenticado, sem permissão de escrita)", () => {
    expect(authContextFromUser(user({ gym_id: "gym-1" }))?.roles).toEqual([]);
  });

  it("cai para o e-mail quando não há nome no metadata", () => {
    const context = authContextFromUser(
      user({ gym_id: "gym-1" }, { user_metadata: {}, email: "sem-nome@demo.com" }),
    );
    expect(context?.name).toBe("sem-nome@demo.com");
  });

  it("ignora roles que não vêm como array", () => {
    expect(authContextFromUser(user({ gym_id: "gym-1", roles: "ADMIN" }))?.roles).toEqual([]);
  });
});
