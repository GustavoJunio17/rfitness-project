"use client";

import { useEffect, useRef } from "react";

/**
 * Fecha no Esc — mas só a camada de cima.
 *
 * Cada painel escutava o `keydown` no `document` por conta própria, o que
 * funcionava enquanto só havia um aberto por vez. Com o detalhe do aluno
 * abrindo o formulário de edição por cima, um Esc fechava os dois de uma vez e
 * a pessoa perdia também o contexto de onde tinha partido.
 *
 * A pilha é de módulo porque a ordem é global à tela: quem abriu por último
 * está por cima, independente de qual componente montou o quê.
 */
const stack: symbol[] = [];

export function useEscapeToClose(open: boolean, onClose: () => void) {
  // O callback vive numa ref para ficar fora das dependências: quem chama
  // passa uma arrow inline, e re-registrar a cada render tiraria e recolocaria
  // a camada no topo da pilha, embaralhando justamente a ordem que ela guarda.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const layer = Symbol("layer");
    stack.push(layer);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (stack[stack.length - 1] !== layer) return;
      onCloseRef.current();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = stack.indexOf(layer);
      if (index !== -1) stack.splice(index, 1);
    };
  }, [open]);
}
