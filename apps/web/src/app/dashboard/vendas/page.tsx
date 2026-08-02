"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton, SkeletonTableRows } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-catalog";
import { useCreateSale, useSales } from "@/hooks/use-sales";
import { useStudents } from "@/hooks/use-students";
import { BarcodeScannerDialog } from "@/components/shared/barcode-scanner-dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PaymentMethodType } from "@/types/sales";

interface CartItem {
  variantId: string;
  label: string;
  sku: string;
  unitPrice: number;
  availableQuantity: number;
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

export default function VendasPage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const [discount, setDiscount] = useState("0");
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ totalAmount: string; totalProfit: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);

  const { data: products, isFetching: isSearchingProducts } = useProducts({ search: search || undefined });
  const { data: sales, isPending: isSalesPending } = useSales();
  const { data: customerResults, isFetching: isSearchingCustomers } = useStudents({
    search: customerSearch || undefined,
  });
  const createSale = useCreateSale();

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

  async function handleScan(code: string) {
    try {
      const variant = await apiFetch<{
        id: string;
        sku: string;
        flavor: string | null;
        weight: string | null;
        salePrice: string;
        currentQuantity: number;
      }>(`/catalog/variants/barcode/${encodeURIComponent(code)}`);
      addToCart({
        variantId: variant.id,
        label: [variant.sku, variant.flavor, variant.weight].filter(Boolean).join(" · "),
        sku: variant.sku,
        unitPrice: Number(variant.salePrice),
        availableQuantity: variant.currentQuantity,
        quantity: 1,
      });
    } catch {
      setError("Código de barras não encontrado.");
    }
  }

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountValue = Number(discount || 0);
  const total = Math.max(subtotal - discountValue, 0);

  async function handleFinalizeSale() {
    setError(null);
    setReceipt(null);
    try {
      const sale = await createSale.mutateAsync({
        paymentMethod,
        discount: discountValue,
        studentId: selectedCustomer?.id,
        items: cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      });
      setReceipt({ totalAmount: sale.totalAmount, totalProfit: sale.totalProfit });
      setCart([]);
      setDiscount("0");
      setSelectedCustomer(null);
      setCustomerSearch("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível finalizar a venda.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendas (PDV)</h1>
        <p className="text-sm text-muted-foreground">Registre vendas e acompanhe o histórico.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex gap-2">
            <Input placeholder="Buscar produto ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="outline" onClick={() => setScannerOpen(true)}>
              <ScanLine className="mr-2 h-4 w-4" /> Ler código
            </Button>
          </div>

          {search && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border" aria-busy={isSearchingProducts}>
              {/* Busca refaz a query a cada tecla: `isFetching` mostra o skeleton
                  também nas buscas seguintes, não só na primeira. */}
              {isSearchingProducts &&
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-border p-3 last:border-0">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              {!isSearchingProducts && searchResults.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Nenhum resultado.</p>
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
                      availableQuantity: variant.currentQuantity,
                      quantity: 1,
                    })
                  }
                  className="flex w-full items-center justify-between border-b border-border p-3 text-left text-sm last:border-0 hover:bg-muted/50"
                >
                  <span>
                    {product.name} {variant.flavor ? `· ${variant.flavor}` : ""} {variant.weight ? `· ${variant.weight}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {currency(Number(variant.salePrice))} · estoque {variant.currentQuantity}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Carrinho vazio. Busque um produto acima.
                  </TableCell>
                </TableRow>
              )}
              {cart.map((line) => (
                <TableRow key={line.variantId}>
                  <TableCell>
                    {line.label}
                    <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                  </TableCell>
                  <TableCell>{currency(line.unitPrice)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateQuantity(line.variantId, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      {line.quantity}
                      <Button size="sm" variant="outline" onClick={() => updateQuantity(line.variantId, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{currency(line.unitPrice * line.quantity)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.variantId)}
                      className="text-muted-foreground hover:text-brand-red"
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Fechamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Cliente (opcional)</span>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <span>{selectedCustomer.name}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-brand-red"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    remover
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar aluno..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                  {customerSearch && (
                    <div className="max-h-32 overflow-y-auto rounded-md border border-border" aria-busy={isSearchingCustomers}>
                      {isSearchingCustomers &&
                        Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="border-b border-border p-2 last:border-0">
                            <Skeleton className="h-4 w-36" />
                          </div>
                        ))}
                      {!isSearchingCustomers && (customerResults ?? []).length === 0 && (
                        <p className="p-2 text-xs text-muted-foreground">Nenhum aluno encontrado.</p>
                      )}
                      {customerResults?.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          className="block w-full border-b border-border p-2 text-left text-sm last:border-0 hover:bg-muted/50"
                          onClick={() => {
                            setSelectedCustomer({ id: student.id, name: student.name });
                            setCustomerSearch("");
                          }}
                        >
                          {student.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Forma de pagamento</span>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Desconto (R$)</span>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{currency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span>-{currency(discountValue)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{currency(total)}</span>
              </div>
            </div>
            {error && <p className="text-sm text-brand-red">{error}</p>}
            {receipt && (
              <p className="rounded-md bg-muted p-2 text-sm">
                Venda registrada! Total {currency(Number(receipt.totalAmount))}, lucro{" "}
                {currency(Number(receipt.totalProfit))}.
              </p>
            )}
            <Button
              className="w-full"
              disabled={cart.length === 0 || createSale.isPending}
              onClick={handleFinalizeSale}
            >
              {createSale.isPending ? "Finalizando..." : "Finalizar venda"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Histórico de vendas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Lucro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody aria-busy={isSalesPending}>
            {isSalesPending && <SkeletonTableRows rows={5} columns={5} />}
            {!isSalesPending && (sales ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma venda registrada ainda.
                </TableCell>
              </TableRow>
            )}
            {sales?.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{new Date(sale.createdAt).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod)?.label}</TableCell>
                <TableCell>{sale.items.length}</TableCell>
                <TableCell>{currency(Number(sale.totalAmount))}</TableCell>
                <TableCell>{currency(Number(sale.totalProfit))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BarcodeScannerDialog open={isScannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} />
    </div>
  );
}
