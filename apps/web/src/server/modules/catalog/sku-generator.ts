import { buildSku, conflictError, validationError, type BuildSkuInput } from "@rfitness/core";

const MAX_ATTEMPTS = 50;

export interface GenerateSkuInput extends BuildSkuInput {
  /** SKU digitado pelo operador. Se vier, é usado como está (ou falha se ocupado). */
  desiredSku?: string | null;
}

/**
 * Resolve o SKU final de um novo SKU/variante.
 *
 * O SKU derivado de produto+marca+sabor+peso é determinístico, então dois SKUs
 * parecidos colidem; a colisão é resolvida com sufixo numérico. Já um SKU
 * digitado à mão nunca é "corrigido" silenciosamente — o operador precisa saber
 * que o código dele já está em uso.
 */
export async function generateUniqueSku(
  input: GenerateSkuInput,
  exists: (sku: string) => Promise<boolean>,
): Promise<string> {
  if (input.desiredSku?.trim()) {
    const desired = input.desiredSku.trim().toUpperCase();
    if (await exists(desired)) {
      throw conflictError(`O SKU ${desired} já existe.`);
    }
    return desired;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = buildSku({ ...input, suffix: attempt });
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) return candidate;
  }

  throw validationError(
    "Não foi possível gerar um SKU único para este produto. Informe um SKU manualmente.",
  );
}
