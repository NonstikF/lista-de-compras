# Runbook PROD: Desacoplar WooCommerce

Sigue **estricto**. NO saltar pasos. Si algo falla, abortar y restaurar snapshot.

## 0. Pre-vuelo

- [ ] Staging probado y funcionando (commit `6130369`).
- [ ] Acceso Railway prod (dashboard + service Postgres prod).
- [ ] Creds Woo prod a mano (`WOO_URL`, `WOO_KEY`, `WOO_SECRET`).
- [ ] DATABASE_URL publica de prod (host con `.proxy.rlwy.net`).
- [ ] Ventana de bajo trafico Woo (idealmente noche).
- [ ] Comunicar al equipo que prod entra en migracion.

## 1. Snapshot DB prod

- [ ] Railway dashboard → service Postgres prod → Settings → "Backups" → crear snapshot manual.
- [ ] Verificar snapshot completado (tarda segundos).
- [ ] **Tomar nota de hora y nombre del snapshot**.

## 2. Mover phase2 fuera del repo local (NO commitear)

```powershell
cd backend
mv prisma/migrations/20260524000001_decouple_woocommerce_phase2 ./_phase2_tmp
```

Esto evita que el primer deploy aplique phase2 antes del archive-woo.

## 3. Crear branch temporal "deploy-phase1"

```powershell
git checkout -b deploy-phase1-woo
git rm -r prisma/migrations/20260524000001_decouple_woocommerce_phase2 2>&1
git commit -m "temp: deploy phase1 only (phase2 sigue tras archive-woo)"
```

## 4. Merge a main + push

```powershell
git checkout main
git merge --no-ff deploy-phase1-woo
git push origin main
```

Railway prod detecta push → deploya:
- Pre-deploy: `prisma migrate deploy` aplica phase1.
- Build + start: backend nuevo (adapter sobre StoreOrder) levanta.

**Estado intermedio**: backend lee `StoreOrder`. Pedidos Woo NO visibles porque aun no archivados. Esto es esperado, dura minutos.

- [ ] Verificar Railway logs: phase1 aplicada sin error.
- [ ] Verificar `/api/orders` responde 200 con array (vacio o con pedidos nativos previos).

## 5. Configurar .env local para apuntar a prod

```powershell
# Backup actual staging .env
mv backend/.env backend/.env.staging-backup

# Crear .env apuntando a prod:
# DATABASE_URL="postgresql://...proxy.rlwy.net.../railway"  # publica prod
# WOO_URL="https://plantarte1.com"
# WOO_KEY="ck_..."
# WOO_SECRET="cs_..."
```

- [ ] `.env` apunta a **PROD**, no staging.

## 6. Correr archive-woo contra prod

```powershell
cd backend
npx prisma generate
npm run archive-woo
```

- [ ] Output muestra `ordersCreated > 0`.
- [ ] `ticketsOrphan: 0` (o numero esperado).
- [ ] **Anotar conteos** (orders, items, tickets, purchaseStatus).
- [ ] Volver a correr para verificar idempotencia: `ordersCreated: 0`, `ordersSkipped == total`.

## 7. Validar en DB prod via Prisma

```powershell
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const a=await p.storeOrder.count({where:{legacyWooOrderId:{not:null}}});const b=await p.storeOrderItem.count({where:{legacyWooLineItemId:{not:null}}});console.log({legacyOrders:a,legacyItems:b});process.exit(0)})()"
```

- [ ] Numeros razonables (parecidos al conteo de pedidos en WP admin).

## 8. Smoke test UI prod

- [ ] Login en app prod.
- [ ] Tab Pedidos "Activos" muestra pedidos.
- [ ] Abrir un pedido legacy: items, precios OK.
- [ ] Tickets visibles en pedidos correspondientes.

## 9. Restaurar phase2 y segundo deploy

```powershell
git checkout main
mv backend/_phase2_tmp backend/prisma/migrations/20260524000001_decouple_woocommerce_phase2
git add backend/prisma/migrations/20260524000001_decouple_woocommerce_phase2
git commit -m "feat: phase2 migration (cleanup PurchaseStatus + FK OrderTicket)"
git push origin main
```

Railway prod aplica phase2:
- Borra tickets huerfanos (deberian ser 0 si archive funciono).
- Agrega FK OrderTicket → StoreOrder.
- Drop `PurchaseStatus`, `PurchaseStatusBySupplier`.

- [ ] Verificar Railway logs: phase2 aplicada sin error.
- [ ] Smoke test UI: pedidos siguen funcionando.

## 10. Limpieza

- [ ] Railway prod → eliminar vars `WOO_URL`, `WOO_KEY`, `WOO_SECRET`.
- [ ] Borrar branch local `deploy-phase1-woo`: `git branch -d deploy-phase1-woo`.
- [ ] Borrar `backend/.env` (con creds prod) o restaurar staging backup.
- [ ] Borrar `backend/.env.prod-backup`, `backend/.env.staging-backup` cuando ya no se necesiten.
- [ ] Opcional: `npm uninstall axios` en backend.
- [ ] Anuncio al equipo: migracion completa.

## Rollback (si algo sale mal)

### Antes de paso 4 (push main)
Solo borra branch temporal: `git branch -D deploy-phase1-woo`. Cero impacto.

### Entre paso 4 y paso 9
- Railway prod → service Postgres → restaurar snapshot (paso 1).
- `git revert <commit-merge>` en main, push.
- Railway redeploya version vieja con DB restaurada.

### Despues de paso 9
- Restaurar snapshot.
- Revert dos commits (`HEAD~1` y `HEAD~2`).
- Push.
- Redeploy.

## FAQ rapidas

**Q: Y si archive-woo falla a mitad?**
A: Idempotente. Vuelve a correrlo. Pedidos ya creados se saltan via `legacyWooOrderId @unique`.

**Q: Pedidos nuevos en Woo entre paso 4 y paso 6?**
A: Se pierden si no se archivan. Por eso ventana de bajo trafico. Si llegan algunos, re-correr archive-woo los capta.

**Q: Codigo backend nuevo necesita las vars `WOO_*` para algo?**
A: No. Solo el script `archive-woo.ts` las usa. Tras paso 6, vars son innecesarias.

**Q: Y si phase2 borra tickets que necesito?**
A: Phase2 borra solo tickets con `orderId` que NO mapea a `StoreOrder.id`. Si archive corrio bien, son 0.
