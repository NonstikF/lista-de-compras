// Tus importaciones originales
import type { Order, LineItem } from '../types';



// ¡NUEVO! El tipo de dato que esperamos de NUESTRO backend
interface PurchaseStatusFromDB {
  lineItemId: number;
  isPurchased: boolean;
  quantityPurchased: number;
}

// This function now fetches live data from the WooCommerce API.
export const getOrders = async (
  apiUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<Order[]> => {
  // Ensure the URL is clean and doesn't have a trailing slash
  const cleanedApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  
  const ordersEndpoint = `${cleanedApiUrl}/wp-json/wc/v3/orders?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}&status=processing,on-hold&per_page=100`;

  try {
    const response = await fetch(ordersEndpoint);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }

    const rawOrders: any[] = await response.json();
    
    // Step 1: Collect all unique product IDs from all orders (Tu código original - sin cambios)
    const productIds = new Set<number>();
    rawOrders.forEach(order => {
        order.line_items.forEach((item: any) => {
            if (item.product_id) {
                productIds.add(item.product_id);
            }
        });
    });

    // Step 2: Fetch product details if there are any products (Tu código original - sin cambios)
    const productCategoryMap = new Map<number, string>();
    if (productIds.size > 0) {
        const productIdsArray = Array.from(productIds);
        const productsEndpoint = `${cleanedApiUrl}/wp-json/wc/v3/products?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}&include=${productIdsArray.join(',')}&per_page=100`;
        
        try {
            const productsResponse = await fetch(productsEndpoint);
            if (productsResponse.ok) {
                const rawProducts: any[] = await productsResponse.json();
                rawProducts.forEach(product => {
                    const categoryName = product.categories && product.categories.length > 0
                        ? product.categories[0].name
                        : 'Uncategorized';
                    productCategoryMap.set(product.id, categoryName);
                });
            } else {
                 console.warn(`Could not fetch product details. Status: ${productsResponse.status}`);
            }
        } catch (productError) {
            console.error("Error fetching product details:", productError);
            // Continue without category info if this fails
        }
    }

    // --- ¡NUEVO PASO 3! Obtener el progreso guardado de NUESTRO backend ---
    // Usamos la variable de entorno de Vite.
    const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';
    
    let savedStatus: PurchaseStatusFromDB[] = [];
    try {
      console.log(`Fetching saved status from ${BACKEND_API_URL}/api/all-status`);
      const statusResponse = await fetch(`${BACKEND_API_URL}/api/all-status`);
      if (statusResponse.ok) {
        savedStatus = await statusResponse.json();
      } else {
        console.warn(`Could not fetch saved progress. Status: ${statusResponse.status}`);
      }
    } catch (error) {
      console.error('Error fetching progress from backend:', error);
      // Continuamos sin progreso guardado si esto falla
    }

    // --- ¡NUEVO PASO 4! Convertir el progreso en un Mapa para búsqueda rápida ---
    const statusMap = new Map<number, Omit<PurchaseStatusFromDB, 'lineItemId'>>();
    savedStatus.forEach(status => {
      statusMap.set(status.lineItemId, { 
        isPurchased: status.isPurchased, 
        quantityPurchased: status.quantityPurchased 
      });
    });

    // --- PASO 5: Mapear la respuesta... (MODIFICADO) ---
    const orders: Order[] = rawOrders.map(order => ({
      id: order.id,
      dateCreated: order.date_created,
      status: order.status,
      customer: {
        firstName: order.billing.first_name,
        lastName: order.billing.last_name,
      },
      // --- SECCIÓN MODIFICADA ---
      // Ahora usamos el 'statusMap' para establecer el estado inicial
      lineItems: order.line_items.map((item: any): LineItem => {
        // Buscar si este artículo tiene un estado guardado
        const savedItemStatus = statusMap.get(item.id);

        return {
          id: item.id,
          name: item.name,
          productId: item.product_id,
          quantity: item.quantity,
          sku: item.sku,
          // Si hay estado guardado, úsalo. Si no, usa los valores por defecto.
          isPurchased: savedItemStatus ? savedItemStatus.isPurchased : false,
          quantityPurchased: savedItemStatus ? savedItemStatus.quantityPurchased : 0,
          category: productCategoryMap.get(item.product_id) || 'Products', // Tu lógica de categoría original
        };
      }),
    }));

    return orders;
  } catch (error) {
    console.error("Error fetching WooCommerce orders:", error);
    // Re-throw the error to be handled by the component
    throw error;
  }
};