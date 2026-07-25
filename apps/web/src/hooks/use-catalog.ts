import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Brand, Category, Product, ProductStatus, Supplier } from "@/types/catalog";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/catalog/categories"),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Category>("/catalog/categories", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: () => apiFetch<Brand[]>("/catalog/brands"),
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Brand>("/catalog/brands", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/catalog/suppliers"),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Supplier>("/catalog/suppliers", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
}

export function useProducts(filters: ProductFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();

  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => apiFetch<Product[]>(`/catalog/products${query ? `?${query}` : ""}`),
  });
}

export interface CreateProductVariantInput {
  brandId?: string;
  flavor?: string;
  weight?: string;
  barcode?: string;
  location?: string;
  batch?: string;
  expiresAt?: string;
  costPrice: number;
  salePrice: number;
  minQuantity: number;
  maxQuantity?: number;
  initialQuantity?: number;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId?: string;
  supplierId?: string;
  variants: CreateProductVariantInput[];
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) =>
      apiFetch<Product>("/catalog/products", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useVariantQrCode(variantId: string | null) {
  return useQuery({
    queryKey: ["variant-qrcode", variantId],
    queryFn: () => apiFetch<{ sku: string; dataUrl: string }>(`/catalog/variants/${variantId}/qrcode`),
    enabled: Boolean(variantId),
  });
}

export function useFindVariantByBarcode() {
  return useMutation({
    mutationFn: (barcode: string) => apiFetch(`/catalog/variants/barcode/${encodeURIComponent(barcode)}`),
  });
}
