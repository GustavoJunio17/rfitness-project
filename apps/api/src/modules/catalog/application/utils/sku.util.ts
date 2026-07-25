import { randomBytes } from "crypto";

// Matches combining diacritical marks (U+0300–U+036F) left behind by NFD
// normalization, e.g. turning "É" into "E" + a standalone accent mark.
const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * SKU is globally unique across all gyms (schema constraint), so a short random
 * suffix is appended to the human-readable slug to avoid collisions between
 * different gyms registering the same product/brand/flavor/weight combination.
 */
export function generateSku(parts: Array<string | undefined>): string {
  const slug = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map(slugPart)
    .filter(Boolean)
    .join("-");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${slug}-${suffix}`;
}
