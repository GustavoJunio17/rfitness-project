"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskMoney } from "@/lib/masks";

interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  /** Texto já mascarado (`1.232,50`). O número sai de `parseMoney` na hora de enviar. */
  value: string;
  onValueChange: (masked: string) => void;
  /** Campos de lançamento aceitam saída; preço e desconto, não. */
  allowNegative?: boolean;
}

/**
 * Campo de dinheiro no padrão contábil: `R$` fixo à esquerda e o valor
 * alinhado à direita, como em nota e extrato — assim os centavos de linhas
 * vizinhas ficam na mesma coluna e dá para conferir de bater o olho.
 *
 * Substitui o `<input type="number">` que existia aqui. Ele aceitava texto
 * solto (`1232p`), devolvia string vazia na leitura quando o conteúdo era
 * inválido — o formulário enviava zero sem avisar — e ainda mostrava as
 * setinhas de incremento, que não fazem sentido para preço.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, allowNegative = false, className, ...props }, ref) => {
    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
        >
          R$
        </span>
        <Input
          ref={ref}
          // `inputMode="decimal"` abre o teclado numérico no celular sem trazer
          // de volta o comportamento do type="number".
          inputMode="decimal"
          placeholder="0,00"
          value={value}
          onChange={(event) => onValueChange(maskMoney(event.target.value, { allowNegative }))}
          className={cn("pl-9 text-right tabular-nums", className)}
          {...props}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
