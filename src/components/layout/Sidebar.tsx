import React, { useEffect, useState } from 'react';
import type { PermissionKey, UserPermissions } from '../../types';
import { BRANDING_CHANGED, getBranding, type Branding } from '../../services/api';

export type AppView = 'login' | 'dashboard' | 'orders' | 'articles' | 'recipes' | 'store' | 'suppliers' | 'users' | 'inventory' | 'locations' | 'settings';

export const navItems: { view: AppView; label: string; icon: string }[] = [
  { view: 'dashboard',  label: 'Panel',       icon: 'dashboard'        },
  { view: 'orders',     label: 'Pedidos',     icon: 'inventory_2'      },
  { view: 'recipes',    label: 'Recetas',     icon: 'menu_book'        },
  { view: 'articles',   label: 'Artículos',   icon: 'package_2'        },
  { view: 'store',      label: 'Tienda',      icon: 'storefront'       },
  { view: 'suppliers',  label: 'Proveedores', icon: 'local_shipping'   },
  { view: 'users',      label: 'Usuarios',    icon: 'manage_accounts'  },
  { view: 'inventory',  label: 'Inventario',  icon: 'inventory'        },
  { view: 'locations',  label: 'Ubicaciones', icon: 'location_on'      },
  { view: 'settings',   label: 'Configuración', icon: 'settings'       },
];

const PRIMARY_NAV: AppView[] = ['dashboard', 'orders', 'articles', 'store'];
interface SidebarProps {
  onLogout: () => void;
  setView: (view: AppView) => void;
  currentView: AppView;
  permissions: UserPermissions;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, setView, currentView, permissions }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    const load = () => { getBranding().then(setBranding).catch(() => {}); };
    load();
    window.addEventListener(BRANDING_CHANGED, load);
    return () => window.removeEventListener(BRANDING_CHANGED, load);
  }, []);

  // Fall back to the PlantArte mark until a name/logo is configured.
  const companyName = branding?.name.trim() || 'PlantArte';
  const logoUrl = branding?.logoUrl ?? null;

  const allowedItems = navItems.filter(n => n.view !== 'login' && permissions[n.view as PermissionKey]);
  const primaryItems = allowedItems.filter(n => PRIMARY_NAV.includes(n.view));
  const moreItems = allowedItems.filter(n => !PRIMARY_NAV.includes(n.view));
  const moreIsActive = moreItems.some(n => n.view === currentView);

  const handleMoreNav = (view: AppView) => {
    setView(view);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 bg-white border-r border-surface-variant transition-all duration-200 z-40 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center min-h-16 py-2 px-3 border-b border-surface-variant gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <button
            onClick={() => setView('dashboard')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${logoUrl ? 'bg-white border border-surface-variant' : 'bg-primary'}`}
            aria-label="Ir al panel"
            title={companyName}
          >
            {logoUrl
              ? <img src={logoUrl} alt={companyName} className="w-full h-full object-contain" />
              : <img src="/icon.png" alt={companyName} className="w-7 h-7 object-contain" />}
          </button>
          {!collapsed && (
            <span
              onClick={() => setView('dashboard')}
              title={companyName}
              className="font-epilogue text-sm font-extrabold text-primary tracking-tight leading-tight cursor-pointer select-none line-clamp-2 break-words"
            >
              {companyName}
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5 px-2">
          {navItems.map(({ view, label, icon }) => {
            const active = currentView === view;
            return (
              <button
                key={view}
                onClick={() => setView(view)}
                aria-label={label}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span
                  className="material-symbols-outlined text-xl shrink-0"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {icon}
                </span>
                {!collapsed && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-surface-variant px-2 py-3 flex flex-col gap-0.5 ${collapsed ? 'items-center' : ''}`}>
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors w-full"
          >
            <span className="material-symbols-outlined text-xl shrink-0">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
            {!collapsed && <span>Colapsar</span>}
          </button>
          <button
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-xl shrink-0">logout</span>
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

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
                aria-label={label}
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

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-variant shadow-lg flex justify-around items-center px-2 py-1.5">
        {primaryItems.map(({ view, label, icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            aria-label={label}
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
            {label}
          </button>
        ))}
        <button
          onClick={() => setMoreOpen(o => !o)}
          aria-label="Más opciones"
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

export default Sidebar;
