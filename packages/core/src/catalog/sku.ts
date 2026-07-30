import { validationError } from "../shared/errors";

/** Remove acentos, pontuação e espaços; devolve em caixa alta. */
export function slugifyToken(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export interface BuildSkuInput {
  productName: string;
  brandName?: string | null;
  flavor?: string | null;
  weight?: string | null;
  /** Sufixo numérico de desambiguação quando o SKU base já existe. */
  suffix?: number;
}

/**
 * SKU legível e determinístico: 3 primeiros caracteres de cada segmento
 * (produto-marca-sabor-peso), segmentos vazios omitidos. Determinístico de
 * propósito — a unicidade é garantida no banco, e colisão é resolvida por
 * `suffix` (ver `SkuGenerator` no servidor).
 */
export function buildSku(input: BuildSkuInput): string {
  const product = slugifyToken(input.productName);
  if (!product) throw validationError("O nome do produto é obrigatório para gerar o SKU.");

  const segments = [
    product.slice(0, 3),
    slugifyToken(input.brandName).slice(0, 3),
    slugifyToken(input.flavor).slice(0, 3),
    slugifyToken(input.weight).slice(0, 4),
  ].filter((segment) => segment.length > 0);

  if (input.suffix !== undefined && input.suffix > 1) {
    segments.push(String(input.suffix));
  }

  return segments.join("-");
}
