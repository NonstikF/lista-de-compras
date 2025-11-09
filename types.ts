export interface LineItem {
  id: number;
  name: string;
  productId: number;
  quantity: number;
  sku: string | null;
  total: string; // <-- ¡NUEVO! Total del artículo
  isPurchased: boolean;
  quantityPurchased: number;
  category: string;
  imageUrl: string | null; // <-- Ya lo tenías, ¡perfecto!
}

export interface Customer {
  firstName: string;
  lastName: string;
}

export interface Order {
  id: number;
  dateCreated: string;
  status: string;
  total: string; // <-- ¡NUEVO! Total del pedido
  customer: Customer;
  lineItems: LineItem[];
}