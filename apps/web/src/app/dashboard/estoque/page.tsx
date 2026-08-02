"use client";

import { useMemo, useState } from "react";
import { Plus, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTableRows } from "@/components/ui/skeleton";
import { useBrands, useCategories, useProducts } from "@/hooks/use-catalog";
import { AlertsPanel } from "@/components/inventory/alerts-panel";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import { MovementDialog } from "@/components/inventory/movement-dialog";
import { QrCodeDialog } from "@/components/inventory/qrcode-dialog";
import { BarcodeScannerDialog } from "@/components/shared/barcode-scanner-dialog";

export default function EstoquePage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isProductFormOpen, setProductFormOpen] = useState(false);
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [movementVariant, setMovementVariant] = useState<{ id: string; sku: string; currentQuantity: number } | null>(
    null,
  );
  const [qrCodeVariantId, setQrCodeVariantId] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const { data: products, isLoading } = useProducts({ search: search || undefined, categoryId: categoryId || undefined });

  const brandNameById = useMemo(() => new Map(brands?.map((b) => [b.id, b.name])), [brands]);

  const rows = useMemo(
    () =>
      (products ?? []).flatMap((product) =>
        product.variants.map((variant) => ({ product, variant })),
      ),
    [products],
  );

  const visibleRows = scannedCode
    ? rows.filter((row) => row.variant.barcode === scannedCode || row.variant.sku === scannedCode)
    : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">Produtos, SKUs e movimentações de estoque.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <ScanLine className="mr-2 h-4 w-4" /> Ler código de barras
          </Button>
          <Button onClick={() => setProductFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo produto
          </Button>
        </div>
      </div>

      <AlertsPanel />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="max-w-xs">
          <option value="">Todas as categorias</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        {scannedCode && (
          <Button variant="outline" size="sm" onClick={() => setScannedCode(null)}>
            Limpar filtro de código: {scannedCode}
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Marca / Sabor / Peso</TableHead>
            <TableHead>Preço venda</TableHead>
            <TableHead>Estoque</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={isLoading}>
          {isLoading && <SkeletonTableRows rows={6} columns={6} />}
          {!isLoading && visibleRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum produto encontrado.
              </TableCell>
            </TableRow>
          )}
          {visibleRows.map(({ product, variant }) => {
            const isLowStock = variant.currentQuantity <= variant.minQuantity;
            return (
              <TableRow key={variant.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell className="font-mono text-xs">{variant.sku}</TableCell>
                <TableCell>
                  {[variant.brandId ? brandNameById.get(variant.brandId) : null, variant.flavor, variant.weight]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  {Number(variant.salePrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{variant.currentQuantity}</span>
                    {isLowStock && <Badge variant="destructive">baixo (mín. {variant.minQuantity})</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setMovementVariant({
                          id: variant.id,
                          sku: variant.sku,
                          currentQuantity: variant.currentQuantity,
                        })
                      }
                    >
                      Movimentar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setQrCodeVariantId(variant.id)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ProductFormDialog open={isProductFormOpen} onOpenChange={setProductFormOpen} />
      <MovementDialog variant={movementVariant} onOpenChange={(open) => !open && setMovementVariant(null)} />
      <QrCodeDialog variantId={qrCodeVariantId} onOpenChange={(open) => !open && setQrCodeVariantId(null)} />
      <BarcodeScannerDialog open={isScannerOpen} onOpenChange={setScannerOpen} onScan={setScannedCode} />
    </div>
  );
}
