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
