export interface LineItem {
  id: number;
  name: string;
  productId: number;
  quantity: number;
  category?: string; // Category is not always available in the main order endpoint
  sku: string;
  isPurchased: boolean;
  quantityPurchased: number;
  imageUrl: string | null;
}

export interface Order {
  id: number;
  dateCreated: string;
  status: string;
  customer: {
    firstName: string;
    lastName: string;
  };
  lineItems: LineItem[];
}
