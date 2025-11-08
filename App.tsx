import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import OrdersView from './components/OrdersView';
import Dashboard from './components/Dashboard';
import ApiSetup from './components/ApiSetup';
import { LogoutIcon, ShoppingCartIcon, UserCircleIcon } from './components/icons';

type View = 'login' | 'api_setup' | 'dashboard' | 'orders';

interface ApiConfig {
  url: string;
  key: string;
  secret: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<View>('login');
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // On app load, check for saved API config in local storage
    const savedConfig = localStorage.getItem('wcApiConfig');
    if (savedConfig) {
      setApiConfig(JSON.parse(savedConfig));
    }
  }, []);

  const handleLoginSuccess = () => {
    if (apiConfig) {
      setView('dashboard');
    } else {
      setView('api_setup');
    }
  };
  
  const handleLogout = () => {
    // For full security, you might want to clear the API config on logout
    // localStorage.removeItem('wcApiConfig');
    // setApiConfig(null);
    setView('login');
  };

  const handleConnect = async (url: string, key: string, secret: string) => {
    setIsConnecting(true);
    setApiError(null);
    // Simple validation: try fetching a single order to test credentials
    try {
      const testUrl = `${url.endsWith('/') ? url.slice(0, -1) : url}/wp-json/wc/v3/orders?per_page=1&consumer_key=${key}&consumer_secret=${secret}`;
      const response = await fetch(testUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid credentials or URL.');
      }

      const config = { url, key, secret };
      localStorage.setItem('wcApiConfig', JSON.stringify(config));
      setApiConfig(config);
      setView('dashboard');
    } catch (err) {
      if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('An unknown error occurred.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleNavigateToOrders = () => {
      setView('orders');
  };
  
  const handleBackToDashboard = () => {
      setView('dashboard');
  };

  const handleBackToApiSetup = () => {
      localStorage.removeItem('wcApiConfig');
      setApiConfig(null);
      setView('api_setup');
  }

  const renderContent = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />;
      case 'api_setup':
        return <ApiSetup onConnect={handleConnect} isLoading={isConnecting} error={apiError} />;
      default:
        return (
          <div className="min-h-screen bg-slate-100 font-sans">
            <header className="bg-white shadow-md sticky top-0 z-10">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center py-3">
                      <div className="flex items-center space-x-3">
                          <ShoppingCartIcon className="w-8 h-8 text-indigo-600" />
                          <h1 className="text-2xl font-bold text-slate-800">
                              {view === 'dashboard' ? 'Dashboard' : 'Order Processing'}
                          </h1>
                      </div>
                      <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                              <UserCircleIcon className="w-6 h-6 text-slate-500" />
                              <span className="hidden sm:inline font-medium text-slate-700">admin</span>
                          </div>
                          <button 
                            onClick={handleLogout} 
                            className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                            aria-label="Logout"
                          >
                              <LogoutIcon className="w-6 h-6" />
                          </button>
                      </div>
                  </div>
              </div>
            </header>
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
              {view === 'orders' && (
                   <div className="mb-6 flex justify-between items-center">
                      <button
                          onClick={handleBackToDashboard}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                          &larr; Back to Dashboard
                      </button>
                      <button
                          onClick={handleBackToApiSetup}
                          className="text-sm text-slate-500 hover:text-slate-700"
                      >
                          Change API Settings
                      </button>
                  </div>
              )}
               {view === 'dashboard' && (
                  <div className="mb-6 text-right">
                       <button
                          onClick={handleBackToApiSetup}
                          className="text-sm text-slate-500 hover:text-slate-700"
                      >
                          Change API Settings
                      </button>
                  </div>
               )}

              {view === 'dashboard' && <Dashboard onNavigateToOrders={handleNavigateToOrders} />}
              {view === 'orders' && apiConfig && <OrdersView apiConfig={apiConfig} />}
            </main>
          </div>
        );
    }
  }

  return renderContent();
};

export default App;
