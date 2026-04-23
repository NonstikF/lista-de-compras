import React, { useState, useEffect } from 'react';

// Importa tus componentes de vista
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrdersView from './components/OrdersView';
import TelegramSettings from './components/TelegramSettings';
import RecipesView from './components/RecipesView';
import { ToastContainer } from './components/Toast';

// Importa tus iconos para el Header
import { LogoutIcon, UserCircleIcon, ShoppingCartIcon, SettingsIcon, BookOpenIcon } from './components/icons';

// Define las vistas que tu aplicacion puede mostrar
type AppView = 'login' | 'dashboard' | 'orders' | 'settings' | 'recipes';

/**
 * Un componente de encabezado simple que se muestra cuando estas logueado.
 */
const Header: React.FC<{ onLogout: () => void; setView: (view: AppView) => void; currentView: AppView }> = ({ onLogout, setView, currentView }) => {
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
            <span className="text-xl font-bold text-slate-800">PlantArte</span>
          </div>

          {/* Navegación y Usuario */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}
              >
                Panel
              </button>
              <button
                onClick={() => setView('orders')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'orders' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}
              >
                Pedidos
              </button>
              <button
                onClick={() => setView('recipes')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'recipes' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}
              >
                Recetas
              </button>
            </nav>

            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setView('recipes')}
                title="Recetas"
                className={`md:hidden p-1.5 rounded-lg transition-colors ${currentView === 'recipes' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}
              >
                <BookOpenIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setView('settings')}
                title="Configuración del bot"
                className={`p-1.5 rounded-lg transition-colors ${currentView === 'settings' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                title="Logout"
                className="text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <LogoutIcon className="w-5 h-5" />
              </button>
            </div>
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
  const [highlightOrderId, setHighlightOrderId] = useState<number | null>(null);

  // Token JWT desde localStorage para persistencia
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const isAuthenticated = !!authToken;

  // Efecto para redirigir si el estado de autenticacion cambia
  useEffect(() => {
    if (isAuthenticated) {
      if (view === 'login') {
        // Verificar si hay un pedido en la URL (?pedido=123)
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
        return <Dashboard onNavigateToOrders={() => setView('orders')} onNavigateToRecipes={() => setView('recipes')} />;
      case 'orders':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button
              onClick={() => setView('dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-4"
            >
              &larr; Regresar al Panel
            </button>
            <OrdersView authToken={authToken!} onAuthError={handleAuthError} highlightOrderId={highlightOrderId} />
          </div>
        );
      case 'settings':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button
              onClick={() => setView('dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-4"
            >
              &larr; Regresar al Panel
            </button>
            <TelegramSettings authToken={authToken!} onAuthError={handleAuthError} />
          </div>
        );
      case 'recipes':
        return (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <button
              onClick={() => setView('dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-4"
            >
              &larr; Regresar al Panel
            </button>
            <RecipesView authToken={authToken!} onAuthError={handleAuthError} />
          </div>
        );
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Solo muestra el Header si esta autenticado */}
      {isAuthenticated && <Header onLogout={handleLogout} setView={setView} currentView={view} />}
      <main>
        {renderView()}
      </main>
      <ToastContainer />
    </div>
  );
};

export default App;
