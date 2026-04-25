import React, { useState, useEffect } from 'react';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrdersView from './components/OrdersView';
import ArticlesView from './components/ArticlesView';
import RecipesView from './components/RecipesView';
import StoreView from './components/StoreView';
import SuppliersView from './components/SuppliersView';
import { ToastContainer } from './components/Toast';

type AppView = 'login' | 'dashboard' | 'orders' | 'articles' | 'recipes' | 'store' | 'suppliers';

const navItems: { view: AppView; label: string; shortLabel: string; icon: string }[] = [
  { view: 'dashboard',  label: 'Panel',       shortLabel: 'Panel',    icon: 'dashboard'       },
  { view: 'orders',     label: 'Pedidos',     shortLabel: 'Pedidos',  icon: 'inventory_2'     },
  { view: 'recipes',    label: 'Recetas',     shortLabel: 'Recetas',  icon: 'menu_book'       },
  { view: 'articles',   label: 'Artículos',   shortLabel: 'Arts.',    icon: 'package_2'       },
  { view: 'store',      label: 'Tienda',      shortLabel: 'Tienda',   icon: 'storefront'      },
  { view: 'suppliers',  label: 'Proveedores', shortLabel: 'Provs.',   icon: 'local_shipping'  },
];

const Header: React.FC<{ onLogout: () => void; setView: (view: AppView) => void; currentView: AppView }> = ({ onLogout, setView, currentView }) => {
  return (
    <>
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
              onClick={onLogout}
              title="Cerrar sesión"
              className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-variant shadow-lg flex justify-around items-center px-1 py-1.5">
        {navItems.map(({ view, shortLabel, icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`flex flex-col items-center gap-0 px-1 py-1 rounded-xl transition text-[7px] font-bold uppercase tracking-wider ${
              currentView === view ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={currentView === view ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {icon}
            </span>
            {shortLabel}
          </button>
        ))}
      </nav>
    </>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('login');

  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const isAuthenticated = !!authToken;

  useEffect(() => {
    if (isAuthenticated) {
      if (view === 'login') setView('dashboard');
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
            onNavigateToArticles={() => setView('articles')}
            onNavigateToStore={() => setView('store')}
            onNavigateToSuppliers={() => setView('suppliers')}
          />
        );
      case 'orders':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button onClick={() => setView('dashboard')} className="text-primary hover:text-primary-container font-medium mb-4 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">arrow_back</span> Regresar al Panel
            </button>
            <OrdersView authToken={authToken!} onAuthError={handleAuthError} />
          </div>
        );
      case 'articles':
        return <ArticlesView authToken={authToken!} onAuthError={handleAuthError} />;
      case 'recipes':
        return <RecipesView authToken={authToken!} onAuthError={handleAuthError} />;
      case 'store':
        return <StoreView authToken={authToken!} onAuthError={handleAuthError} />;
      case 'suppliers':
        return <SuppliersView authToken={authToken!} onAuthError={handleAuthError} />;
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
