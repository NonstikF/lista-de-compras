import React from 'react';

interface DashboardProps {
    onNavigateToOrders: () => void;
    onNavigateToRecipes: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToOrders, onNavigateToRecipes }) => {
    return (
        <main className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-10 pb-28 md:pb-10">
            {/* Bienvenida */}
            <section>
                <h1 className="font-epilogue text-4xl font-bold text-on-background mb-1">¡Hola, Equipo!</h1>
                <p className="text-on-surface-variant">Selecciona una sección para comenzar.</p>
            </section>

            {/* Bento Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Pedidos */}
                <button
                    onClick={onNavigateToOrders}
                    className="group relative overflow-hidden rounded-2xl bg-surface-container-highest hover:shadow-lg transition-all duration-300 border border-surface-variant p-6 flex flex-col justify-between text-left aspect-square"
                >
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br from-primary to-transparent rounded-2xl" />
                    <div className="relative z-10">
                        <div className="bg-white/80 backdrop-blur w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm text-primary">
                            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                        </div>
                        <h2 className="font-epilogue text-2xl font-semibold text-on-background mb-1">Pedidos</h2>
                        <p className="text-sm text-on-surface-variant">Gestiona y surte el inventario.</p>
                    </div>
                    <div className="relative z-10 flex items-center gap-1 mt-auto text-primary font-semibold group-hover:translate-x-1 transition-transform text-sm">
                        Ver todos <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                </button>

                {/* Recetas */}
                <button
                    onClick={onNavigateToRecipes}
                    className="group relative overflow-hidden rounded-2xl bg-surface-container-highest hover:shadow-lg transition-all duration-300 border border-surface-variant p-6 flex flex-col justify-between text-left aspect-square"
                >
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br from-secondary to-transparent rounded-2xl" />
                    <div className="relative z-10">
                        <div className="bg-white/80 backdrop-blur w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm text-secondary">
                            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_library</span>
                        </div>
                        <h2 className="font-epilogue text-2xl font-semibold text-on-background mb-1">Recetas</h2>
                        <p className="text-sm text-on-surface-variant">Consulta ingredientes y pasos.</p>
                    </div>
                    <div className="relative z-10 flex items-center gap-1 mt-auto text-secondary font-semibold group-hover:translate-x-1 transition-transform text-sm">
                        Explorar <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                </button>

                {/* Bot Telegram */}
                <div className="group relative overflow-hidden rounded-2xl bg-surface-container-highest border border-surface-variant p-6 flex flex-col justify-between aspect-square opacity-70">
                    <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-telegram-blue to-transparent rounded-2xl" />
                    <div className="relative z-10">
                        <div className="bg-white/80 backdrop-blur w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm text-telegram-blue">
                            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>robot_2</span>
                        </div>
                        <h2 className="font-epilogue text-2xl font-semibold text-on-background mb-1">Bot</h2>
                        <p className="text-sm text-on-surface-variant">Ajustes del asistente Telegram.</p>
                    </div>
                    <div className="relative z-10 flex items-center gap-1 mt-auto text-telegram-blue font-semibold text-sm">
                        Desde configuración <span className="material-symbols-outlined text-sm">settings</span>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Dashboard;
