import type { Supplier, Article, Recipe, StoreOrder, StoreOrderItem, SupplierTicket, SupplierTicketUpload, OrderTicket, OrderTicketUpload } from '../types';
import { AuthError } from './woocommerceService';

export { AuthError };

const BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

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
    data: { customerName: string; notes: string; items: StoreOrderItem[] },
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
