import React, { useState } from 'react';
import { ShoppingCartIcon } from './icons';

interface ApiSetupProps {
  onConnect: (url: string, key: string, secret: string) => void;
  isLoading: boolean;
  error: string | null;
}

const ApiSetup: React.FC<ApiSetupProps> = ({ onConnect, isLoading, error }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && key && secret) {
      onConnect(url, key, secret);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <div className="bg-indigo-500 text-white p-3 rounded-full">
              <ShoppingCartIcon className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">Connect to WooCommerce</h1>
            <p className="text-slate-500 text-center">
              Enter your store's API details to fetch live orders.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url" className="text-sm font-medium text-slate-600">Store URL</label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="https://yourstore.com"
                required
              />
            </div>
            <div>
              <label htmlFor="key" className="text-sm font-medium text-slate-600">Consumer Key</label>
              <input
                id="key"
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                required
              />
            </div>
            <div>
              <label htmlFor="secret" className="text-sm font-medium text-slate-600">Consumer Secret</label>
              <input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            
            <p className="text-xs text-slate-500 text-center">
                Need help? {' '}
                <a 
                    href="https://woocommerce.com/document/woocommerce-rest-api/#section-2" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-indigo-600 hover:underline"
                >
                    Find out how to generate API keys.
                </a>
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-all duration-300 flex items-center justify-center"
            >
              {isLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Connect and Fetch Orders'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApiSetup;
