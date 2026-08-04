"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SCANNER_ELEMENT_ID = "barcode-scanner-viewport";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

// A leitura por câmera não roda em ambiente automatizado — o vídeo em si
// precisa ser conferido no navegador, com câmera de verdade.
export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Os callbacks ficam em refs para não entrarem nas dependências do efeito.
  // A tela que abre o leitor redeclara `onScan` a cada render, e ela renderiza
  // sozinha o tempo todo (carrinho, revalidação da lista). Com eles nas
  // dependências, a câmera era desmontada e remontada a cada render — e era
  // daí que vinha o erro, com o `stop()` da limpeza pegando o `start()` ainda
  // pendente.
  const onScanRef = useRef(onScan);
  const onOpenChangeRef = useRef(onOpenChange);
  onScanRef.current = onScan;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return undefined;

    setError(null);

    let scanner: Html5Qrcode;
    try {
      scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    } catch {
      // O construtor lança quando não encontra o elemento no DOM.
      setError("Não foi possível iniciar a câmera nesta tela.");
      return undefined;
    }

    // A leitura dispara a ~10 quadros por segundo e continua disparando
    // enquanto o código estiver na frente da câmera. Sem esta trava, um bipe
    // só entrava várias vezes no carrinho.
    let handled = false;

    const started = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (handled) return;
          handled = true;
          onScanRef.current(decodedText);
          onOpenChangeRef.current(false);
        },
        undefined,
      )
      .then(() => true)
      .catch(() => {
        // Antes a falha era engolida e sobrava um retângulo preto sem
        // explicação — quem negasse a permissão ficava esperando a câmera.
        setError(
          "Não foi possível acessar a câmera. Autorize o acesso no navegador e tente de novo, " +
            "ou digite o código de barras à mão.",
        );
        return false;
      });

    return () => {
      // A limpeza espera o `start()` resolver: `stop()` lança de forma
      // síncrona ("Cannot stop, scanner is not running or paused") quando a
      // câmera ainda não subiu, e throw síncrono não é pego pelo `.catch` de
      // uma promise — por isso o erro escapava para a tela.
      void started.then((ok) => {
        if (!ok) return;
        try {
          if (scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) return;
          void scanner.stop().then(
            () => scanner.clear(),
            () => {},
          );
        } catch {
          // Já parada, ou parando por conta própria: nada a desfazer.
        }
      });
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Ler código de barras</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-md" />
      {error ? (
        <p role="alert" className="mt-3 text-center text-sm text-brand-red">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Aponte a câmera para o código de barras do produto.
        </p>
      )}
    </Dialog>
  );
}
