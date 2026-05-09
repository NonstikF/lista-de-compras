export interface LineItem {
  id: number;
  name: string;
  productId: number;
  quantity: number;
  sku: string | null;
  total: string;
  isPurchased: boolean;
  quantityPurchased: number;
  category: string;
  imageUrl: string | null;
  suppliers: { id: string; name: string }[];
  quantityBySupplier: Record<string, number>;
}

export interface Customer {
  firstName: string;
  lastName: string;
}

export interface Order {
  id: number;
  dateCreated: string;
  status: string;
  total: string;
  customer: Customer;
  lineItems: LineItem[];
}

export interface LoginResponse {
  token: string;
  user: string;
}

export interface AuthError {
  error: string;
}

// ---------- Usuarios ----------
export interface User {
  id: string;
  username: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
}

// ---------- Proveedores ----------
export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  createdAt: string;
}

// ---------- Tickets de pedido ----------
export interface OrderTicket {
  id: string;
  orderId: number;
  supplierName: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  content?: string;
}

export interface OrderTicketUpload {
  supplierName: string;
  filename: string;
  mimeType: string;
  size: number;
  content: string;
}

// ---------- Tickets de proveedor ----------
export interface SupplierTicket {
  id: string;
  supplierId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  content?: string;
}

export interface SupplierTicketUpload {
  filename: string;
  mimeType: string;
  size: number;
  content: string;
}

// ---------- Artículos ----------
export interface Article {
  id: string;
  wooProductId?: number | null;
  name: string;
  image: string | null;
  price: number;
  sku?: string;
  category?: string;
  description?: string;
  stockStatus?: string;
  supplierIds: string[];
}

// ---------- Pedidos de Tienda ----------
export interface StoreOrderItem {
  articleId: string;
  name: string;
  price: number;
  qty: number;
}

export interface StoreOrder {
  id: string;
  dateCreated: string;
  status: 'pending' | 'completed';
  customerName: string;
  customerPhone: string;
  notes: string;
  items: StoreOrderItem[];
  total: number;
}

// ---------- Inventario ----------
export interface InventoryItem {
  id: string;
  articleId: string;
  stock: number;
  stockMin: number;
  unit: string;
  createdAt: string;
  article: { id: string; name: string; image: string | null; category: string };
}

export interface InventoryMovement {
  id: string;
  type: 'entrada' | 'salida' | 'ajuste';
  quantity: number;
  reason: string;
  userId: string;
  userName: string;
  createdAt: string;
}

// ---------- Recetas ----------
export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'caliente' | 'fria' | 'especial';
  image: string | null;
  ingredients: RecipeIngredient[];
  instructions: string;
  servings: number;
}
