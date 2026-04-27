export interface WooCommerceLineItem {
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    sku: string;
    total: string;
    parent_name?: string;
}

export interface WooCommerceOrder {
    id: number;
    date_created: string;
    status: string;
    total: string;
    billing: {
        first_name: string;
        last_name: string;
    };
    line_items: WooCommerceLineItem[];
}

export interface WooCommerceProduct {
    id: number;
    name: string;
    price?: string;
    regular_price?: string;
    sale_price?: string;
    sku?: string;
    description?: string;
    short_description?: string;
    stock_status?: string;
    status?: string;
    categories: { id: number; name: string }[];
    images: { src: string }[];
}
