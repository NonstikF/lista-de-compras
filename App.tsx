import React, { useState, useEffect } from 'react';

// Importa tus componentes de vista
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrdersView from './components/OrdersView';

// Importa tus iconos para el Header
import { LogoutIcon, UserCircleIcon, ShoppingCartIcon } from './components/icons';

// Define las vistas que tu aplicación puede mostrar
type AppView = 'login' | 'dashboard' | 'orders';

/**
 * Un componente de encabezado simple que se muestra cuando estás logueado.
 */
const Header: React.FC<{ onLogout: () => void; setView: (view: AppView) => void }> = ({ onLogout, setView }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Título/Logo (clic para ir al dashboard) */}
          <div
            className="flex items-center cursor-pointer gap-2"
            onClick={() => setView('dashboard')}
          >
            <ShoppingCartIcon className="w-7 h-7 text-indigo-600" />
            <span className="text-xl font-bold text-slate-800">Order Processing</span>
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
 * Este es tu componente principal de la aplicación.
 * Ahora solo gestiona el estado de autenticación y la vista actual.
 */
const App: React.FC = () => {
  const [view, setView] = useState<AppView>('login');

  // Comprueba el estado de login desde localStorage para persistencia simple
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  // Efecto para redirigir si el estado de autenticación cambia
  useEffect(() => {
    if (isAuthenticated) {
      // Si está autenticado pero en la página de login, ir al dashboard
      if (view === 'login') {
        setView('dashboard');
      }
    } else {
      // Si no está autenticado, forzar la vista de login
      setView('login');
    }
  }, [isAuthenticated, view]);


  const handleLoginSuccess = () => {
    localStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    setView('login');
  };

  // Función para renderizar el contenido principal basado en la vista actual
  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />;
      case 'dashboard':
        return <Dashboard onNavigateToOrders={() => setView('orders')} />;
      case 'orders':
        return (
          // Este div añade el padding y el botón "Back to Dashboard"
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button
              onClick={() => setView('dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-4"
            >
              &larr; Back to Dashboard
            </button>
            {/* ¡OrdersView ahora se renderiza sin props! */}
            <OrdersView />
          </div>
        );
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Solo muestra el Header si está autenticado */}
      {isAuthenticated && <Header onLogout={handleLogout} setView={setView} />}
      <main>
        {renderView()}
      </main>
    </div>
  );
};

export default App;