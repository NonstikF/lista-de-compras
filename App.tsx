import React, { useState, useEffect } from 'react';

// Importa tus componentes de vista
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrdersView from './components/OrdersView';
import { ToastContainer } from './components/Toast';

// Importa tus iconos para el Header
import { LogoutIcon, UserCircleIcon, ShoppingCartIcon } from './components/icons';

// Define las vistas que tu aplicacion puede mostrar
type AppView = 'login' | 'dashboard' | 'orders';

/**
 * Un componente de encabezado simple que se muestra cuando estas logueado.
 */
const Header: React.FC<{ onLogout: () => void; setView: (view: AppView) => void }> = ({ onLogout, setView }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Titulo/Logo (clic para ir al dashboard) */}
          <div
            className="flex items-center cursor-pointer gap-2"
            onClick={() => setView('dashboard')}
          >
            <ShoppingCartIcon className="w-7 h-7 text-indigo-600" />
            <span className="text-xl font-bold text-slate-800">Lista de Compras</span>
          </div>

          {/* Iconos de Usuario y Logout */}
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-sm font-medium text-slate-600">
              <UserCircleIcon className="w-5 h-5 mr-1" />
              admin
            </span>
            <button
              onClick={onLogout}
              title="Logout"
              className="text-slate-500 hover:text-indigo-600"
            >
              <LogoutIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

/**
 * Componente principal de la aplicacion.
 * Gestiona el token JWT y la vista actual.
 */
const App: React.FC = () => {
  const [view, setView] = useState<AppView>('login');

  // Token JWT desde localStorage para persistencia
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const isAuthenticated = !!authToken;

  // Efecto para redirigir si el estado de autenticacion cambia
  useEffect(() => {
    if (isAuthenticated) {
      if (view === 'login') {
        setView('dashboard');
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

  // Callback para auto-logout cuando el backend devuelve 401/403
  const handleAuthError = () => {
    handleLogout();
  };

  // Funcion para renderizar el contenido principal basado en la vista actual
  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />;
      case 'dashboard':
        return <Dashboard onNavigateToOrders={() => setView('orders')} />;
      case 'orders':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button
              onClick={() => setView('dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-4"
            >
              &larr; Regresar al Panel
            </button>
            <OrdersView authToken={authToken!} onAuthError={handleAuthError} />
          </div>
        );
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Solo muestra el Header si esta autenticado */}
      {isAuthenticated && <Header onLogout={handleLogout} setView={setView} />}
      <main>
        {renderView()}
      </main>
      <ToastContainer />
    </div>
  );
};

export default App;
