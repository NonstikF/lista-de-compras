import React, { useState, useEffect } from 'react';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrdersView from './components/OrdersView';
import TelegramSettings from './components/TelegramSettings';
import RecipesView from './components/RecipesView';
import ProductsView from './components/ProductsView';
import StoreView from './components/StoreView';
import { ToastContainer } from './components/Toast';

type AppView = 'login' | 'dashboard' | 'orders' | 'settings' | 'recipes' | 'products' | 'store';

const navItems: { view: AppView; label: string; icon: string }[] = [
  { view: 'dashboard', label: 'Panel',     icon: 'dashboard'    },
  { view: 'orders',    label: 'Pedidos',   icon: 'inventory_2'  },
  { view: 'products',  label: 'Productos', icon: 'inventory'    },
  { view: 'store',     label: 'Tienda',    icon: 'storefront'   },
  { view: 'recipes',   label: 'Recetas',   icon: 'local_library' },
];

const Header: React.FC<{ onLogout: () => void; setView: (view: AppView) => void; currentView: AppView }> = ({ onLogout, setView, currentView }) => {
  return (
    <>
      {/* Top bar */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-surface-variant shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => setView('dashboard')}
            className="font-epilogue text-xl font-extrabold text-primary tracking-tight flex items-center gap-2"
          >
            <span className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
            </span>
            PlantArte
          </button>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ view, label, icon }) => (
              <button
                key={view}
                onClick={() => setView(view)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === view
                    ? 'text-primary bg-primary/8 font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`}
              >
                <span
                  className="material-symbols-outlined text-lg"
                  style={currentView === view ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('settings')}
              title="Configuración"
              className={`p-2 rounded-full transition-colors ${currentView === 'settings' ? 'text-primary bg-primary/8' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'}`}
            >
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-variant shadow-lg flex justify-around items-center px-1 py-1.5">
        {navItems.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`flex flex-col items-center gap-0 px-2 py-1 rounded-xl transition text-[9px] font-bold uppercase tracking-wider ${
              currentView === view ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={currentView === view ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('login');
  const [highlightOrderId, setHighlightOrderId] = useState<number | null>(null);

  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const isAuthenticated = !!authToken;

  useEffect(() => {
    if (isAuthenticated) {
      if (view === 'login') {
        const params = new URLSearchParams(window.location.search);
        const pedidoId = params.get('pedido');
        if (pedidoId && !isNaN(Number(pedidoId))) {
          setHighlightOrderId(Number(pedidoId));
          setView('orders');
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          setView('dashboard');
        }
      }
    } else {
      setView('login');
    }
  }, [isAuthenticated, view]);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setView('login');
  };

  const handleAuthError = () => handleLogout();

  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />;
      case 'dashboard':
        return (
          <Dashboard
            onNavigateToOrders={() => setView('orders')}
            onNavigateToRecipes={() => setView('recipes')}
            onNavigateToProducts={() => setView('products')}
            onNavigateToStore={() => setView('store')}
          />
        );
      case 'orders':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button onClick={() => setView('dashboard')} className="text-primary hover:text-primary-container font-medium mb-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Regresar al Panel
            </button>
            <OrdersView authToken={authToken!} onAuthError={handleAuthError} highlightOrderId={highlightOrderId} />
          </div>
        );
      case 'settings':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button onClick={() => setView('dashboard')} className="text-primary hover:text-primary-container font-medium mb-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Regresar al Panel
            </button>
            <TelegramSettings authToken={authToken!} onAuthError={handleAuthError} />
          </div>
        );
      case 'recipes':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button onClick={() => setView('dashboard')} className="text-primary hover:text-primary-container font-medium mb-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Regresar al Panel
            </button>
            <RecipesView authToken={authToken!} onAuthError={handleAuthError} />
          </div>
        );
      case 'products':
        return <ProductsView />;
      case 'store':
        return <StoreView />;
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && <Header onLogout={handleLogout} setView={setView} currentView={view} />}
      <main>{renderView()}</main>
      <ToastContainer />
    </div>
  );
};

export default App;
