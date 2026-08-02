/**
 * Avaliação de senha usada no cadastro. Roda no cliente (feedback em tempo real)
 * e no servidor (última palavra), por isso vive aqui e não em `apps/web`.
 */

export type PasswordStrengthLevel = "muito-fraca" | "fraca" | "razoavel" | "boa" | "forte";

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  /** 0 a 4 — pensado para preencher 4 barras na UI. */
  score: 0 | 1 | 2 | 3 | 4;
  level: PasswordStrengthLevel;
  label: string;
  requirements: PasswordRequirement[];
  /** Todos os requisitos obrigatórios atendidos. */
  acceptable: boolean;
  /** Dica principal do que falta; `null` quando a senha já está forte. */
  hint: string | null;
}

export const PASSWORD_MIN_LENGTH = 8;

const LEVEL_LABELS: Record<PasswordStrengthLevel, string> = {
  "muito-fraca": "Muito fraca",
  fraca: "Fraca",
  razoavel: "Razoável",
  boa: "Boa",
  forte: "Forte",
};

/**
 * Senhas que aparecem em qualquer lista de vazamento. Não é uma lista completa
 * — é o mínimo para barrar o caso óbvio sem carregar um dicionário no bundle.
 */
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "senha123",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "academia",
  "academia123",
  "admin123",
  "administrador",
  "abc12345",
  "iloveyou",
  "brasil123",
  "flamengo",
  "corinthians",
  "rfitness",
  "rfitness123",
]);

/** Sequências triviais de teclado/alfabeto que inflariam o score sem ganho real. */
const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "01234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

function hasSequentialRun(value: string, minRun = 4): boolean {
  const lower = value.toLowerCase();
  for (const sequence of SEQUENCES) {
    const reversed = [...sequence].reverse().join("");
    for (const source of [sequence, reversed]) {
      for (let i = 0; i + minRun <= source.length; i += 1) {
        if (lower.includes(source.slice(i, i + minRun))) return true;
      }
    }
  }
  return false;
}

function hasRepeatedRun(value: string, minRun = 3): boolean {
  let run = 1;
  for (let i = 1; i < value.length; i += 1) {
    run = value[i] === value[i - 1] ? run + 1 : 1;
    if (run >= minRun) return true;
  }
  return false;
}

/**
 * Trechos do próprio cadastro (nome, e-mail, academia) não contam como segredo:
 * quem conhece a academia adivinha.
 */
function containsPersonalData(password: string, personalData: string[]): boolean {
  const lower = password.toLowerCase();
  return personalData.some((raw) => {
    const token = raw.toLowerCase().trim();
    if (token.length < 4) return false;
    // E-mail: só a parte antes do @ interessa.
    const candidates = (token.includes("@") ? [token.slice(0, token.indexOf("@"))] : token.split(/[\s.@-]+/)).filter(
      (candidate) => candidate.length > 0,
    );
    return candidates.some((candidate) => candidate.length >= 4 && lower.includes(candidate));
  });
}

export function evaluatePassword(password: string, personalData: string[] = []): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    { id: "length", label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "case", label: "Letras maiúsculas e minúsculas", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: "number", label: "Pelo menos um número", met: /\d/.test(password) },
    { id: "symbol", label: "Pelo menos um símbolo (!@#$…)", met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (password.length === 0) {
    return {
      score: 0,
      level: "muito-fraca",
      label: LEVEL_LABELS["muito-fraca"],
      requirements,
      acceptable: false,
      hint: null,
    };
  }

  const normalized = password.toLowerCase();
  const isCommon = COMMON_PASSWORDS.has(normalized);
  const looksPersonal = containsPersonalData(password, personalData);

  let points = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) points += 1;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  points += requirements.filter((requirement) => requirement.id !== "length" && requirement.met).length;

  if (hasSequentialRun(password)) points -= 1;
  if (hasRepeatedRun(password)) points -= 1;
  if (new Set(password).size <= 4) points -= 1;

  // Senha vazada ou derivada dos dados do cadastro: o resto do score é ruído.
  if (isCommon || looksPersonal) points = Math.min(points, 1);

  const requiredMet = requirements.every((requirement) => requirement.met);
  const acceptable = requiredMet && !isCommon && !looksPersonal;

  // Sem os requisitos obrigatórios nunca passa de "fraca" — evita barra verde
  // em senha que o formulário vai recusar.
  const rawScore = Math.max(0, Math.min(4, points));
  const score = (acceptable ? Math.max(2, rawScore) : Math.min(1, rawScore)) as 0 | 1 | 2 | 3 | 4;

  const level: PasswordStrengthLevel =
    score === 0 ? "muito-fraca" : score === 1 ? "fraca" : score === 2 ? "razoavel" : score === 3 ? "boa" : "forte";

  let hint: string | null = null;
  if (isCommon) hint = "Essa senha é muito comum e aparece em vazamentos conhecidos.";
  else if (looksPersonal) hint = "Evite usar seu nome, e-mail ou o nome da academia na senha.";
  else if (!requiredMet) hint = requirements.find((requirement) => !requirement.met)?.label ?? null;
  else if (score < 4) hint = "Aumente o tamanho da senha para deixá-la mais forte.";

  return { score, level, label: LEVEL_LABELS[level], requirements, acceptable, hint };
}
