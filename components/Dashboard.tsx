import React from 'react';

interface DashboardProps {
    onNavigateToOrders: () => void;
    onNavigateToRecipes: () => void;
    onNavigateToArticles: () => void;
    onNavigateToStore: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToOrders, onNavigateToRecipes, onNavigateToArticles, onNavigateToStore }) => {
    const cards = [
        {
            onClick: onNavigateToOrders,
            label: 'Pedidos',
            desc: 'Surte el inventario',
            icon: 'inventory_2',
            tone: 'bg-primary/10 text-primary',
            badge: null as string | null,
        },
        {
            onClick: onNavigateToRecipes,
            label: 'Recetas',
            desc: 'Recetas de bebidas',
            icon: 'menu_book',
            tone: 'bg-secondary-container/60 text-on-secondary-container',
            badge: 'NUEVO',
        },
        {
            onClick: onNavigateToArticles,
            label: 'Artículos',
            desc: 'Catálogo de la tienda',
            icon: 'package_2',
            tone: 'bg-tertiary-container/30 text-tertiary',
            badge: null,
        },
        {
            onClick: onNavigateToStore,
            label: 'Tienda',
            desc: 'Crear pedido manual',
            icon: 'storefront',
            tone: 'bg-primary/10 text-primary',
            badge: null,
        },
    ];

    return (
        <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10 pb-28 md:pb-10">
            <section className="mb-8">
                <h1 className="font-epilogue text-3xl md:text-4xl font-bold text-on-background">¡Hola, Equipo!</h1>
                <p className="text-on-surface-variant mt-1">Selecciona una sección para comenzar.</p>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map(card => (
                    <button
                        key={card.label}
                        onClick={card.onClick}
                        className="group relative overflow-hidden rounded-2xl bg-white hover:shadow-lg transition-all border border-surface-variant p-5 flex flex-col justify-between text-left aspect-square"
                    >
                        {card.badge && (
                            <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-on-secondary">
                                {card.badge}
                            </span>
                        )}
                        <div>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${card.tone}`}>
                                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
                            </div>
                            <h2 className="font-epilogue text-xl font-bold text-on-background">{card.label}</h2>
                            <p className="text-sm text-on-surface-variant mt-0.5">{card.desc}</p>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-semibold group-hover:translate-x-1 transition-transform text-sm mt-3">
                            Abrir <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </div>
                    </button>
                ))}
            </section>
        </main>
    );
};

export default Dashboard;
