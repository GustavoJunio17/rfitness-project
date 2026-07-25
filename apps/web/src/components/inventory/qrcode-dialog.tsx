"use client";

import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVariantQrCode } from "@/hooks/use-catalog";

interface QrCodeDialogProps {
  variantId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function QrCodeDialog({ variantId, onOpenChange }: QrCodeDialogProps) {
  const { data, isLoading } = useVariantQrCode(variantId);

  return (
    <Dialog open={Boolean(variantId)} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>QR Code do SKU</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <div className="flex flex-col items-center gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Gerando QR Code...</p>}
        {data && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.dataUrl} alt={`QR Code do SKU ${data.sku}`} className="h-64 w-64" />
            <p className="font-mono text-sm text-muted-foreground">{data.sku}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
