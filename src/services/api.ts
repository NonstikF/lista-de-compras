import type {
  Order,
  User,
  Supplier,
  Article,
  Recipe,
  StoreOrder,
  StoreOrderItem,
  SupplierTicket,
  SupplierTicketUpload,
  OrderTicket,
  OrderTicketUpload,
  InventoryItem,
  InventoryMovement,
  Location,
  CompanySettings,
  UserPermissions,
} from '../types';

const BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

export type OrderStatusType = 'processing' | 'completed';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new AuthError('Sesion expirada. Inicia sesion de nuevo.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.json();
}

// ---- Pedidos (adapter sobre StoreOrder, formato legacy) ----

export const getOrders = async (status: OrderStatusType, token: string): Promise<Order[]> => {
  return handleResponse(await fetch(`${BASE}/api/orders?status=${status}`, {
    headers: authHeaders(token),
  }));
};

export const saveItemStatus = async (
  token: string,
  data: { lineItemId: number; orderId: number; isPurchased: boolean; quantityPurchased: number; supplierId?: string; totalQuantity?: number }
): Promise<{ success: boolean }> => {
  return handleResponse(await fetch(`${BASE}/api/item-status`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  }));
};

export const completeOrder = async (token: string, orderId: number): Promise<{ success: boolean }> => {
  return handleResponse(await fetch(`${BASE}/api/orders/${orderId}/complete`, {
    method: 'POST',
    headers: authHeaders(token),
  }));
};

// ---- Usuarios ----

export async function getUsers(token: string): Promise<User[]> {
  return handleResponse(await fetch(`${BASE}/api/users`, { headers: authHeaders(token) }));
}

export async function createUser(token: string, data: { username: string; nombre: string; password: string; permissions: UserPermissions }): Promise<User> {
  return handleResponse(await fetch(`${BASE}/api/users`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function updateUser(token: string, id: string, data: { nombre?: string; password?: string; activo?: boolean; permissions?: UserPermissions }): Promise<User> {
  return handleResponse(await fetch(`${BASE}/api/users/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteUser(token: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/users/${id}`, { method: 'DELETE', headers: authHeaders(token) });
  if (res.status === 401) throw new AuthError('Sesion expirada. Inicia sesion de nuevo.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new Error(data.error || `Error ${res.status}`);
  }
}

// ---- Proveedores ----

export async function getSuppliers(token: string): Promise<Supplier[]> {
  return handleResponse(await fetch(`${BASE}/api/suppliers`, { headers: authHeaders(token) }));
}

export async function createSupplier(token: string, data: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier> {
  return handleResponse(await fetch(`${BASE}/api/suppliers`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function updateSupplier(token: string, id: string, data: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteSupplier(token: string, id: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/suppliers/${id}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

// ---- Tickets de pedido ----

export async function getOrderTicketCounts(token: string, orderId: number): Promise<Record<string, number>> {
  return handleResponse(await fetch(`${BASE}/api/orders/${orderId}/ticket-counts`, {
    headers: authHeaders(token),
  }));
}

export async function getOrderTickets(token: string, orderId: number, supplierName?: string): Promise<OrderTicket[]> {
  const params = supplierName ? `?supplierName=${encodeURIComponent(supplierName)}` : '';
  return handleResponse(await fetch(`${BASE}/api/orders/${orderId}/tickets${params}`, {
    headers: authHeaders(token),
  }));
}

export async function getOrderTicketContent(token: string, orderId: number, ticketId: string): Promise<OrderTicket> {
  return handleResponse(await fetch(`${BASE}/api/orders/${orderId}/tickets/${ticketId}`, {
    headers: authHeaders(token),
  }));
}

export async function createOrderTicket(token: string, orderId: number, data: OrderTicketUpload): Promise<OrderTicket> {
  return handleResponse(await fetch(`${BASE}/api/orders/${orderId}/tickets`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteOrderTicket(token: string, orderId: number, ticketId: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/orders/${orderId}/tickets/${ticketId}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

export async function updateOrderTicketInvoiced(token: string, orderId: number, ticketId: string, invoiced: boolean): Promise<OrderTicket> {
  return handleResponse(await fetch(`${BASE}/api/orders/${orderId}/tickets/${ticketId}`, {
    method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ invoiced }),
  }));
}

// ---- Tickets de proveedor ----

export async function getSupplierTickets(token: string, supplierId: string): Promise<SupplierTicket[]> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/${supplierId}/tickets`, {
    headers: authHeaders(token),
  }));
}

export async function getSupplierTicketContent(token: string, supplierId: string, ticketId: string): Promise<SupplierTicket> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/${supplierId}/tickets/${ticketId}`, {
    headers: authHeaders(token),
  }));
}

export async function createSupplierTicket(token: string, supplierId: string, data: SupplierTicketUpload): Promise<SupplierTicket> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/${supplierId}/tickets`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteSupplierTicket(token: string, supplierId: string, ticketId: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/suppliers/${supplierId}/tickets/${ticketId}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

export async function getSupplierOrderTickets(token: string, supplierId: string): Promise<OrderTicket[]> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/${supplierId}/order-tickets`, {
    headers: authHeaders(token),
  }));
}

export async function getSupplierPendingInvoicedCounts(token: string): Promise<Record<string, number>> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/pending-invoiced-counts`, {
    headers: authHeaders(token),
  }));
}

export async function updateSupplierTicketInvoiced(token: string, supplierId: string, ticketId: string, invoiced: boolean): Promise<SupplierTicket> {
  return handleResponse(await fetch(`${BASE}/api/suppliers/${supplierId}/tickets/${ticketId}`, {
    method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ invoiced }),
  }));
}

// ---- Artículos ----

export async function getArticles(token: string): Promise<Article[]> {
  return handleResponse(await fetch(`${BASE}/api/articles`, { headers: authHeaders(token) }));
}

export async function createArticle(token: string, data: Omit<Article, 'id'>): Promise<Article> {
  return handleResponse(await fetch(`${BASE}/api/articles`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function updateArticle(token: string, id: string, data: Omit<Article, 'id'>): Promise<Article> {
  return handleResponse(await fetch(`${BASE}/api/articles/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteArticle(token: string, id: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/articles/${id}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

// ---- Recetas ----

export async function getRecipes(token: string): Promise<Recipe[]> {
  return handleResponse(await fetch(`${BASE}/api/recipes`, { headers: authHeaders(token) }));
}

export async function createRecipe(token: string, data: Omit<Recipe, 'id'>): Promise<Recipe> {
  return handleResponse(await fetch(`${BASE}/api/recipes`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function updateRecipe(token: string, id: string, data: Omit<Recipe, 'id'>): Promise<Recipe> {
  return handleResponse(await fetch(`${BASE}/api/recipes/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteRecipe(token: string, id: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/recipes/${id}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

// ---- Pedidos de Tienda ----

export async function getStoreOrders(token: string): Promise<StoreOrder[]> {
  return handleResponse(await fetch(`${BASE}/api/store-orders`, { headers: authHeaders(token) }));
}

export async function createStoreOrder(
  token: string,
  data: { customerName: string; customerPhone?: string; notes: string; items: Pick<StoreOrderItem, 'articleId' | 'name' | 'price' | 'qty' | 'imageUrl' | 'supplierName'>[] },
): Promise<StoreOrder> {
  return handleResponse(await fetch(`${BASE}/api/store-orders`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function completeStoreOrder(token: string, id: string): Promise<StoreOrder> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${id}/complete`, {
    method: 'PATCH', headers: authHeaders(token),
  }));
}

export async function updateStoreItemStatus(
  token: string,
  orderId: string,
  itemId: number,
  data: { isPurchased?: boolean; quantityPurchased?: number },
): Promise<{ item: StoreOrderItem; siblingUpdates: StoreOrderItem[] }> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/items/${itemId}`, {
    method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function getStoreOrderTickets(token: string, orderId: string): Promise<OrderTicket[]> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/tickets`, { headers: authHeaders(token) }));
}

export async function getStoreOrderTicketContent(token: string, orderId: string, ticketId: string): Promise<OrderTicket> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/tickets/${ticketId}`, { headers: authHeaders(token) }));
}

export async function createStoreOrderTicket(token: string, orderId: string, data: { filename: string; mimeType: string; size: number; content: string }): Promise<OrderTicket> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/tickets`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteStoreOrderTicket(token: string, orderId: string, ticketId: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/tickets/${ticketId}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

export async function addStoreOrderItem(
  token: string,
  orderId: string,
  data: { articleId: string; name: string; price: number; qty: number; imageUrl?: string | null; supplierName?: string; supplierId?: string },
): Promise<{ item: StoreOrderItem; order: { total: number } }> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/items`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteStoreOrderItem(
  token: string,
  orderId: string,
  itemId: number,
): Promise<{ success: boolean; order: { total: number } }> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/items/${itemId}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

export async function editStoreOrderItem(
  token: string,
  orderId: string,
  itemId: number,
  data: { qty?: number; price?: number; supplierName?: string },
): Promise<{ item: StoreOrderItem; order: { total: number } }> {
  return handleResponse(await fetch(`${BASE}/api/store-orders/${orderId}/items/${itemId}`, {
    method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

// ---- Configuración de empresa ----

export async function getSettings(token: string): Promise<CompanySettings> {
  return handleResponse(await fetch(`${BASE}/api/settings`, { headers: authHeaders(token) }));
}

export async function updateSettings(token: string, data: { name?: string; logo?: string | null }): Promise<CompanySettings> {
  return handleResponse(await fetch(`${BASE}/api/settings`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

// ---- Inventario ----

export async function getInventory(token: string): Promise<InventoryItem[]> {
  return handleResponse(await fetch(`${BASE}/api/inventory`, { headers: authHeaders(token) }));
}

export async function updateInventoryItem(
  token: string,
  id: string,
  data: { stockMin?: number; unit?: string; locationId?: string | null },
): Promise<InventoryItem> {
  return handleResponse(await fetch(`${BASE}/api/inventory/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

// ---- Ubicaciones ----

export async function getLocations(token: string): Promise<Location[]> {
  return handleResponse(await fetch(`${BASE}/api/locations`, { headers: authHeaders(token) }));
}

export async function getLocation(token: string, id: string): Promise<Location & { items: InventoryItem[] }> {
  return handleResponse(await fetch(`${BASE}/api/locations/${id}`, { headers: authHeaders(token) }));
}

export async function getLocationByCode(token: string, code: string): Promise<Location & { items: InventoryItem[] }> {
  return handleResponse(await fetch(`${BASE}/api/locations/by-code/${encodeURIComponent(code)}`, { headers: authHeaders(token) }));
}

export async function createLocation(token: string, data: { name: string; code?: string; description?: string; active?: boolean }): Promise<Location> {
  return handleResponse(await fetch(`${BASE}/api/locations`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function updateLocation(token: string, id: string, data: { name?: string; code?: string; description?: string; active?: boolean }): Promise<Location> {
  return handleResponse(await fetch(`${BASE}/api/locations/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteLocation(token: string, id: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/api/locations/${id}`, {
    method: 'DELETE', headers: authHeaders(token),
  }));
}

export async function addInventoryMovement(
  token: string,
  itemId: string,
  data: { type: 'entrada' | 'salida' | 'ajuste'; quantity: number; reason: string },
): Promise<InventoryMovement> {
  return handleResponse(await fetch(`${BASE}/api/inventory/${itemId}/movements`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function getInventoryMovements(token: string, itemId: string): Promise<InventoryMovement[]> {
  return handleResponse(await fetch(`${BASE}/api/inventory/${itemId}/movements`, {
    headers: authHeaders(token),
  }));
}
