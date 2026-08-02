/**
 * O identificador (slug) da academia é interno: o usuário não escolhe nem vê.
 * Derivamos do nome no servidor e resolvemos colisão com sufixo.
 */

export const GYM_SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

const MAX_LENGTH = 40;
const FALLBACK = "academia";

/** Normaliza um nome para a forma canônica do slug (pode devolver ""). */
export function slugifyGymName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Slug base garantidamente válido. Nomes curtos ou só com símbolos ("Ac", "北京")
 * caem no fallback em vez de gerar um slug que o banco recusaria.
 */
export function buildGymSlugBase(gymName: string): string {
  const slug = slugifyGymName(gymName);
  return slug.length >= 3 ? slug : FALLBACK;
}

/**
 * Primeiro slug livre para `gymName`, dado o conjunto de slugs já usados.
 * Sequência: `bora-bill`, `bora-bill-2`, `bora-bill-3`…
 */
export function resolveGymSlug(gymName: string, taken: Iterable<string>): string {
  const base = buildGymSlugBase(gymName);
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_LENGTH - tail.length).replace(/-+$/g, "")}${tail}`;
    if (!used.has(candidate)) return candidate;
  }

  // Improvável: 998 academias com o mesmo nome. Sufixo aleatório encerra o caso.
  const random = Math.random().toString(36).slice(2, 8);
  return `${base.slice(0, MAX_LENGTH - random.length - 1).replace(/-+$/g, "")}-${random}`;
}
