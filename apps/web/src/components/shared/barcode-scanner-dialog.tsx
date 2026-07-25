"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SCANNER_ELEMENT_ID = "barcode-scanner-viewport";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

// Camera-based scanning can't be exercised in an automated/sandboxed environment —
// this integration should be manually verified in a real browser with camera access.
export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          onScan(decodedText);
          onOpenChange(false);
        },
        undefined,
      )
      .catch(() => {
        // Permissão de câmera negada ou indisponível — o usuário fecha o diálogo manualmente.
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [open, onScan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Ler código de barras</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-md" />
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Aponte a câmera para o código de barras do produto.
      </p>
    </Dialog>
  );
}
