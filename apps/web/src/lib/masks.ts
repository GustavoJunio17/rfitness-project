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

// A validação de CPF é regra de domínio e mora no core, junto da que a API
// usa — reexportada aqui só para o formulário importar máscara e validação do
// mesmo lugar.
export { isValidCpf } from "@rfitness/core";

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

/**
 * Dinheiro no padrão contábil brasileiro: `1.232,50`.
 *
 * Os dígitos entram pela direita, como numa calculadora de balcão — digitar
 * `123250` dá `1.232,50`. É o comportamento de caixa e de ERP daqui, e evita
 * a dúvida de "esse 1232 é mil duzentos e trinta e dois ou doze e trinta e
 * dois?": os centavos estão sempre visíveis.
 *
 * Antes esses campos eram `<input type="number">`, que aceitava `1232p` sem
 * reclamar e entregava string vazia na leitura — o formulário submetia zero
 * sem ninguém perceber.
 */
export function maskMoney(value: string, options: { allowNegative?: boolean } = {}): string {
  const negative = Boolean(options.allowNegative) && value.trimStart().startsWith("-");

  // Zeros à esquerda caem por inteiro, e não só até sobrar um: é o que deixa
  // apagar até esvaziar o campo. Mantendo um zero, `0,00` viraria o piso do
  // backspace e não haveria como limpar o valor digitado por engano.
  //
  // 15 dígitos: acima disso a conta sai do inteiro seguro do JS e o valor
  // exibido passa a divergir do digitado.
  const digits = onlyDigits(value).replace(/^0+/, "").slice(0, 15);
  if (!digits) return negative ? "-" : "";

  return formatCents(digits, negative);
}

function formatCents(digits: string, negative: boolean): string {
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const units = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negative ? "-" : ""}${units},${cents}`;
}

/** Valor numérico do campo mascarado. `null` quando não há número nenhum. */
export function parseMoney(masked: string): number | null {
  const digits = onlyDigits(masked);
  if (!digits) return null;

  const value = Number(digits) / 100;
  return masked.trimStart().startsWith("-") ? -value : value;
}

/**
 * Número (do banco ou de um cálculo) no formato do campo.
 *
 * Não passa por `maskMoney` porque zero gravado deve aparecer como `0,00`, e
 * lá o zero é justamente o que significa campo vazio.
 */
export function moneyToMask(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return formatCents(String(Math.round(Math.abs(value) * 100)), value < 0);
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
