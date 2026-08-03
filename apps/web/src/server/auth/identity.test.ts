import { describe, expect, it } from "vitest";
import { identityFromUser, normalizeRoles, pickActiveGym, type GymMembership } from "./identity";

const user = (overrides: Record<string, unknown> = {}) => ({
  id: "auth-user-1",
  email: "admin@demo.com",
  app_metadata: { gym_ids: ["gym-1"] },
  user_metadata: { name: "Admin Demo" },
  ...overrides,
});

const membership = (gymId: string, roles: string[] = ["ADMIN"]): GymMembership => ({
  gymId,
  gymName: `Academia ${gymId}`,
  gymSlug: gymId,
  roles: normalizeRoles(roles),
});

describe("identityFromUser", () => {
  it("extrai quem é a pessoa", () => {
    expect(identityFromUser(user())).toEqual({
      authUserId: "auth-user-1",
      email: "admin@demo.com",
      name: "Admin Demo",
    });
  });

  it("devolve null para usuário ausente", () => {
    expect(identityFromUser(null)).toBeNull();
    expect(identityFromUser(undefined)).toBeNull();
  });

  it("cai para o e-mail quando não há nome no metadata", () => {
    const identity = identityFromUser(user({ user_metadata: {}, email: "sem-nome@demo.com" }));
    expect(identity?.name).toBe("sem-nome@demo.com");
  });

  it("não tira tenant nem papel do app_metadata — isso vem do banco", () => {
    const identity = identityFromUser(user({ app_metadata: { gym_id: "gym-9", roles: ["ADMIN"] } }));
    expect(identity).not.toHaveProperty("gymId");
    expect(identity).not.toHaveProperty("roles");
  });
});

describe("normalizeRoles", () => {
  it("descarta papel que não existe no domínio", () => {
    expect(normalizeRoles(["ADMIN", "SUPERUSER", "FINANCE"])).toEqual(["ADMIN", "FINANCE"]);
  });

  it("remove duplicatas", () => {
    expect(normalizeRoles(["ADMIN", "ADMIN"])).toEqual(["ADMIN"]);
  });

  it("aceita lista vazia (autenticado, sem permissão de escrita)", () => {
    expect(normalizeRoles([])).toEqual([]);
  });
});

describe("pickActiveGym", () => {
  const memberships = [membership("gym-1"), membership("gym-2", ["FINANCE"])];

  it("respeita a preferência quando ela é um vínculo real", () => {
    expect(pickActiveGym(memberships, "gym-2")?.gymId).toBe("gym-2");
  });

  it("ignora preferência de academia que não é da pessoa — trocar o cookie não troca de tenant", () => {
    expect(pickActiveGym(memberships, "gym-de-outra-rede")?.gymId).toBe("gym-1");
  });

  it("sem preferência, usa o primeiro vínculo", () => {
    expect(pickActiveGym(memberships, null)?.gymId).toBe("gym-1");
  });

  it("devolve null quando a pessoa não tem academia", () => {
    expect(pickActiveGym([], "gym-1")).toBeNull();
  });
});
