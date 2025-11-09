import React, { useState, useEffect } from 'react';
import type { Order, LineItem } from '../types';
// Importamos nuestro nuevo tipo OrderStatusType
import { getOrders, type OrderStatusType } from '../services/woocommerceService'; 
import { CheckCircleIcon } from './icons';

// La URL de tu API de backend
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

interface GroupedItems {
  [category: string]: LineItem[];
}

interface OrdersViewProps {
  // Sin props
}

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
);

const EmptyState: React.FC = () => (
    <div className="text-center py-16 px-6 bg-slate-100 rounded-lg">
        <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-2 text-xl font-medium text-slate-900">All caught up!</h3>
        <p className="mt-1 text-slate-500">There are no new orders to process right now.</p>
    </div>
);

const OrderItem: React.FC<{ item: LineItem; onQuantityChange: (itemId: number, newQuantity: number) => void }> = ({ item, onQuantityChange }) => {
    const isPurchased = item.isPurchased;
    const isInProgress = item.quantityPurchased > 0 && !isPurchased;

    const handleToggle = () => {
        const newQuantity = isPurchased ? 0 : item.quantity;
        onQuantityChange(item.id, newQuantity);
    };

    const handleIncrement = () => {
        if (item.quantityPurchased < item.quantity) {
            onQuantityChange(item.id, item.quantityPurchased + 1);
        }
    };

    const handleDecrement = () => {
        if (item.quantityPurchased > 0) {
            onQuantityChange(item.id, item.quantityPurchased - 1);
        }
    };
    
    const getBackgroundColor = () => {
        if (isPurchased) return 'bg-green-50 text-slate-500';
        if (isInProgress) return 'bg-yellow-50';
        return 'bg-white hover:bg-slate-50';
    };

    return (
        <div
            className={`flex items-center justify-between p-3 transition-all duration-300 ${getBackgroundColor()}`}
        >
            <div className="flex items-center space-x-4 flex-grow">
                <div className="flex-shrink-0">
                    <span className="text-indigo-600 font-bold text-lg">{item.quantity}x</span>
                </div>
                <div>
                    <p className={`font-semibold text-slate-800 ${isPurchased ? 'line-through' : ''}`}>
                        {item.name}
                    </p>
                    <p className="text-xs text-slate-400">SKU: {item.sku || 'N/A'}</p>
                </div>
            </div>

            <div className="flex items-center space-x-3">
                {item.quantity > 1 && (
                    <div className="flex items-center space-x-2">
                        <button onClick={handleDecrement} disabled={item.quantityPurchased === 0} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition">-</button>
                        <span className="font-mono text-base font-semibold text-slate-700 w-8 text-center">{item.quantityPurchased}</span>
                        <button onClick={handleIncrement} disabled={isPurchased} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition">+</button>
                    </div>
                )}
                 <button
                    onClick={handleToggle}
                    aria-label={`Mark ${item.name} as ${isPurchased ? 'not purchased' : 'purchased'}`}
                    className={`relative w-14 h-8 rounded-full flex items-center transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isPurchased ? 'bg-green-500 focus:ring-green-500' : 'bg-slate-300 focus:ring-indigo-500'
                    }`}
                >
                    <span
                        className={`inline-block w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-300 ${
                            isPurchased ? 'translate-x-7' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
        </div>
    );
};


const OrdersView: React.FC<OrdersViewProps> = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<OrderStatusType>('processing');
    const [completingOrderId, setCompletingOrderId] = useState<number | null>(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setOrders([]); 
                
                const fetchedOrders = await getOrders(viewMode); 
                
                setOrders(fetchedOrders.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()));
            } catch (err) {
                if (err instanceof Error) {
                    setError(`Failed to fetch orders: ${err.message}`);
                } else {
                    setError('An unknown error occurred while fetching orders.');
                }
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [viewMode]); 

    
    const handleQuantityChange = (itemId: number, newQuantity: number) => {
        
        let itemToSave: LineItem | null = null;
        let orderIdToSave: number | null = null;

        const foundOrder = orders.find(o => o.lineItems.some(i => i.id === itemId));
        if (!foundOrder) return; 

        const foundItem = foundOrder.lineItems.find(i => i.id === itemId);
        if (!foundItem) return;

        orderIdToSave = foundOrder.id;
        itemToSave = {
            ...foundItem,
            quantityPurchased: newQuantity,
            isPurchased: newQuantity === foundItem.quantity
        };
        
        const updatedOrders = orders.map(order => {
            if (order.id !== orderIdToSave) return order;
            
            const updatedLineItems = order.lineItems.map(item => {
                if (item.id === itemId) return itemToSave!;
                return item;
            });
            return { ...order, lineItems: updatedLineItems };
        });
        
        setOrders(updatedOrders);

        if (itemToSave && orderIdToSave) {
            const { id: lineItemId, isPurchased, quantityPurchased } = itemToSave;

            fetch(`${BACKEND_API_URL}/api/item-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineItemId: lineItemId,
                    orderId: orderIdToSave,
                    isPurchased: isPurchased,
                    quantityPurchased: quantityPurchased,
                }),
            })
            .then(response => {
                if (!response.ok) {
                    console.error('Error del backend al guardar. Status:', response.status);
                    return response.json().then(err => Promise.reject(err));
                }
                return response.json();
            })
            .then(data => {
                if (!data.success) {
                    console.error('Error del backend (lógica):', data.error);
                } else {
                    console.log('Progreso guardado en DB:', data.status);
                }
            })
            .catch(err => {
                console.error('Error de red al guardar el estado:', err);
            });
        }
    };

    const handleCompleteOrder = async (orderId: number) => {
        setCompletingOrderId(orderId);

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/orders/${orderId}/complete`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('El backend falló al completar el pedido');
            }
            
            console.log(`Pedido #${orderId} completado.`);
            setOrders(currentOrders => currentOrders.filter(order => order.id !== orderId));

        } catch (err) {
            console.error('Error al completar el pedido:', err);
            alert(`No se pudo completar el pedido #${orderId}. Revisa la consola.`);
        } finally {
            setCompletingOrderId(null);
        }
    };
    
    const TabButton: React.FC<{
        label: string;
        isActive: boolean;
        onClick: () => void;
    }> = ({ label, isActive, onClick }) => {
        return (
            <button
                onClick={onClick}
                className={`px-6 py-2 font-medium rounded-md transition-colors ${
                    isActive
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex space-x-2 p-1 bg-slate-200 rounded-lg max-w-md">
                <TabButton 
                    label="Pendientes"
                    isActive={viewMode === 'processing'}
                    onClick={() => setViewMode('processing')}
                />
                <TabButton 
                    label="Completados"
                    isActive={viewMode === 'completed'}
                    onClick={() => setViewMode('completed')}
                />
            </div>
            
            {isLoading && <LoadingSpinner />}
            {!isLoading && error && <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            {!isLoading && !error && orders.length === 0 && <EmptyState />}
            
            {!isLoading && !error && orders.length > 0 && (
                <div className="space-y-8">
                    {orders.map(order => {
                        const itemsByCategory = order.lineItems.reduce((acc, item) => {
                            const category = item.category || 'Products';
                            if (!acc[category]) {
                                acc[category] = [];
                            }
                            acc[category].push(item);
                            return acc;
                        }, {} as GroupedItems);

                        const categories = Object.keys(itemsByCategory).sort();
                        
                        const allItemsPurchased = order.lineItems.every(item => item.isPurchased);

                        return (
                            <article key={order.id} aria-labelledby={`order-heading-${order.id}`} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                                <header className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
                                    <div>
                                        <h2 id={`order-heading-${order.id}`} className="text-xl md:text-2xl font-bold text-slate-800">Order #{order.id}</h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {order.customer.firstName} {order.customer.lastName} &bull; {new Date(order.dateCreated).toLocaleDateString()}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <span className={`capitalize px-3 py-1 text-sm font-semibold rounded-full ${
                                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
                                            order.status === 'on-hold' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>
                                            {order.status}
                                        </span>

                                        {viewMode === 'processing' && (
                                            <button
                                                onClick={() => handleCompleteOrder(order.id)}
                                                disabled={!allItemsPurchased || completingOrderId === order.id}
                                                className="px-3 py-1 text-sm font-medium bg-green-500 text-white rounded-md shadow-sm hover:bg-green-600 disabled:bg-gray-400 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {completingOrderId === order.id ? 'Completando...' : 'Completar Pedido'}
                                            </button>
                                        )}
                                    </div>
                                </header>
                                
                                <div className="p-4 space-y-4">
                                    {categories.map(category => {
                                        const items = itemsByCategory[category];
                                        const purchasedCount = items.filter(item => item.isPurchased).length;
                                        const totalCount = items.length;
                                        const isComplete = purchasedCount === totalCount;

                                        return (
                                            <section key={category} aria-labelledby={`category-heading-${order.id}-${category}`}>
                                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                                    <div className={`p-3 border-b ${isComplete ? 'border-green-200 bg-green-50' : 'border-indigo-200 bg-indigo-50'}`}>
                                                        <div className="flex justify-between items-center">
                                                            <h3 id={`category-heading-${order.id}-${category}`} className="text-lg font-semibold text-slate-700">{category}</h3>
                                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isComplete ? 'bg-green-200 text-green-800' : 'bg-indigo-200 text-indigo-800'}`}>
                                                                {purchasedCount} / {totalCount}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="divide-y divide-slate-100">
                                                        {items.map(item => (
                                                            <OrderItem key={item.id} item={item} onQuantityChange={handleQuantityChange} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OrdersView;