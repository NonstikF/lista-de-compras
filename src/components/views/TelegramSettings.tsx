import React, { useEffect, useState } from 'react';
import type { OrderReminder, TelegramChat, TelegramConfig } from '../../types';
import { AuthError, detectTelegramChats, getTelegramConfig, sendTelegramTest, updateTelegramConfig } from '../../services/api';
import { Button, Chip, Field, Input, MIcon, Select, Textarea, useToast } from '../ui';

interface TelegramSettingsProps {
    authToken: string;
    onAuthError: () => void;
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const NEW_REMINDER: OrderReminder = {
    weekday: 0, time: '08:00', followUpTime: '22:00', enabled: true,
    message: 'Hoy se hace el pedido. Agreguen los faltantes durante el día.',
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">{children}</span>
);

const TelegramSettings: React.FC<TelegramSettingsProps> = ({ authToken, onAuthError }) => {
    const toast = useToast();
    const [config, setConfig] = useState<TelegramConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [testing, setTesting] = useState(false);
    const [chats, setChats] = useState<TelegramChat[] | null>(null);

    // Editable copy; saved together with "Guardar Telegram".
    const [notifyNewOrders, setNotifyNewOrders] = useState(true);
    const [highlightIds, setHighlightIds] = useState<string[]>([]);
    const [reminders, setReminders] = useState<OrderReminder[]>([]);
    const [dirty, setDirty] = useState(false);

    const handleError = (err: unknown, fallback: string) => {
        if (err instanceof AuthError) { onAuthError(); return; }
        toast('error', err instanceof Error ? err.message : fallback);
    };

    const apply = (c: TelegramConfig) => {
        setConfig(c);
        setNotifyNewOrders(c.notifyNewOrders);
        setHighlightIds(c.highlightSupplierIds);
        setReminders(c.reminders);
        setDirty(false);
    };

    useEffect(() => {
        getTelegramConfig(authToken)
            .then(apply)
            .catch(err => handleError(err, 'Error al cargar Telegram'))
            .finally(() => setLoading(false));
    }, []);

    const edit = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: React.SetStateAction<T>) => {
        setter(value);
        setDirty(true);
    };
    const setNotify = edit(setNotifyNewOrders);
    const setHighlight = edit(setHighlightIds);
    const setRems = edit(setReminders);

    const updateReminder = (index: number, patch: Partial<OrderReminder>) =>
        setRems(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

    const handleSave = async () => {
        if (reminders.some(r => !r.message.trim())) { toast('error', 'Cada recordatorio necesita un mensaje'); return; }
        setSaving(true);
        try {
            apply(await updateTelegramConfig(authToken, { notifyNewOrders, highlightSupplierIds: highlightIds, reminders }));
            toast('success', 'Telegram guardado');
        } catch (err) {
            handleError(err, 'Error al guardar Telegram');
        } finally {
            setSaving(false);
        }
    };

    const handleDetect = async () => {
        setDetecting(true);
        try {
            const found = await detectTelegramChats(authToken);
            setChats(found);
            if (found.length === 0) toast('error', 'No se encontraron grupos. Agrega el bot al grupo y escribe /start ahí.');
        } catch (err) {
            handleError(err, 'Error al buscar grupos');
        } finally {
            setDetecting(false);
        }
    };

    const handleLink = async (chat: TelegramChat | null) => {
        try {
            const updated = await updateTelegramConfig(authToken, { chatId: chat?.id ?? null, chatTitle: chat?.title ?? '' });
            // Keep unsaved edits to the rest of the form.
            setConfig(updated);
            setChats(null);
            toast('success', chat ? `Vinculado a ${chat.title}` : 'Grupo desvinculado');
        } catch (err) {
            handleError(err, 'Error al vincular grupo');
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            await sendTelegramTest(authToken);
            toast('success', 'Mensaje de prueba enviado');
        } catch (err) {
            handleError(err, 'Error al enviar prueba');
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white border border-surface-variant rounded-2xl p-6 flex items-center justify-center text-on-surface-variant">
                <MIcon name="progress_activity" className="animate-spin mr-2" />
                Cargando Telegram...
            </div>
        );
    }
    if (!config) return null;

    return (
        <div className="bg-white border border-surface-variant rounded-2xl p-6 space-y-6">
            <div>
                <h2 className="font-epilogue text-lg font-bold text-on-background flex items-center gap-2">
                    <MIcon name="send" className="text-primary" />
                    Telegram
                </h2>
                <p className="text-on-surface-variant text-sm mt-0.5">Avisos de pedidos nuevos y recordatorios de los días de pedido</p>
            </div>

            {/* Bot */}
            {!config.tokenConfigured ? (
                <div className="rounded-xl bg-surface-container-low border border-outline-variant p-4 text-sm text-on-surface space-y-2">
                    <p className="font-semibold">Falta conectar el bot</p>
                    <ol className="list-decimal pl-5 space-y-1 text-on-surface-variant">
                        <li>En Telegram, abre <b>@BotFather</b>, envía <code>/newbot</code> y sigue los pasos.</li>
                        <li>Copia el token que te da y agrégalo en Railway, servicio <b>backend</b> → Variables, como <code>TELEGRAM_BOT_TOKEN</code>.</li>
                        <li>Railway redespliega solo; después recarga esta página.</li>
                    </ol>
                </div>
            ) : config.botError ? (
                <div className="rounded-xl bg-error/10 text-error p-4 text-sm">
                    No se pudo conectar con el bot: {config.botError}. Revisa la variable <code>TELEGRAM_BOT_TOKEN</code>.
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm text-on-surface">
                    <MIcon name="check_circle" fill className="text-primary" />
                    Bot conectado: <b>@{config.botUsername}</b>
                </div>
            )}

            {config.tokenConfigured && !config.botError && (
                <>
                    {/* Grupo */}
                    <div>
                        <SectionLabel>Grupo</SectionLabel>
                        {config.chatId ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                    <MIcon name="groups" size={18} />
                                    {config.chatTitle || config.chatId}
                                </span>
                                <Button variant="outline" size="sm" icon="send" onClick={handleTest} disabled={testing}>
                                    {testing ? 'Enviando…' : 'Enviar prueba'}
                                </Button>
                                <Button variant="text" size="sm" icon="refresh" onClick={handleDetect} disabled={detecting}>
                                    Cambiar grupo
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-on-surface-variant">
                                    Agrega <b>@{config.botUsername}</b> al grupo de compras, escribe <code>/start</code> en el grupo y luego pulsa “Detectar grupo”.
                                </p>
                                <Button variant="tonal" size="sm" icon="search" onClick={handleDetect} disabled={detecting}>
                                    {detecting ? 'Buscando…' : 'Detectar grupo'}
                                </Button>
                            </div>
                        )}
                        {chats && chats.length > 0 && (
                            <div className="mt-3 rounded-xl border border-outline-variant divide-y divide-surface-variant">
                                {chats.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleLink(c)}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-surface-container-low"
                                    >
                                        <span className="flex items-center gap-2">
                                            <MIcon name={c.type === 'private' ? 'person' : 'groups'} size={18} className="text-on-surface-variant" />
                                            {c.title}
                                        </span>
                                        <span className="text-primary font-semibold">Vincular</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pedidos nuevos */}
                    <div>
                        <SectionLabel>Pedidos nuevos</SectionLabel>
                        <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
                            <input
                                type="checkbox"
                                checked={notifyNewOrders}
                                onChange={e => setNotify(e.target.checked)}
                                className="w-4 h-4 accent-primary"
                            />
                            Avisar en el grupo cada vez que se registre un pedido
                        </label>
                    </div>

                    {/* Proveedores resaltados */}
                    <div>
                        <SectionLabel>Proveedores resaltados</SectionLabel>
                        <p className="text-sm text-on-surface-variant mb-3">
                            Si un pedido incluye alguno de estos proveedores, el aviso llega marcado con 🚨 y con sonido. Los demás llegan en silencio.
                        </p>
                        {config.suppliers.length === 0 ? (
                            <p className="text-sm text-on-surface-variant">No hay proveedores registrados.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {config.suppliers.map(s => {
                                    const active = highlightIds.includes(s.id);
                                    return (
                                        <Chip
                                            key={s.id}
                                            active={active}
                                            icon={active ? 'priority_high' : undefined}
                                            onClick={() => setHighlight(prev => (active ? prev.filter(id => id !== s.id) : [...prev, s.id]))}
                                        >
                                            {s.name}
                                        </Chip>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Recordatorios */}
                    <div>
                        <SectionLabel>Recordatorios de día de pedido</SectionLabel>
                        <p className="text-sm text-on-surface-variant mb-3">
                            Se envían al grupo el día indicado. Si a la hora de seguimiento no se ha registrado ningún pedido ese día, se avisa otra vez.
                            Horario de {config.timezone.replace('America/', '')}.
                        </p>
                        <div className="space-y-3">
                            {reminders.map((r, i) => (
                                <div key={r.id ?? `new-${i}`} className={`rounded-xl border border-outline-variant p-4 space-y-3 ${r.enabled ? '' : 'opacity-60'}`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <Field label="Día">
                                            <Select value={r.weekday} onChange={e => updateReminder(i, { weekday: Number(e.target.value) })}>
                                                {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
                                            </Select>
                                        </Field>
                                        <Field label="Recordatorio">
                                            <Input type="time" value={r.time} onChange={e => updateReminder(i, { time: e.target.value })} required />
                                        </Field>
                                        <Field label="Seguimiento" hint="Vacío = sin seguimiento">
                                            <Input type="time" value={r.followUpTime ?? ''} onChange={e => updateReminder(i, { followUpTime: e.target.value || null })} />
                                        </Field>
                                    </div>
                                    <Field label="Mensaje">
                                        <Textarea value={r.message} onChange={e => updateReminder(i, { message: e.target.value })} rows={2} />
                                    </Field>
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={r.enabled}
                                                onChange={e => updateReminder(i, { enabled: e.target.checked })}
                                                className="w-4 h-4 accent-primary"
                                            />
                                            Activo
                                        </label>
                                        <Button
                                            variant="text"
                                            size="sm"
                                            icon="delete"
                                            className="text-error hover:text-error"
                                            onClick={() => setRems(prev => prev.filter((_, n) => n !== i))}
                                        >
                                            Eliminar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" icon="add" className="mt-3" onClick={() => setRems(prev => [...prev, { ...NEW_REMINDER }])}>
                            Agregar recordatorio
                        </Button>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="filled" icon="save" onClick={handleSave} disabled={!dirty || saving}>
                            {saving ? 'Guardando…' : 'Guardar Telegram'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TelegramSettings;
