"use client";

import { FormEvent, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-catalog";
import { useCreateOrder } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api-client";
import { maskPhone, onlyDigits } from "@/lib/masks";
import type { DeliveryType } from "@/types/orders";
import type { PaymentMethodType } from "@/types/sales";

interface OrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem {
  variantId: string;
  label: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

const PAYMENT_METHODS: { value: PaymentMethodType; label: string }[] = [
  { value: "CASH", label: "Dinheiro" },
  { value: "PIX", label: "Pix" },
  { value: "DEBIT_CARD", label: "Cartão de débito" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "BOLETO", label: "Boleto" },
];

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrderFormDialog({ open, onOpenChange }: OrderFormDialogProps) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("PICKUP");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const [error, setError] = useState<string | null>(null);

  const { data: products, isFetching: isSearching } = useProducts({ search: search || undefined });
  const createOrder = useCreateOrder();

  const searchResults = useMemo(
    () => (products ?? []).flatMap((product) => product.variants.map((variant) => ({ product, variant }))),
    [products],
  );

  function addToCart(item: CartItem) {
    setCart((prev) => {
      const existing = prev.find((line) => line.variantId === item.variantId);
      if (existing) {
        return prev.map((line) =>
          line.variantId === item.variantId ? { ...line, quantity: line.quantity + item.quantity } : line,
        );
      }
      return [...prev, item];
    });
  }

  function updateQuantity(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.variantId === variantId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function removeFromCart(variantId: string) {
    setCart((prev) => prev.filter((line) => line.variantId !== variantId));
  }

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  function reset() {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryType("PICKUP");
    setAddress("");
    setPaymentMethod("CASH");
    setSearch("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (cart.length === 0) {
      setError("Adicione ao menos um item ao pedido.");
      return;
    }
    try {
      await createOrder.mutateAsync({
        customerName,
        customerPhone: onlyDigits(customerPhone),
        deliveryType,
        address: deliveryType === "DELIVERY" ? address || undefined : undefined,
        paymentMethod,
        items: cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar o pedido.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Novo pedido</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="order-customer-name">Cliente</Label>
            <Input
              id="order-customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-customer-phone">Telefone</Label>
            <Input
              id="order-customer-phone"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Entrega</Label>
            <Select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}>
              <option value="PICKUP">Retirada no local</option>
              <option value="DELIVERY">Entrega</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pagamento</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {deliveryType === "DELIVERY" && (
          <div className="space-y-2">
            <Label htmlFor="order-address">Endereço de entrega</Label>
            <Input id="order-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
        )}

        <div className="space-y-2">
          <Label>Itens</Label>
          <Input placeholder="Buscar produto ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border" aria-busy={isSearching}>
              {isSearching &&
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex justify-between border-b border-border p-2 last:border-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              {!isSearching && searchResults.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">Nenhum resultado.</p>
              )}
              {searchResults.map(({ product, variant }) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() =>
                    addToCart({
                      variantId: variant.id,
                      label: [product.name, variant.flavor, variant.weight].filter(Boolean).join(" · "),
                      sku: variant.sku,
                      unitPrice: Number(variant.salePrice),
                      quantity: 1,
                    })
                  }
                  className="flex w-full items-center justify-between border-b border-border p-2 text-left text-sm last:border-0 hover:bg-muted/50"
                >
                  <span>{[product.name, variant.flavor, variant.weight].filter(Boolean).join(" · ")}</span>
                  <span className="text-muted-foreground">
                    {currency(Number(variant.salePrice))} · estoque {variant.currentQuantity}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {cart.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}
          {cart.map((line) => (
            <div key={line.variantId} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <div>
                {line.label}
                <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => updateQuantity(line.variantId, -1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                {line.quantity}
                <Button type="button" size="sm" variant="outline" onClick={() => updateQuantity(line.variantId, 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
                <span className="w-20 text-right">{currency(line.unitPrice * line.quantity)}</span>
                <button
                  type="button"
                  onClick={() => removeFromCart(line.variantId)}
                  className="text-muted-foreground hover:text-brand-red"
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{currency(total)}</span>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={createOrder.isPending}>
          {createOrder.isPending ? "Criando..." : "Criar pedido"}
        </Button>
      </form>
    </Dialog>
  );
}
