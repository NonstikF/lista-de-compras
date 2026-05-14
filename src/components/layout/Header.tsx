import React, { useState } from 'react';

export type AppView = 'login' | 'dashboard' | 'orders' | 'articles' | 'recipes' | 'store' | 'suppliers' | 'users' | 'inventory';

export const navItems: { view: AppView; label: string; shortLabel: string; icon: string }[] = [
  { view: 'dashboard',  label: 'Panel',       shortLabel: 'Panel',    icon: 'dashboard'       },
  { view: 'orders',     label: 'Pedidos',     shortLabel: 'Pedidos',  icon: 'inventory_2'     },
  { view: 'recipes',    label: 'Recetas',     shortLabel: 'Recetas',  icon: 'menu_book'       },
  { view: 'articles',   label: 'Artículos',   shortLabel: 'Arts.',    icon: 'package_2'       },
  { view: 'store',      label: 'Tienda',      shortLabel: 'Tienda',   icon: 'storefront'      },
  { view: 'suppliers',  label: 'Proveedores', shortLabel: 'Provs.',   icon: 'local_shipping'  },
  { view: 'users',      label: 'Usuarios',    shortLabel: 'Users',    icon: 'manage_accounts' },
  { view: 'inventory',  label: 'Inventario',  shortLabel: 'Inv.',     icon: 'inventory'       },
];

const PRIMARY_NAV: AppView[] = ['dashboard', 'orders', 'articles', 'store'];

interface HeaderProps {
  onLogout: () => void;
  setView: (view: AppView) => void;
  currentView: AppView;
}

const Header: React.FC<HeaderProps> = ({ onLogout, setView, currentView }) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = navItems.filter(n => PRIMARY_NAV.includes(n.view));
  const moreItems = navItems.filter(n => !PRIMARY_NAV.includes(n.view));
  const moreIsActive = moreItems.some(n => n.view === currentView);

  const handleMoreNav = (view: AppView) => {
    setView(view);
    setMoreOpen(false);
  };

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

      {/* More drawer backdrop */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      {moreOpen && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-surface-variant shadow-2xl rounded-t-2xl px-4 py-4">
          <div className="grid grid-cols-4 gap-2">
            {moreItems.map(({ view, label, icon }) => (
              <button
                key={view}
                onClick={() => handleMoreNav(view)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl transition text-[10px] font-semibold ${
                  currentView === view
                    ? 'text-primary bg-primary/10'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
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
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-variant shadow-lg flex justify-around items-center px-2 py-1.5">
        {primaryItems.map(({ view, shortLabel, icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition text-[10px] font-semibold ${
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
        <button
          onClick={() => setMoreOpen(o => !o)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition text-[10px] font-semibold ${
            moreIsActive || moreOpen ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          <span
            className="material-symbols-outlined text-2xl"
            style={moreIsActive || moreOpen ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            more_horiz
          </span>
          Más
        </button>
      </nav>
    </>
  );
};

export default Header;
