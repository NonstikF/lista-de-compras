import React, { useState, useEffect } from 'react';

import Header, { type AppView } from './components/layout/Header';
import { ToastContainer } from './components/ui/Toast';

import Login from './components/views/Login';
import Dashboard from './components/views/Dashboard';
import OrdersView from './components/views/OrdersView';
import ArticlesView from './components/views/ArticlesView';
import RecipesView from './components/views/RecipesView';
import StoreView from './components/views/StoreView';
import SuppliersView from './components/views/SuppliersView';
import UsersView from './components/views/UsersView';
import InventoryView from './components/views/InventoryView';

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
            onNavigateToUsers={() => setView('users')}
            onNavigateToInventory={() => setView('inventory')}
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
      case 'users':
        return <UsersView authToken={authToken!} onAuthError={handleAuthError} />;
      case 'inventory':
        return <InventoryView authToken={authToken!} onAuthError={handleAuthError} />;
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
