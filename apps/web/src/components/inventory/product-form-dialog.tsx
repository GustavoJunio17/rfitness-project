"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogCloseButton, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBrands,
  useCategories,
  useCreateBrand,
  useCreateCategory,
  useCreateProduct,
  useSuppliers,
  type CreateProductVariantInput,
} from "@/hooks/use-catalog";

interface VariantDraft {
  brandId: string;
  flavor: string;
  weight: string;
  barcode: string;
  costPrice: string;
  salePrice: string;
  minQuantity: string;
  maxQuantity: string;
  initialQuantity: string;
}

function emptyVariant(): VariantDraft {
  return {
    brandId: "",
    flavor: "",
    weight: "",
    barcode: "",
    costPrice: "",
    salePrice: "",
    minQuantity: "5",
    maxQuantity: "",
    initialQuantity: "0",
  };
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductFormDialog({ open, onOpenChange }: ProductFormDialogProps) {
  const { data: categories, isPending: isCategoriesPending } = useCategories();
  const { data: brands } = useBrands();
  const { data: suppliers, isPending: isSuppliersPending } = useSuppliers();
  const createCategory = useCreateCategory();
  const createBrand = useCreateBrand();
  const createProduct = useCreateProduct();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");

  function updateVariant(index: number, field: keyof VariantDraft, value: string) {
    setVariants((prev) => prev.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)));
  }

  function reset() {
    setName("");
    setDescription("");
    setCategoryId("");
    setSupplierId("");
    setVariants([emptyVariant()]);
    setError(null);
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    const category = await createCategory.mutateAsync(newCategoryName.trim());
    setCategoryId(category.id);
    setNewCategoryName("");
  }

  async function handleCreateBrand() {
    if (!newBrandName.trim()) return;
    await createBrand.mutateAsync(newBrandName.trim());
    setNewBrandName("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const payload: CreateProductVariantInput[] = variants.map((variant) => ({
        brandId: variant.brandId || undefined,
        flavor: variant.flavor || undefined,
        weight: variant.weight || undefined,
        barcode: variant.barcode || undefined,
        costPrice: Number(variant.costPrice),
        salePrice: Number(variant.salePrice),
        minQuantity: Number(variant.minQuantity || 0),
        maxQuantity: variant.maxQuantity ? Number(variant.maxQuantity) : undefined,
        initialQuantity: Number(variant.initialQuantity || 0),
      }));

      await createProduct.mutateAsync({
        name,
        description: description || undefined,
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
        variants: payload,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o produto.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Novo produto</DialogTitle>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="product-name">Nome do produto</Label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="product-description">Descrição</Label>
            <Input id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-category">Categoria</Label>
            {/* Select vazio parece "não há categorias"; o skeleton diz que ainda
                estão chegando. */}
            {isCategoriesPending ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select id="product-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleCreateCategory}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-supplier">Fornecedor</Label>
            {isSuppliersPending ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select id="product-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Sem fornecedor</option>
                {suppliers?.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">SKUs (marca/sabor/peso)</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setVariants((prev) => [...prev, emptyVariant()])}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar SKU
            </Button>
          </div>

          <div className="flex gap-2">
            <Input placeholder="Nova marca" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={handleCreateBrand}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {variants.map((variant, index) => (
            <div key={index} className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">SKU {index + 1}</span>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVariants((prev) => prev.filter((_, i) => i !== index))}
                    className="text-muted-foreground hover:text-brand-red"
                    aria-label="Remover SKU"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={variant.brandId} onChange={(e) => updateVariant(index, "brandId", e.target.value)}>
                  <option value="">Sem marca</option>
                  {brands?.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Sabor (ex: Chocolate)"
                  value={variant.flavor}
                  onChange={(e) => updateVariant(index, "flavor", e.target.value)}
                />
                <Input
                  placeholder="Peso (ex: 900g)"
                  value={variant.weight}
                  onChange={(e) => updateVariant(index, "weight", e.target.value)}
                />
                <Input
                  placeholder="Código de barras"
                  value={variant.barcode}
                  onChange={(e) => updateVariant(index, "barcode", e.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço de custo"
                  value={variant.costPrice}
                  onChange={(e) => updateVariant(index, "costPrice", e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço de venda"
                  value={variant.salePrice}
                  onChange={(e) => updateVariant(index, "salePrice", e.target.value)}
                  required
                />
                <Input
                  type="number"
                  placeholder="Estoque mínimo"
                  value={variant.minQuantity}
                  onChange={(e) => updateVariant(index, "minQuantity", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Estoque máximo"
                  value={variant.maxQuantity}
                  onChange={(e) => updateVariant(index, "maxQuantity", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Estoque inicial"
                  value={variant.initialQuantity}
                  onChange={(e) => updateVariant(index, "initialQuantity", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={createProduct.isPending}>
          {createProduct.isPending ? "Salvando..." : "Salvar produto"}
        </Button>
      </form>
    </Dialog>
  );
}
