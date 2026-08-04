/**
 * Validação de CPF pelos dois dígitos verificadores.
 *
 * Mora no core porque as duas pontas precisam da mesma resposta: a tela avisa
 * enquanto a pessoa digita, e a API recusa de novo no POST — o formulário não
 * é a única porta de entrada.
 *
 * Pega erro de digitação, que é o caso real no balcão: um dígito trocado passa
 * despercebido e só aparece meses depois, quando alguém precisa do documento
 * certo. Não diz nada sobre o CPF existir de fato na Receita.
 */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return false;

  // 111.111.111-11 e os outros repetidos passam na conta dos dígitos
  // verificadores, mas nenhum é um CPF de verdade.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  return cpfCheckDigit(digits, 9) === Number(digits[9]) && cpfCheckDigit(digits, 10) === Number(digits[10]);
}

/** Dígito verificador da posição `length`: soma ponderada decrescente, módulo 11. */
function cpfCheckDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    sum += Number(digits[i]) * (length + 1 - i);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}
