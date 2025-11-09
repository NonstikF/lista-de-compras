import type { Order } from '../types';

// La URL de tu API de backend
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

// ¡NUEVO! Definimos los tipos de estado que podemos solicitar
export type OrderStatusType = 'processing' | 'completed';

/**
 * ¡MODIFICADO!
 * Ahora acepta un parámetro 'status' para decirle al backend
 * qué pedidos queremos.
 */
export const getOrders = async (status: OrderStatusType): Promise<Order[]> => {
  
  // 1. Llamamos a nuestro backend, añadiendo el estado como parámetro de consulta
  const response = await fetch(`${BACKEND_API_URL}/api/orders?status=${status}`);

  if (!response.ok) {
    // Si la respuesta es 404 o 500, esto lo mostrará
    const errorData = await response.json().catch(() => ({ message: `Error del backend: ${response.status}` }));
    throw new Error(errorData.message || `Error del backend: ${response.status}`);
  }

  // 2. El backend nos da los datos listos
  const orders: Order[] = await response.json();
  
  return orders;
};