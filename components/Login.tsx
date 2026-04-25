import React, { useState } from 'react';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4000';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (response.status === 429) { setError('Demasiados intentos. Intenta en 15 minutos.'); return; }
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Credenciales inválidas'); return; }
      onLoginSuccess(data.token);
    } catch {
      setError('Error de conexión. Verifica que el servidor esté activo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-container rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-[30rem] h-[30rem] bg-category-chip-bg rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 flex flex-col items-center text-center border-b border-surface-variant/50 bg-gradient-to-b from-surface-muted to-surface-container-lowest">
            <div className="w-16 h-16 bg-primary-container flex items-center justify-center rounded-full mb-4 shadow-sm">
              <span className="material-symbols-outlined text-3xl text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
            </div>
            <h1 className="font-epilogue text-4xl font-bold text-primary tracking-tight">PlantArte</h1>
            <p className="text-on-surface-variant mt-2 text-sm">Acceso al sistema de gestión</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="p-8 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Usuario
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">person</span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ej. admin"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-on-surface text-sm transition-colors placeholder:text-outline/60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">lock</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-on-surface text-sm transition-colors placeholder:text-outline/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-error text-sm bg-error-container/30 px-3 py-2 rounded-lg">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary text-on-primary rounded-lg font-semibold shadow-sm hover:bg-surface-tint hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  <span>Iniciar Sesión</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="bg-surface-muted px-8 py-4 text-center border-t border-surface-variant/50">
            <p className="text-xs text-outline">Solo para personal autorizado.</p>
          </div>
        </div>

        <div className="mt-6 text-center text-outline opacity-50 flex flex-col items-center gap-1">
          <span className="material-symbols-outlined text-sm">local_florist</span>
          <p className="text-[10px]">PlantArte © 2025</p>
        </div>
      </main>
    </div>
  );
};

export default Login;
