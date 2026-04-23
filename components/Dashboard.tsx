
import React from 'react';
import { ArrowRightIcon, ShoppingCartIcon, BookOpenIcon } from './icons';

interface DashboardProps {
    onNavigateToOrders: () => void;
    onNavigateToRecipes: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToOrders, onNavigateToRecipes }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4 md:p-8">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Pedidos */}
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center flex flex-col items-center">
                    <div className="bg-green-100 text-green-600 p-4 rounded-full mb-6">
                        <ShoppingCartIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        Gestión de Pedidos
                    </h2>
                    <p className="text-slate-600 mb-8 flex-grow">
                        Revisa la lista de compras y gestiona los pedidos de WooCommerce.
                    </p>
                    <button
                        onClick={onNavigateToOrders}
                        className="group w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105"
                    >
                        <span>Ver Lista de Compras</span>
                        <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>

                {/* Card Recetas */}
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center flex flex-col items-center">
                    <div className="bg-orange-100 text-orange-600 p-4 rounded-full mb-6">
                        <BookOpenIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        Recetas de Bebidas
                    </h2>
                    <p className="text-slate-600 mb-8 flex-grow">
                        Administra tu recetario de bebidas, cocteles y preparaciones.
                    </p>
                    <button
                        onClick={onNavigateToRecipes}
                        className="group w-full inline-flex items-center justify-center gap-2 bg-orange-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-300 transform hover:scale-105"
                    >
                        <span>Gestionar Recetas</span>
                        <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
