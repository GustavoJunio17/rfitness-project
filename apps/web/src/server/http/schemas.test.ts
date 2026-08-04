import { describe, expect, it } from "vitest";
import { studentSchema } from "./schemas";

const base = { name: "Ana Souza" };

describe("studentSchema — CPF", () => {
  it("aceita CPF válido, mascarado ou cru", () => {
    expect(studentSchema.safeParse({ ...base, cpf: "529.982.247-25" }).success).toBe(true);
    expect(studentSchema.safeParse({ ...base, cpf: "52998224725" }).success).toBe(true);
  });

  it("recusa CPF com dígito verificador errado", () => {
    const result = studentSchema.safeParse({ ...base, cpf: "529.982.247-24" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("CPF inválido.");
  });

  it("recusa repetidos e incompletos", () => {
    expect(studentSchema.safeParse({ ...base, cpf: "111.111.111-11" }).success).toBe(false);
    expect(studentSchema.safeParse({ ...base, cpf: "529.982.247" }).success).toBe(false);
  });

  it("CPF é opcional: ausente, nulo ou vazio passam", () => {
    expect(studentSchema.safeParse(base).success).toBe(true);
    expect(studentSchema.safeParse({ ...base, cpf: null }).success).toBe(true);
    // Campo limpo na tela chega como string vazia e significa "sem CPF".
    expect(studentSchema.safeParse({ ...base, cpf: "" }).success).toBe(true);
  });

  it("a validação vale também no PUT parcial, que é o caminho da edição", () => {
    const partial = studentSchema.partial();
    expect(partial.safeParse({ cpf: "529.982.247-25" }).success).toBe(true);
    expect(partial.safeParse({ cpf: "529.982.247-24" }).success).toBe(false);
    expect(partial.safeParse({ name: "Só o nome" }).success).toBe(true);
  });
});
