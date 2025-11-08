
import React from 'react';
import { ArrowRightIcon, ShoppingCartIcon } from './icons';

interface DashboardProps {
    onNavigateToOrders: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToOrders }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8">
            <div className="w-full max-w-2xl text-center bg-white p-8 sm:p-12 rounded-2xl shadow-lg border border-slate-200">
                <div className="inline-block bg-green-100 text-green-600 p-4 rounded-full mb-6">
                    <ShoppingCartIcon className="w-12 h-12" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                    Welcome to the Order Manager
                </h1>
                <p className="text-slate-600 text-lg mb-8">
                    You're all set to start processing incoming orders. Click the button below to view all pending items and mark them as purchased.
                </p>
                <button
                    onClick={onNavigateToOrders}
                    className="group inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105"
                >
                    <span>Process Orders</span>
                    <ArrowRightIcon className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
