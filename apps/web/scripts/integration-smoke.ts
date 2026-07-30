/**
 * Smoke de integração contra Postgres real: exercita catálogo → venda → pedido →
 * financeiro pelos services de verdade (sem mocks de repositório).
 */
import { PrismaClient } from "@prisma/client";
import { createProduct, listProducts } from "../src/server/modules/catalog/catalog.service";
import { salesService } from "../src/server/modules/sales/sales.repository";
import { ordersService } from "../src/server/modules/orders/orders.repository";
import { inventoryService } from "../src/server/modules/inventory/inventory.repository";
import { getFinanceSummary } from "../src/server/modules/finance/analytics.service";
import { listCashFlow, registerSaleRevenue } from "../src/server/modules/finance/cash-flow.service";

const prisma = new PrismaClient();
const checks: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail = "") {
  checks.push({ name, ok, detail });
}

async function main() {
  const stamp = Date.now();
  const gym = await prisma.gym.create({ data: { name: "Smoke Gym", slug: `smoke-${stamp}` } });
  const user = await prisma.user.create({
    data: { authUserId: `auth-${stamp}`, gymId: gym.id, name: "Smoke Admin", email: `admin-${stamp}@x.com` },
  });

  // --- catálogo: SKU gerado + estoque inicial como movimentação -------------
  const product = await createProduct(
    gym.id,
    {
      name: "Whey Protein",
      variants: [
        { flavor: "Baunilha", weight: "900g", costPrice: 80, salePrice: 140, minQuantity: 5, initialQuantity: 10 },
        { flavor: "Chocolate", weight: "900g", costPrice: 80, salePrice: 140, minQuantity: 2, initialQuantity: 3 },
      ],
    },
    user.id,
  );

  const [vanilla, chocolate] = product.variants;
  check("SKU gerado automaticamente", /^WHE-/.test(vanilla!.sku), vanilla!.sku);
  check("SKUs distintos para variantes do mesmo produto", vanilla!.sku !== chocolate!.sku, `${vanilla!.sku} / ${chocolate!.sku}`);

  const initialMovements = await prisma.stockMovement.count({ where: { variantId: vanilla!.id, type: "IN" } });
  check("estoque inicial gravado como movimentação IN", initialMovements === 1, `${initialMovements} movimento(s)`);

  // --- venda: transação, baixa, snapshot, fluxo de caixa, alerta ------------
  const sale = await salesService.createSale(gym.id, user.id, {
    items: [
      { variantId: vanilla!.id, quantity: 2 },
      { variantId: vanilla!.id, quantity: 1 },
      { variantId: chocolate!.id, quantity: 2 },
    ],
    paymentMethod: "PIX",
    discount: 10,
  });

  check("total da venda com desconto", sale.totalAmount === 690, `R$ ${sale.totalAmount}`);
  check("lucro da venda com desconto", sale.totalProfit === 290, `R$ ${sale.totalProfit}`);
  check("itens duplicados fundidos numa linha", sale.items.length === 2, `${sale.items.length} linhas`);

  const vanillaAfter = await prisma.productVariant.findUniqueOrThrow({ where: { id: vanilla!.id } });
  check("estoque decrementado pela venda", vanillaAfter.currentQuantity === 7, `${vanillaAfter.currentQuantity} un.`);

  const saleMovements = await prisma.stockMovement.findMany({ where: { type: "SALE" } });
  check(
    "movimentações SALE com delta negativo",
    saleMovements.length === 2 && saleMovements.every((movement) => movement.quantity < 0),
    saleMovements.map((movement) => movement.quantity).join(", "),
  );

  const cashFlow = await listCashFlow(gym.id);
  check("venda gerou entrada no fluxo de caixa", cashFlow.length === 1 && cashFlow[0]!.amount === 690, JSON.stringify(cashFlow));

  await registerSaleRevenue(gym.id, sale.id, 690);
  const cashFlowAfterRetry = await listCashFlow(gym.id);
  check("receita da venda é idempotente (saleId unique)", cashFlowAfterRetry.length === 1, `${cashFlowAfterRetry.length} lançamento(s)`);

  const chocolateAlerts = await prisma.stockAlert.findMany({ where: { variantId: chocolate!.id, type: "LOW_STOCK" } });
  check("alerta de estoque baixo aberto pela venda", chocolateAlerts.length === 1, chocolateAlerts[0]?.message ?? "nenhum");

  // --- estoque insuficiente é recusado sem gravar nada ----------------------
  let rejected = false;
  try {
    await salesService.createSale(gym.id, user.id, {
      items: [{ variantId: chocolate!.id, quantity: 999 }],
      paymentMethod: "CASH",
    });
  } catch (error) {
    rejected = /Estoque insuficiente/.test((error as Error).message);
  }
  const salesCount = await prisma.sale.count({ where: { gymId: gym.id } });
  check("venda sem estoque recusada e não gravada", rejected && salesCount === 1, `${salesCount} venda(s)`);

  // --- reposição resolve o alerta ------------------------------------------
  await inventoryService.registerMovement(gym.id, { variantId: chocolate!.id, type: "IN", quantity: 20 }, user.id);
  const resolvedAlert = await prisma.stockAlert.findFirstOrThrow({ where: { variantId: chocolate!.id, type: "LOW_STOCK" } });
  check("reposição resolveu o alerta", resolvedAlert.resolvedAt !== null, String(resolvedAlert.resolvedAt));

  // --- ajuste de inventário usa contagem física ----------------------------
  await inventoryService.registerMovement(
    gym.id,
    { variantId: vanilla!.id, type: "INVENTORY_ADJUSTMENT", quantity: 5 },
    user.id,
  );
  const afterAdjust = await prisma.productVariant.findUniqueOrThrow({ where: { id: vanilla!.id } });
  check("ajuste de inventário fixa o saldo contado", afterAdjust.currentQuantity === 5, `${afterAdjust.currentQuantity} un.`);

  // --- pedido: sem baixa na criação, baixa na entrega ----------------------
  const order = await ordersService.createOrder(gym.id, {
    customerName: "Cliente Smoke",
    customerPhone: "5531999990000",
    deliveryType: "PICKUP",
    paymentMethod: "PIX",
    items: [{ variantId: vanilla!.id, quantity: 2 }],
  });
  check("pedido numerado por academia", order.orderNumber === 1, `#${order.orderNumber}`);

  const afterOrderCreate = await prisma.productVariant.findUniqueOrThrow({ where: { id: vanilla!.id } });
  check("criar pedido não baixa estoque", afterOrderCreate.currentQuantity === 5, `${afterOrderCreate.currentQuantity} un.`);

  let invalidTransition = false;
  try {
    await ordersService.updateStatus(gym.id, order.id, "DELIVERED", user.id);
  } catch (error) {
    invalidTransition = /não é possível mudar o pedido/i.test((error as Error).message);
  }
  check("transição PENDING → DELIVERED recusada", invalidTransition);

  await ordersService.updateStatus(gym.id, order.id, "SEPARATING", user.id);
  await ordersService.updateStatus(gym.id, order.id, "OUT_FOR_DELIVERY", user.id);
  await ordersService.updateStatus(gym.id, order.id, "DELIVERED", user.id);

  const afterDelivery = await prisma.productVariant.findUniqueOrThrow({ where: { id: vanilla!.id } });
  check("entrega baixou o estoque uma única vez", afterDelivery.currentQuantity === 3, `${afterDelivery.currentQuantity} un.`);

  const outMovements = await prisma.stockMovement.count({ where: { variantId: vanilla!.id, type: "OUT" } });
  check("entrega gerou uma movimentação OUT", outMovements === 1, `${outMovements} movimento(s)`);

  const history = await prisma.orderStatusHistory.count({ where: { orderId: order.id } });
  check("histórico de status completo", history === 4, `${history} entradas`);

  // --- entrega com estoque insuficiente desfaz tudo (sem baixa parcial) ----
  const bigOrder = await ordersService.createOrder(gym.id, {
    customerName: "Cliente Smoke 2",
    customerPhone: "5531999990001",
    deliveryType: "DELIVERY",
    address: "Rua A, 100",
    paymentMethod: "CASH",
    items: [
      { variantId: vanilla!.id, quantity: 3 },
      { variantId: chocolate!.id, quantity: 1 },
    ],
  });
  await ordersService.updateStatus(gym.id, bigOrder.id, "SEPARATING", user.id);
  await ordersService.updateStatus(gym.id, bigOrder.id, "OUT_FOR_DELIVERY", user.id);
  await inventoryService.registerMovement(gym.id, { variantId: vanilla!.id, type: "LOSS", quantity: 3 }, user.id);

  let partialBlocked = false;
  try {
    await ordersService.updateStatus(gym.id, bigOrder.id, "DELIVERED", user.id);
  } catch (error) {
    partialBlocked = /na entrega deste pedido/.test((error as Error).message);
  }
  const chocolateAfterFail = await prisma.productVariant.findUniqueOrThrow({ where: { id: chocolate!.id } });
  const bigOrderRow = await prisma.order.findUniqueOrThrow({ where: { id: bigOrder.id } });
  check(
    "entrega sem estoque não deixa baixa parcial",
    partialBlocked && chocolateAfterFail.currentQuantity === 21 && bigOrderRow.status === "OUT_FOR_DELIVERY",
    `chocolate=${chocolateAfterFail.currentQuantity} status=${bigOrderRow.status}`,
  );

  // --- financeiro e tempo real ---------------------------------------------
  const summary = await getFinanceSummary(gym.id);
  check("resumo financeiro reflete a venda", summary.today.revenue === 690 && summary.today.salesCount === 1, JSON.stringify(summary.today));
  check("ticket médio calculado", summary.averageTicket === 690, `R$ ${summary.averageTicket}`);
  check("pedidos abertos contados", summary.openOrders === 1, `${summary.openOrders}`);
  check(
    "valor de estoque calculado",
    summary.stock.investedValue > 0 && summary.stock.retailValue > summary.stock.investedValue,
    JSON.stringify(summary.stock),
  );

  const events = await prisma.realtimeEvent.findMany({ where: { gymId: gym.id }, select: { type: true, payload: true } });
  const eventTypes = new Set(events.map((event) => event.type));
  check(
    "sinais de tempo real publicados",
    eventTypes.has("sale.created") && eventTypes.has("order.created") && eventTypes.has("order.status_changed"),
    [...eventTypes].join(", "),
  );
  check(
    "payload de sinal não carrega valor monetário",
    events.every((event) => !JSON.stringify(event.payload).match(/amount|profit|price/i)),
    JSON.stringify(events[0]?.payload ?? {}),
  );

  const products = await listProducts(gym.id, { search: "whey" });
  check("busca de produto por nome", products.length === 1 && products[0]!.variants.length === 2, `${products.length} produto(s)`);

  const notifications = await prisma.notification.count({ where: { gymId: gym.id } });
  check("notificações do painel criadas", notifications >= 2, `${notifications} notificação(ões)`);

  // Limpeza: cascade a partir do gym.
  await prisma.gym.delete({ where: { id: gym.id } });
}

main()
  .then(() => {
    const failed = checks.filter((entry) => !entry.ok);
    for (const entry of checks) {
      // eslint-disable-next-line no-console
      console.log(`${entry.ok ? "PASS" : "FAIL"}  ${entry.name}${entry.detail ? `  [${entry.detail}]` : ""}`);
    }
    // eslint-disable-next-line no-console
    console.log(`\n${checks.length - failed.length}/${checks.length} verificações passaram`);
    process.exitCode = failed.length > 0 ? 1 : 0;
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Smoke falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
