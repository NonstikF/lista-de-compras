# Diseño del Sistema — PlantArte

## Descripción General

Aplicación web para gestión de pedidos de WooCommerce con notificaciones via Telegram. Permite a los empleados marcar productos como comprados conforme los surten, completar pedidos y consultar recetas de bebidas.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + Vite |
| Estilos | TailwindCSS |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL (Railway) |
| ORM | Prisma |
| Autenticación | JWT (HS256) |
| Bot | node-telegram-bot-api (polling) |
| Deploy | Railway |

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)               │
│  Login → Dashboard → Pedidos / Recetas / Config │
└────────────────────┬────────────────────────────┘
                     │ VITE_BACKEND_API_URL
                     ▼
┌─────────────────────────────────────────────────┐
│              Backend (Express)                  │
│  /api/login  /api/orders  /api/recipes          │
│  /api/item-status  /api/telegram/*              │
│                                                 │
│  ┌──────────────┐   ┌─────────────────────────┐ │
│  │  WooCommerce │   │   Bot de Telegram        │ │
│  │  REST API    │   │   (polling)              │ │
│  └──────────────┘   └─────────────────────────┘ │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │         productCache (en memoria)        │   │
│  │  Compartido entre app y bot — TTL 10min  │   │
│  └──────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────┘
                     │ Prisma
                     ▼
┌─────────────────────────────────────────────────┐
│              PostgreSQL (Railway)               │
│  PurchaseStatus / TelegramConfig /              │
│  TelegramKnownChat / Recipe / Ingredient        │
└─────────────────────────────────────────────────┘
```

---

## Módulos del Frontend

### Vistas
| Vista | Ruta lógica | Descripción |
|-------|-------------|-------------|
| Login | `login` | Autenticación con usuario/contraseña |
| Dashboard | `dashboard` | Panel principal con accesos directos |
| Pedidos | `orders` | Lista de pedidos pendientes/completados |
| Recetas | `recipes` | CRUD de recetas de bebidas |
| Configuración | `settings` | Configuración del bot de Telegram |

### Deep link
Al abrir `/?pedido=123` con sesión activa, la app navega directo al pedido `#123` y lo resalta.

### Componentes clave
- **OrderCard** — muestra un pedido expandible con ítems agrupados por categoría
- **CategorySection** — agrupa ítems por proveedor/categoría dentro de una orden
- **LineItemRow** — fila de producto con toggle comprado, contador parcial y botón de imagen
- **ProductImageModal** — modal para ver imagen del producto a pantalla completa
- **TelegramSettings** — formulario para configurar token, chatId y detección automática
- **RecipesView** — CRUD completo de recetas con ingredientes

---

## Módulos del Backend

### Rutas principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/login` | Genera JWT con credenciales del env |
| GET | `/api/orders` | Pedidos de WooCommerce + estado de compra |
| POST | `/api/item-status` | Marca ítem como comprado (parcial o total) |
| POST | `/api/orders/:id/complete` | Completa pedido y notifica faltantes por Telegram |
| GET | `/api/recipes` | Lista todas las recetas |
| POST | `/api/recipes` | Crea receta con ingredientes |
| PUT | `/api/recipes/:id` | Actualiza receta |
| DELETE | `/api/recipes/:id` | Elimina receta |
| GET | `/api/telegram/config` | Lee configuración del bot |
| POST | `/api/telegram/config` | Guarda configuración del bot |
| POST | `/api/telegram/test` | Envía mensaje de prueba |
| GET | `/api/telegram/chats` | Detecta chats disponibles del bot |

### Cache de productos
Cache en memoria compartido entre la app y el bot (`productCache.ts`). Almacena `category` e `imageUrl` por `product_id` con TTL de 10 minutos. Al actualizar con `imageUrl: null`, preserva el valor existente.

---

## Base de Datos

### Modelos Prisma

```
PurchaseStatus
  id              Int (PK)
  lineItemId      Int (unique) ← ID del ítem en WooCommerce
  orderId         Int
  isPurchased     Boolean
  quantityPurchased Int
  createdAt / updatedAt

TelegramConfig
  id              Int (PK = 1, singleton)
  botToken        String
  chatId          String
  allowedChatIds  String  ← separados por coma
  enabled         Boolean
  staleHours      Int

TelegramKnownChat
  id              String (PK = chat_id de Telegram)
  name            String
  type            String  ← private / group / supergroup / channel
  seenAt          DateTime

Recipe
  id              Int (PK)
  name            String
  description     String?
  instructions    String?
  imageUrl        String?
  category        String  ← default "Bebidas"
  ingredients     Ingredient[]
  createdAt / updatedAt

Ingredient
  id              Int (PK)
  recipeId        Int (FK → Recipe, cascade delete)
  name            String
  amount          String?
```

---

## Bot de Telegram

### Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/start` | Panel de botones interactivo |
| `/pedidos` | Lista pedidos pendientes con detalle por categoría |
| `/pedido [id]` | Detalle de un pedido específico |
| `/lista` | Lista de compras consolidada (suma ítems pendientes de todos los pedidos) |
| `/faltantes` | Ítems no comprados en pedidos ya completados |

### Panel inline
`/start` muestra 4 botones:
```
[ 📋 Ver Pedidos ]  [ 🛒 Lista de Compras ]
[ ⚠️ Faltantes   ]  [ 📊 Resumen del día  ]
```

### Notificaciones automáticas
- **Nuevo pedido** — polling cada 2 minutos detecta órdenes nuevas y envía mensaje al grupo con detalle y enlace directo a la app (`/?pedido=ID`)
- **Faltantes al completar** — al completar un pedido con ítems sin comprar, el backend envía mensaje con los productos faltantes agrupados por categoría

### Detección de chats
El bot guarda en `TelegramKnownChat` cada chat donde recibe mensajes. El endpoint `/api/telegram/chats` primero consulta la DB y hace fallback a `getUpdates` si no hay registros.

---

## Variables de Entorno

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
ADMIN_PASSWORD=...
WOO_URL=https://tu-tienda.com
WOO_KEY=ck_...
WOO_SECRET=cs_...
FRONTEND_URL=https://lista-de-compras-production.up.railway.app
```

### Frontend (`.env`)
```
VITE_BACKEND_API_URL=https://lista-de-compras-production.up.railway.app
```

---

## Flujo de Compra

```
1. Pedido llega a WooCommerce
       ↓
2. Bot detecta nuevo pedido (polling 2min)
       ↓
3. Bot notifica al grupo con enlace /?pedido=ID
       ↓
4. Empleado abre app → navega al pedido
       ↓
5. Marca ítems comprados (toggle o cantidad parcial)
       ↓
6. Completa pedido (con o sin faltantes)
       ↓
7. Si hay faltantes → bot notifica al grupo con lista agrupada por categoría
       ↓
8. WooCommerce actualiza estado a "completed"
```
