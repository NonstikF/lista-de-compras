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

// ---------- Artículos ----------
export interface Article {
  id: string;
  name: string;
  image: string | null;
  price: number;
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
