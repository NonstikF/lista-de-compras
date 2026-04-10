import React, { useState, useEffect } from 'react';
import { getTelegramConfig, saveTelegramConfig, testTelegramBot } from '../services/woocommerceService';
import { showToast } from './Toast';

interface TelegramSettingsProps {
    authToken: string;
    onAuthError: () => void;
}

const TelegramSettings: React.FC<TelegramSettingsProps> = ({ authToken, onAuthError }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [tokenChanged, setTokenChanged] = useState(false);

    const [form, setForm] = useState({
        enabled: false,
        botToken: '',
        chatId: '',
        allowedChatIds: '',
        staleHours: 2,
    });
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const config = await getTelegramConfig(authToken);
                setForm({
                    enabled: config.enabled,
                    botToken: config.botToken,
                    chatId: config.chatId,
                    allowedChatIds: config.allowedChatIds,
                    staleHours: config.staleHours,
                });
                setHasToken(config.hasToken);
            } catch (err: unknown) {
                if (err instanceof Error && err.name === 'AuthError') {
                    onAuthError();
                } else {
                    showToast('error', 'Error al cargar la configuración');
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [authToken, onAuthError]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveTelegramConfig(authToken, {
                enabled: form.enabled,
                botToken: tokenChanged ? form.botToken : form.botToken, // masked if not changed
                chatId: form.chatId,
                allowedChatIds: form.allowedChatIds,
                staleHours: form.staleHours,
            });
            showToast('success', 'Configuración guardada. Bot reiniciado.');
            setTokenChanged(false);
            // Reload to get masked token
            const updated = await getTelegramConfig(authToken);
            setForm(f => ({ ...f, botToken: updated.botToken }));
            setHasToken(updated.hasToken);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AuthError') {
                onAuthError();
            } else {
                showToast('error', err instanceof Error ? err.message : 'Error al guardar');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            await testTelegramBot(authToken);
            showToast('success', 'Mensaje de prueba enviado correctamente');
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AuthError') {
                onAuthError();
            } else {
                showToast('error', err instanceof Error ? err.message : 'Error al enviar mensaje de prueba');
            }
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🤖</span>
                        <div>
                            <h2 className="text-xl font-bold text-white">Bot de Telegram</h2>
                            <p className="text-indigo-100 text-sm">Configuración y notificaciones</p>
                        </div>
                        <div className="ml-auto">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${form.enabled && hasToken ? 'bg-green-400/20 text-green-100 border border-green-300/30' : 'bg-white/10 text-white/70 border border-white/20'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${form.enabled && hasToken ? 'bg-green-300 animate-pulse' : 'bg-white/40'}`}></span>
                                {form.enabled && hasToken ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Enable toggle */}
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                        <div>
                            <p className="font-semibold text-slate-800">Habilitar bot</p>
                            <p className="text-sm text-slate-500">Activa el bot y las notificaciones automáticas</p>
                        </div>
                        <button
                            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${form.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Bot Token */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Token del Bot
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                            Obtenelo en <span className="font-mono bg-slate-100 px-1 rounded">@BotFather</span> → /newbot
                        </p>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={form.botToken}
                                onChange={e => {
                                    setForm(f => ({ ...f, botToken: e.target.value }));
                                    setTokenChanged(true);
                                }}
                                placeholder={hasToken ? 'Token guardado (modificar para cambiar)' : 'Ej: 7719236313:AAEExtfq...'}
                                className="w-full pr-20 pl-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                {showToken ? 'Ocultar' : 'Ver'}
                            </button>
                        </div>
                    </div>

                    {/* Chat ID */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Chat ID para notificaciones
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                            Tu ID numérico. Enviá cualquier mensaje al bot y consultá{' '}
                            <span className="font-mono bg-slate-100 px-1 rounded">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</span>
                        </p>
                        <input
                            type="text"
                            value={form.chatId}
                            onChange={e => setForm(f => ({ ...f, chatId: e.target.value }))}
                            placeholder="Ej: 1604064549"
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Allowed Chat IDs */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Usuarios autorizados
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                            Chat IDs que pueden usar el bot. Separados por coma. Vacío = cualquier persona.
                        </p>
                        <input
                            type="text"
                            value={form.allowedChatIds}
                            onChange={e => setForm(f => ({ ...f, allowedChatIds: e.target.value }))}
                            placeholder="Ej: 1604064549, 987654321"
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Stale hours */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Alerta de pedidos sin atender (horas)
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                            Recibirás una alerta cada 30 min si hay pedidos más viejos que este umbral.
                        </p>
                        <input
                            type="number"
                            min={1}
                            max={72}
                            value={form.staleHours}
                            onChange={e => setForm(f => ({ ...f, staleHours: Number(e.target.value) }))}
                            className="w-32 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Comandos disponibles */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 mb-2">Comandos disponibles en el bot:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
                            {[
                                ['/pedidos', 'Ver pedidos pendientes'],
                                ['/pedido [id]', 'Detalle de un pedido'],
                                ['/buscar [texto]', 'Buscar en pedidos'],
                                ['/comprado [id] [qty]', 'Marcar ítem comprado'],
                                ['/completar [id]', 'Completar pedido'],
                                ['/resumen', 'Resumen del día'],
                            ].map(([cmd, desc]) => (
                                <div key={cmd} className="flex gap-2">
                                    <span className="font-mono text-indigo-600 whitespace-nowrap">{cmd}</span>
                                    <span className="text-slate-500">{desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Guardando...' : 'Guardar configuración'}
                        </button>
                        <button
                            onClick={handleTest}
                            disabled={testing || !hasToken}
                            title={!hasToken ? 'Configurá el token primero' : ''}
                            className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-200"
                        >
                            {testing ? 'Enviando...' : '📨 Enviar mensaje de prueba'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TelegramSettings;
