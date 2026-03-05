import type { Order } from '../types';

// La URL de tu API de backend
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

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
        'Authorization': `Bearer ${token}`,
    };
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401 || response.status === 403) {
        throw new AuthError('Sesion expirada. Inicia sesion de nuevo.');
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Error del backend: ${response.status}` }));
        throw new Error(errorData.error || `Error del backend: ${response.status}`);
    }
    return response.json();
}

export const getOrders = async (status: OrderStatusType, token: string): Promise<Order[]> => {
    const response = await fetch(`${BACKEND_API_URL}/api/orders?status=${status}`, {
        headers: authHeaders(token),
    });
    return handleResponse<Order[]>(response);
};

export const saveItemStatus = async (
    token: string,
    data: { lineItemId: number; orderId: number; isPurchased: boolean; quantityPurchased: number }
): Promise<{ success: boolean }> => {
    const response = await fetch(`${BACKEND_API_URL}/api/item-status`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean }>(response);
};

export const completeOrder = async (token: string, orderId: number): Promise<{ success: boolean }> => {
    const response = await fetch(`${BACKEND_API_URL}/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    return handleResponse<{ success: boolean }>(response);
};
