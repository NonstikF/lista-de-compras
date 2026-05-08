# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado [SemVer](https://semver.org/lang/es/).

## [Unreleased] — 2026-05-07

### Inventario: rediseño UX + sincronización automática con artículos

#### Added — Frontend ([components/InventoryView.tsx](components/InventoryView.tsx))
- **Búsqueda en vivo**: input sticky con icono lupa, debounce 180 ms, botón limpiar, ESC limpia, atajo `Ctrl+K` enfoca el campo.
- **Stat cards clickeables** (Total / Stock bajo / Agotado): muestran conteo y filtran al hacer clic; estado activo resaltado.
- **Chips de categorías**: derivados de los artículos del inventario, scroll horizontal en móvil, toggle activo.
- **Ordenamiento**: dropdown con Nombre A–Z / Stock asc / Stock desc / Por categoría.
- **Persistencia de preferencias**: filtro de stock, categoría y orden guardados en `localStorage` (clave `inventory:prefs:v1`).
- **Barra de progreso de stock** por fila (verde / ámbar / rojo) basada en `stock / (stockMin × 2)`.
- **Indicadores de estado**: badge `Agotado` (stock ≤ 0) y `Bajo` (stock ≤ stockMin), borde de tarjeta tintado.
- **Skeleton loading** (5 filas) en lugar de spinner centrado.
- **Empty states diferenciados**: sin artículos vs. sin resultados de búsqueda con cita del query y botón limpiar filtros.
- **Contador de resultados** "X de Y" cuando hay filtros activos, con CTA limpiar.
- **`MobileMoreMenu`**: menú overflow en móvil para acciones secundarias (ajuste, historial, editar). Acciones primarias (entrada/salida) siempre visibles.
- **Preview de stock en `MovementModal`**: muestra "Stock actual → Quedará" coloreado por tipo de movimiento.
- **Validación de salida**: bloquea cantidad mayor al stock disponible con mensaje específico.
- **Sugerencias rápidas de motivo**: chips clickeables y `<datalist>` por tipo de movimiento (entrada / salida / ajuste).
- **`inputMode="decimal"`** en cantidad para teclado numérico en móvil.
- **Sugerencias de unidad** vía `<datalist>` en `EditItemModal` (kg, g, litros, ml, pieza, caja, paquete).

#### Changed — Frontend
- Header: layout sticky con búsqueda + sort siempre accesibles al hacer scroll.
- Cards: hover shadow, `active:scale-95` en botones para feedback táctil, padding ajustado en móvil.
- `EditItemModal` ya solo edita `stockMin` y `unit` (sin stock inicial — se gestiona vía movimientos).

#### Removed — Frontend
- `AddItemModal` y `ArticleCombobox` (el inventario ya no se gestiona manualmente).
- Botón "Agregar insumo" en header y FAB móvil.
- Botón eliminar en cards y opción "Eliminar" del menú móvil.
- Modal de confirmación de eliminación.
- Imports no usados: `getArticles`, `createInventoryItem`, `deleteInventoryItem`, tipo `Article`.

### Sincronización automática Artículo ↔ Inventario

#### Added — Backend ([backend/src/index.ts](backend/src/index.ts))
- **`ensureInventoryForAllArticles()`**: helper que ejecuta `prisma.inventoryItem.createMany({ skipDuplicates: true })` para los artículos huérfanos (sin item).
- Llamada al helper al inicio de `GET /api/inventory` — garantiza que todos los artículos existentes tengan item al consultar el inventario (backfill perezoso).
- Llamada al helper al final de `POST /api/articles/import-woocommerce` — backfill explícito tras importación masiva.

#### Changed — Backend
- `POST /api/articles`: crea `inventory: { create: {} }` en la misma transacción → cada artículo nuevo nace con un `InventoryItem` (defaults: stock 0, stockMin 0, unit "unidad").
- `POST /api/articles/import-woocommerce`: cada artículo creado lleva `inventory: { create: {} }` nested.

#### Removed — Backend
- `POST /api/inventory` (creación manual ya no aplica — la invariante 1:1 lo hace innecesario).
- `DELETE /api/inventory/:id` (el cascade `onDelete: Cascade` desde `Article` ya limpia el item al borrar el artículo).
- `createInventoryItemSchema` (sin uso tras quitar el endpoint).

### Invariante del modelo
- Cada `Article` tiene exactamente un `InventoryItem`. Crear/importar artículo → item automático. Borrar artículo → cascade. La UI de inventario solo configura `stockMin` / `unit` y registra movimientos.

### Migración
- No requiere migración SQL manual: el primer `GET /api/inventory` posterior al deploy crea los items faltantes para los artículos preexistentes.

### Compatibilidad
- **Breaking (API)**: `POST /api/inventory` y `DELETE /api/inventory/:id` eliminados. Si algún cliente externo los consume → adaptar.
- Frontend de este repo ya migrado.

---

## [Previo] — historial pre-CHANGELOG (referencial)

Cambios anteriores documentados en `git log`. Hitos relevantes:

- `9816029` — InventoryView: tracking de movimientos, edición e historial.
- `9a975ca` — InventoryView: combobox de artículos y modales de gestión (sustituido por sincronización automática en esta entrada).
- `cdd12d8` — Sistema de inventario: schema Prisma, servicio backend, componentes UI iniciales.
- `356328f` — Init backend: dependencias y seed de admin.
- `3ba227c` — Sistema de usuarios: schema, auth, seed, integración admin.
- `1d965ee` — Badge de conteo de tickets por proveedor en lista de pedidos.
- `8802ea4` — Fix: imagen comprimida ≤ 1 MB.
- `f54acd9` — Crop manual de imagen antes de subir ticket.
- `835856e` — Compresión automática de imágenes antes de subir ticket.
- `5c8ffdd` — Previsualización del ticket al subir.
- `e2d7a79` / `b7fe4a8` — Subida y gestión de tickets de compra por proveedor.
- `005eef6` — Importación de artículos desde WooCommerce.
- `465e4e3` — Fix: permitir imágenes en artículos.
- `db3fb45` — Fix: evitar pantalla en blanco en recetas.
