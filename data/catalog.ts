export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "plantas",       name: "Plantas",        icon: "potted_plant",  color: "#3b6934" },
  { id: "macetas",       name: "Macetas",        icon: "water_drop",    color: "#7d562d" },
  { id: "sustratos",     name: "Sustratos",      icon: "landscape",     color: "#60233e" },
  { id: "fertilizantes", name: "Fertilizantes",  icon: "science",       color: "#2d5a27" },
  { id: "herramientas",  name: "Herramientas",   icon: "construction",  color: "#42493e" },
  { id: "accesorios",    name: "Accesorios",     icon: "category",      color: "#7c3a55" },
];
