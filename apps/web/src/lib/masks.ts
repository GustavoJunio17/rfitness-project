/**
 * Máscaras de CPF e telefone aplicadas enquanto a pessoa digita.
 *
 * Todas as funções são progressivas: recebem o texto parcial do campo e
 * devolvem o que couber até ali, sem exigir o número completo. É isso que
 * permite chamá-las a cada tecla no `onChange` sem atrapalhar a digitação.
 *
 * O que vai para a API é sempre `onlyDigits(...)` — a máscara é enfeite de
 * tela. O banco guarda dígitos porque é assim que o WhatsApp entrega o número
 * do remetente, e a busca do agente depende de bater exato.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** `123.456.789-01`, montado conforme os dígitos chegam. */
export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  let out = digits.slice(0, 3);
  if (digits.length > 3) out += `.${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `.${digits.slice(6, 9)}`;
  if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
  return out;
}

/**
 * Telefone brasileiro: `(31) 9999-1111` para fixo e `(31) 99999-1111` para
 * celular. O nono dígito só entra na conta quando aparece — antes disso o
 * número ainda pode ser um fixo, e antecipar o formato faria o cursor pular.
 *
 * Passando de 11 dígitos, os dois primeiros viram código do país: é o formato
 * que o WhatsApp usa (`5531999991111`) e que a pessoa cola do celular.
 */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 13);

  if (digits.length > 11) {
    return `+${digits.slice(0, 2)} ${maskLocalPhone(digits.slice(2))}`;
  }
  return maskLocalPhone(digits);
}

function maskLocalPhone(digits: string): string {
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : "";

  const area = digits.slice(0, 2);
  const rest = digits.slice(2);

  // 8 dígitos = fixo (4+4); 9 = celular (5+4).
  const split = rest.length > 8 ? 5 : 4;
  if (rest.length <= split) return `(${area}) ${rest}`;
  return `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** Aplica a máscara em valor que já veio do banco (dígitos crus). */
export function formatCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  return maskCpf(value) || null;
}

export function formatPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  return maskPhone(value) || null;
}
