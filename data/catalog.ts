export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  image: string | null;
  description: string;
}

export interface PurchaseHistoryEntry {
  orderId: number;
  date: string;
  customer: string;
  qty: number;
  unitPrice: number;
}

export interface CartItem {
  productId: number;
  qty: number;
  notes: string;
}

export const CATEGORIES: Category[] = [
  { id: "plantas",       name: "Plantas",        icon: "potted_plant",  color: "#3b6934" },
  { id: "macetas",       name: "Macetas",        icon: "water_drop",    color: "#7d562d" },
  { id: "sustratos",     name: "Sustratos",      icon: "landscape",     color: "#60233e" },
  { id: "fertilizantes", name: "Fertilizantes",  icon: "science",       color: "#2d5a27" },
  { id: "herramientas",  name: "Herramientas",   icon: "construction",  color: "#42493e" },
  { id: "accesorios",    name: "Accesorios",     icon: "category",      color: "#7c3a55" },
];

export const SUPPLIERS: Supplier[] = [
  { id: "viveros-sur",  name: "Viveros del Sur",    contact: "Mario Hdz", phone: "55 1234 5678" },
  { id: "tierra-viva",  name: "Tierra Viva MX",     contact: "Laura P.",  phone: "55 2345 6789" },
  { id: "ceramica-oax", name: "Cerámica Oaxaca",    contact: "Don Beto",  phone: "951 345 6789" },
  { id: "agroquim",     name: "Agroquímica BC",     contact: "Ivonne R.", phone: "55 4567 8901" },
  { id: "herr-norte",   name: "Herramientas Norte", contact: "Juan C.",   phone: "81 5678 9012" },
];

export const PRODUCTS: Product[] = [
  { id: 1001, sku: "PLT-MONS-01",   name: "Monstera Deliciosa",        category: "plantas",       supplier: "viveros-sur",  price: 380, cost: 220, stock: 14, unit: "pza",   image: null, description: "Planta tropical de hoja grande, ideal para interiores con luz indirecta." },
  { id: 1002, sku: "PLT-POTH-01",   name: "Potos dorado",              category: "plantas",       supplier: "viveros-sur",  price: 120, cost: 55,  stock: 42, unit: "pza",   image: null, description: "Enredadera fácil de cuidar, tolerante a poca luz." },
  { id: 1003, sku: "PLT-FICUS-01",  name: "Ficus Lyrata",              category: "plantas",       supplier: "viveros-sur",  price: 650, cost: 380, stock: 6,  unit: "pza",   image: null, description: "Árbol de interior con hojas en forma de violín." },
  { id: 1004, sku: "PLT-SANS-01",   name: "Sansevieria",               category: "plantas",       supplier: "viveros-sur",  price: 220, cost: 110, stock: 0,  unit: "pza",   image: null, description: "Lengua de suegra. Muy resistente." },
  { id: 1005, sku: "PLT-CACTUS-M",  name: "Cactus mediano",            category: "plantas",       supplier: "tierra-viva",  price: 95,  cost: 40,  stock: 28, unit: "pza",   image: null, description: "Variedades surtidas, 10-15 cm." },
  { id: 2001, sku: "MAC-BAR-18",    name: "Maceta de barro 18cm",      category: "macetas",       supplier: "ceramica-oax", price: 85,  cost: 38,  stock: 56, unit: "pza",   image: null, description: "Barro natural tradicional de Oaxaca." },
  { id: 2002, sku: "MAC-BAR-25",    name: "Maceta de barro 25cm",      category: "macetas",       supplier: "ceramica-oax", price: 140, cost: 70,  stock: 22, unit: "pza",   image: null, description: "Tamaño mediano, con platito incluido." },
  { id: 2003, sku: "MAC-CER-BL-20", name: "Maceta cerámica blanca 20cm", category: "macetas",    supplier: "ceramica-oax", price: 210, cost: 115, stock: 18, unit: "pza",   image: null, description: "Acabado mate, estilo minimalista." },
  { id: 2004, sku: "MAC-COL-30",    name: "Maceta colgante macramé",   category: "macetas",       supplier: "tierra-viva",  price: 180, cost: 90,  stock: 9,  unit: "pza",   image: null, description: "Colgante tejido a mano, 30cm." },
  { id: 3001, sku: "SUS-UNIV-5L",   name: "Sustrato universal 5L",     category: "sustratos",     supplier: "tierra-viva",  price: 110, cost: 55,  stock: 35, unit: "bolsa", image: null, description: "Mezcla balanceada para interior y exterior." },
  { id: 3002, sku: "SUS-CACT-3L",   name: "Sustrato cactus 3L",        category: "sustratos",     supplier: "tierra-viva",  price: 85,  cost: 42,  stock: 19, unit: "bolsa", image: null, description: "Drenaje alto para suculentas y cactus." },
  { id: 3003, sku: "SUS-ORQ-2L",    name: "Sustrato orquídeas 2L",     category: "sustratos",     supplier: "tierra-viva",  price: 95,  cost: 48,  stock: 12, unit: "bolsa", image: null, description: "Corteza gruesa específica para orquídeas." },
  { id: 4001, sku: "FER-LIQ-250",   name: "Fertilizante líquido 250ml",category: "fertilizantes", supplier: "agroquim",     price: 145, cost: 72,  stock: 24, unit: "pza",   image: null, description: "NPK 20-20-20 para uso general." },
  { id: 4002, sku: "FER-ORG-1KG",   name: "Humus de lombriz 1kg",      category: "fertilizantes", supplier: "agroquim",     price: 75,  cost: 35,  stock: 40, unit: "bolsa", image: null, description: "Abono orgánico premium." },
  { id: 5001, sku: "HRR-TIJ-PROF",  name: "Tijera de podar profesional",category: "herramientas", supplier: "herr-norte",   price: 320, cost: 180, stock: 8,  unit: "pza",   image: null, description: "Acero inoxidable, mango ergonómico." },
  { id: 5002, sku: "HRR-PAL-MINI",  name: "Pala de jardín mini",       category: "herramientas",  supplier: "herr-norte",   price: 95,  cost: 45,  stock: 16, unit: "pza",   image: null, description: "Para trasplantes en maceta." },
  { id: 5003, sku: "HRR-REG-1L",    name: "Regadera 1L",               category: "herramientas",  supplier: "herr-norte",   price: 140, cost: 68,  stock: 11, unit: "pza",   image: null, description: "Plástico resistente, pico largo." },
  { id: 6001, sku: "ACC-TUT-60",    name: "Tutor de bambú 60cm",       category: "accesorios",    supplier: "tierra-viva",  price: 18,  cost: 8,   stock: 120, unit: "pza",  image: null, description: "Pack de soporte para plantas trepadoras." },
  { id: 6002, sku: "ACC-PLAT-20",   name: "Plato para maceta 20cm",    category: "accesorios",    supplier: "ceramica-oax", price: 35,  cost: 15,  stock: 48, unit: "pza",   image: null, description: "Protege pisos y muebles." },
];

export const PURCHASE_HISTORY: Record<number, PurchaseHistoryEntry[]> = {
  1001: [
    { orderId: 10234, date: "2026-04-18", customer: "Ana Gómez",    qty: 2, unitPrice: 380 },
    { orderId: 10219, date: "2026-04-12", customer: "Carlos R.",    qty: 1, unitPrice: 380 },
    { orderId: 10198, date: "2026-04-03", customer: "Lucía Pérez",  qty: 1, unitPrice: 360 },
    { orderId: 10176, date: "2026-03-28", customer: "Boutique Uva", qty: 3, unitPrice: 360 },
  ],
  1002: [
    { orderId: 10241, date: "2026-04-21", customer: "Sofía M.",  qty: 4, unitPrice: 120 },
    { orderId: 10220, date: "2026-04-12", customer: "Raúl T.",   qty: 2, unitPrice: 120 },
    { orderId: 10185, date: "2026-03-31", customer: "Ana Gómez", qty: 1, unitPrice: 110 },
  ],
  2001: [
    { orderId: 10241, date: "2026-04-21", customer: "Sofía M.",         qty: 4,  unitPrice: 85 },
    { orderId: 10233, date: "2026-04-18", customer: "Pedro N.",          qty: 6,  unitPrice: 85 },
    { orderId: 10210, date: "2026-04-08", customer: "Restaurante Flor",  qty: 12, unitPrice: 80 },
  ],
  3001: [
    { orderId: 10238, date: "2026-04-20", customer: "Lucía Pérez", qty: 2, unitPrice: 110 },
    { orderId: 10215, date: "2026-04-10", customer: "Carlos R.",   qty: 1, unitPrice: 110 },
  ],
  4001: [
    { orderId: 10230, date: "2026-04-16", customer: "Boutique Uva", qty: 3, unitPrice: 145 },
  ],
};
