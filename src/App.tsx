import React, { useState, useEffect } from 'react';

import Sidebar, { type AppView } from './components/layout/Sidebar';
import { ToastContainer } from './components/ui/Toast';
import type { AuthUser, PermissionKey } from './types';
import { normalizePermissions } from './auth/permissions';

import Login from './components/views/Login';
import Dashboard from './components/views/Dashboard';
import OrdersView from './components/views/OrdersView';
import ArticlesView from './components/views/ArticlesView';
import RecipesView from './components/views/RecipesView';
import StoreView from './components/views/StoreView';
import SuppliersView from './components/views/SuppliersView';
import UsersView from './components/views/UsersView';
import InventoryView from './components/views/InventoryView';
import SettingsView from './components/views/SettingsView';

const App: React.FC = () => {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('authUser');
    if (!raw) return null;
    try {
      const user = JSON.parse(raw) as AuthUser;
      return { ...user, permissions: normalizePermissions(user.permissions) };
    } catch {
      localStorage.removeItem('authUser');
      return null;
    }
  });

  const isAuthenticated = !!authToken && !!authUser;

  const [view, setView] = useState<AppView>(() =>
    localStorage.getItem('authToken') ? 'dashboard' : 'login'
  );

  const canAccess = (nextView: AppView) => {
    if (nextView === 'login') return true;
    return authUser?.permissions[nextView as PermissionKey] === true;
  };

  const firstAllowedView = (user = authUser): AppView => {
    if (!user) return 'login';
    const preferred: PermissionKey[] = ['dashboard', 'orders', 'articles', 'store', 'recipes', 'suppliers', 'inventory', 'users', 'settings'];
    return preferred.find((permission) => user.permissions[permission]) ?? 'login';
  };

  const goToView = (nextView: AppView) => {
    setView(canAccess(nextView) ? nextView : firstAllowedView());
  };

  const handleLoginSuccess = (token: string, user: AuthUser) => {
    const normalizedUser = { ...user, permissions: normalizePermissions(user.permissions) };
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(normalizedUser));
    setAuthToken(token);
    setAuthUser(normalizedUser);
    setView(firstAllowedView(normalizedUser));
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setAuthToken(null);
    setAuthUser(null);
    setView('login');
  };

  const handleAuthError = () => handleLogout();

  useEffect(() => {
    if (!authToken) return;
    const BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';
    fetch(`${BASE}/api/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }).then(async r => {
      if (r.status === 401 || r.status === 403) handleLogout();
      if (!r.ok) return;
      const user = await r.json();
      const normalizedUser = { ...user, permissions: normalizePermissions(user.permissions) };
      localStorage.setItem('authUser', JSON.stringify(normalizedUser));
      setAuthUser(normalizedUser);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated && !canAccess(view)) {
      setView(firstAllowedView());
    }
  }, [isAuthenticated, authUser, view]);

  const renderView = () => {
    if (!isAuthenticated) return <Login onLoginSuccess={handleLoginSuccess} />;
    if (!canAccess(view)) {
      return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 text-center">
          <h1 className="font-epilogue text-2xl font-bold text-on-background">Sin permiso</h1>
          <p className="text-on-surface-variant mt-2">Tu usuario no tiene acceso a esta seccion.</p>
        </div>
      );
    }

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
            permissions={authUser!.permissions}
          />
        );
      case 'orders':
        return (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
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
      case 'settings':
        return <SettingsView authToken={authToken!} onAuthError={handleAuthError} />;
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {isAuthenticated && <Sidebar onLogout={handleLogout} setView={goToView} currentView={view} permissions={authUser!.permissions} />}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">{renderView()}</main>
      <ToastContainer />
    </div>
  );
};

export default App;
