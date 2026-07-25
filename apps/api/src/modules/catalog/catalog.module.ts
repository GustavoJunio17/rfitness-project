import { Module } from "@nestjs/common";
import { ReferenceDataController } from "./interface/http/reference-data.controller";
import { ProductController } from "./interface/http/product.controller";
import { ReferenceDataService } from "./application/services/reference-data.service";
import { ProductService } from "./application/services/product.service";
import { CATEGORY_REPOSITORY } from "./domain/repositories/category.repository";
import { PrismaCategoryRepository } from "./infrastructure/persistence/prisma-category.repository";
import { BRAND_REPOSITORY } from "./domain/repositories/brand.repository";
import { PrismaBrandRepository } from "./infrastructure/persistence/prisma-brand.repository";
import { SUPPLIER_REPOSITORY } from "./domain/repositories/supplier.repository";
import { PrismaSupplierRepository } from "./infrastructure/persistence/prisma-supplier.repository";
import { PRODUCT_REPOSITORY } from "./domain/repositories/product.repository";
import { PrismaProductRepository } from "./infrastructure/persistence/prisma-product.repository";

@Module({
  controllers: [ReferenceDataController, ProductController],
  providers: [
    ReferenceDataService,
    ProductService,
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: BRAND_REPOSITORY, useClass: PrismaBrandRepository },
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class CatalogModule {}
