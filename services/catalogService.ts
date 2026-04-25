import type { Supplier, Article, Recipe, StoreOrder, StoreOrderItem } from '../types';
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
