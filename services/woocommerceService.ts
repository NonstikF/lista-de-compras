import type { Order } from '../types';

// ¡NUEVO! La URL de tu API de backend
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

/**
 * Esta es la única función que necesitamos.
 * Llama a nuestro backend en la ruta /api/orders,
 * y el backend se encarga de todo lo demás.
 */
export const getOrders = async (): Promise<Order[]> => {

  // 1. Llamamos a nuestro propio backend en la ruta /api/orders
  const response = await fetch(`${BACKEND_API_URL}/api/orders`);

  if (!response.ok) {
    // Si la respuesta es 404 o 500, esto lo mostrará
    const errorData = await response.json().catch(() => ({ message: `Error del backend: ${response.status}` }));
    throw new Error(errorData.message || `Error del backend: ${response.status}`);
  }

  // 2. El backend ya nos da los datos combinados y listos
  const orders: Order[] = await response.json();

  return orders;
};