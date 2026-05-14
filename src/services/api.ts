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
  if (res.status === 401 || res.status === 403) throw new AuthError('Sesion expirada. Inicia sesion de nuevo.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Error ${res.status}` }));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.json();
}

// ---- Pedidos WooCommerce ----

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

export async function createUser(token: string, data: { username: string; nombre: string; password: string }): Promise<User> {
  return handleResponse(await fetch(`${BASE}/api/users`, {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function updateUser(token: string, id: string, data: { nombre?: string; password?: string; activo?: boolean }): Promise<User> {
  return handleResponse(await fetch(`${BASE}/api/users/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
  }));
}

export async function deleteUser(token: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/users/${id}`, { method: 'DELETE', headers: authHeaders(token) });
  if (res.status === 401 || res.status === 403) throw new AuthError('Sesion expirada. Inicia sesion de nuevo.');
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

export interface ImportWooCommerceArticlesResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  articles: Article[];
}

export async function importWooCommerceArticles(token: string): Promise<ImportWooCommerceArticlesResult> {
  return handleResponse(await fetch(`${BASE}/api/articles/import-woocommerce`, {
    method: 'POST', headers: authHeaders(token),
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
  data: { customerName: string; customerPhone?: string; notes: string; items: StoreOrderItem[] },
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

// ---- Inventario ----

export async function getInventory(token: string): Promise<InventoryItem[]> {
  return handleResponse(await fetch(`${BASE}/api/inventory`, { headers: authHeaders(token) }));
}

export async function updateInventoryItem(
  token: string,
  id: string,
  data: { stockMin?: number; unit?: string },
): Promise<InventoryItem> {
  return handleResponse(await fetch(`${BASE}/api/inventory/${id}`, {
    method: 'PUT', headers: authHeaders(token), body: JSON.stringify(data),
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
