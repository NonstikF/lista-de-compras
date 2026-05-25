# Runbook: Desacoplar WooCommerce (Staging)

Orden estricto. NO saltar pasos. Si algo falla, abortar y restaurar backup.

## Prerequisitos

- DB Postgres de **staging** separada de prod (confirmado).
- Credenciales WooCommerce aun activas (`WOO_URL`, `WOO_KEY`, `WOO_SECRET`).
- Acceso al Railway project de staging.
- Backup completo: `pg_dump $STAGING_DATABASE_URL > backup-pre-woo-decouple.sql`.

## Estado actual antes de empezar

Verifica conteos para dimensionar:

```sql
SELECT COUNT(*) FROM "Article" WHERE "wooProductId" IS NOT NULL;
SELECT COUNT(*) FROM "PurchaseStatus";
SELECT COUNT(*) FROM "PurchaseStatusBySupplier";
SELECT COUNT(*) FROM "OrderTicket";
SELECT COUNT(*) FROM "StoreOrder";
```

Anota numeros. Despues validas.

---

## Paso 1 — Backup DB

```powershell
$env:PGPASSWORD = "..."
pg_dump -h ... -U ... -d railway > backup-pre-woo-decouple-$(Get-Date -Format yyyyMMdd-HHmm).sql
```

Sin backup no continues.

## Paso 2 — Aplicar migracion phase1

Solo agrega columnas `legacy*` y renombra `Article.wooProductId` -> `legacyWooProductId`. No borra nada.

```powershell
cd backend
$env:DATABASE_URL = "postgres://...staging..."
npx prisma migrate deploy
```

Output esperado: aplica `20260524000000_decouple_woocommerce_phase1`.

**IMPORTANTE**: Esta migracion sola aplica phase1. Phase2 esta en carpeta pero su `migration.sql` requiere que archive-woo.ts haya corrido primero. `prisma migrate deploy` aplica ambas seguidas — si haces deploy con todo, salta a Paso 4.

### Opcion A — Aplicar solo phase1 manualmente (recomendado):

```powershell
psql $env:DATABASE_URL -f prisma/migrations/20260524000000_decouple_woocommerce_phase1/migration.sql
# marca como aplicada en _prisma_migrations:
psql $env:DATABASE_URL -c "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (gen_random_uuid(), 'manual', NOW(), '20260524000000_decouple_woocommerce_phase1', NOW(), 1);"
```

### Opcion B — Eliminar temporalmente phase2 del repo, deploy, archivar, restaurar phase2:

```powershell
# 1. mover phase2 fuera
Move-Item prisma/migrations/20260524000001_decouple_woocommerce_phase2 ../phase2-tmp
# 2. deploy
npx prisma migrate deploy
# 3. continuar al paso 3 (archive-woo), luego restaurar:
Move-Item ../phase2-tmp prisma/migrations/20260524000001_decouple_woocommerce_phase2
```

## Paso 3 — Backend en estado mixto

Codigo backend usa `legacyWooProductId` y `prisma.purchaseStatus`. Schema actualizado declara FK OrderTicket pero **no aplicada aun en DB**. El cliente Prisma generado **no incluye PurchaseStatus** (porque schema lo elimino).

Por tanto: **NO redeployar backend aun**. Mantener backend version anterior (commit antes de este cambio) hasta correr archive-woo.

Alternativa: ejecutar archive-woo desde local (donde el repo es el actual) apuntando a DB staging. Esto es lo recomendado:

## Paso 4 — Ejecutar archive-woo.ts (LOCAL apuntando a staging)

Genera Prisma client primero, luego corre snapshot.

```powershell
cd backend
$env:DATABASE_URL = "postgres://...staging..."
$env:WOO_URL = "https://tu-tienda.com"
$env:WOO_KEY = "ck_..."
$env:WOO_SECRET = "cs_..."

# Genera cliente actualizado
npx prisma generate

# Dry run primero (no escribe nada):
$env:ARCHIVE_DRY_RUN = "1"
npm run archive-woo

# Si numeros se ven razonables, ejecutar real:
$env:ARCHIVE_DRY_RUN = ""
npm run archive-woo
```

Output esperado al final:

```json
{
  "ordersScanned": 1234,
  "ordersCreated": 1234,
  "ordersSkipped": 0,
  "itemsCreated": 5678,
  "ticketsRepointed": N,
  "ticketsOrphan": 0,
  "purchaseStatusApplied": M
}
```

**Validar**:
- `ordersScanned == ordersCreated + ordersSkipped`.
- `ticketsOrphan` deberia ser 0 (o muy bajo y aceptable).

Si `ticketsOrphan > 0`, inspeccionar IDs huerfanos antes de phase2 (porque phase2 los borra):

```sql
SELECT id, "orderId", "supplierName", "filename"
FROM "OrderTicket"
WHERE "orderId" NOT IN (SELECT id FROM "StoreOrder");
```

## Paso 5 — Aplicar migracion phase2

Borra `PurchaseStatus*`, agrega FK `OrderTicket -> StoreOrder`, borra tickets huerfanos.

Si elegiste **Opcion B** del paso 2, restaurar carpeta phase2 primero (`Move-Item`).

```powershell
npx prisma migrate deploy
```

## Paso 6 — Deploy backend (codigo nuevo)

Ahora si, commit + push del codigo nuevo a Railway staging.

```powershell
git add -A
git commit -m "feat: desacoplar WooCommerce (snapshot a StoreOrder)"
git push origin <staging-branch>
```

Railway aplicara `prisma migrate deploy` (pre-deploy) — ya esta todo aplicado, no-op.

## Paso 7 — Validacion smoke

En UI staging:

1. **Pedidos**: tab "Activos" muestra pedidos con `status=pending` (incluye los migrados desde Woo `processing`/`on-hold`).
2. **Pedidos**: tab "Completados" muestra los `status=completed` (los `completed`/`cancelled`/`refunded` de Woo).
3. **Abrir un pedido migrado**: verificar items con nombres, cantidades y precio correctos.
4. **Tickets**: tickets antiguos deben aparecer en su pedido original (verificar con un pedido conocido que tenia tickets en Woo).
5. **Articulos**: lista carga sin error. Sin boton "Importar WooCommerce".
6. **Proveedores**: pill "Pedido" (antes "WooCommerce") visible donde aplique.

## Paso 8 — Limpieza vars entorno

En Railway staging:
- Eliminar `WOO_URL`, `WOO_KEY`, `WOO_SECRET`.
- Opcional: `npm uninstall axios` en backend si no se necesita para nada mas (verifica primero).

## Rollback

Si algo sale mal antes del paso 6:

```powershell
psql $env:DATABASE_URL < backup-pre-woo-decouple-...sql
```

Si sale mal despues del paso 6: restaurar backup + revertir commit + redeploy.

---

## Tras validar staging — replicar a prod

Mismo orden. Mismas variables. Backup obligatorio. `archive-woo.ts` es idempotente: si lo corres dos veces con misma DB no duplica (usa `legacyWooOrderId @unique`).
