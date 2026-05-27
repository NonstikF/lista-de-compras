import React, { useEffect, useState } from 'react';
import type { Location, InventoryItem } from '../../types';
import { AuthError, getLocationByCode } from '../../services/api';
import { Button, MIcon, useToast } from '../ui';

interface LocationScanViewProps {
    code: string;
    authToken: string;
    onAuthError: () => void;
    onClose: () => void;
}

const LocationScanView: React.FC<LocationScanViewProps> = ({ code, authToken, onAuthError, onClose }) => {
    const toast = useToast();
    const [data, setData] = useState<(Location & { items: InventoryItem[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getLocationByCode(authToken, code)
            .then(d => { if (!cancelled) setData(d); })
            .catch(err => {
                if (cancelled) return;
                if (err instanceof AuthError) { onAuthError(); return; }
                setError(err instanceof Error ? err.message : 'Error al cargar ubicación');
                toast('error', 'No se pudo cargar la ubicación');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [code, authToken, onAuthError, toast]);

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-28 md:pb-10">
            <div className="flex items-center gap-3 mb-5">
                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition"
                    title="Cerrar"
                >
                    <MIcon name="arrow_back" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                        <MIcon name="qr_code_scanner" className="text-sm" />
                        Ubicación escaneada
                    </div>
                    <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background truncate">
                        {loading ? 'Cargando…' : (data?.name ?? 'Ubicación no encontrada')}
                    </h1>
                    {data && (
                        <p className="text-on-surface-variant text-sm font-mono mt-0.5">{data.code}</p>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <MIcon name="progress_activity" className="animate-spin mr-2" />
                    Cargando ubicación…
                </div>
            ) : error || !data ? (
                <div className="text-center py-16 text-on-surface-variant bg-white border border-dashed border-outline-variant rounded-2xl">
                    <MIcon name="error" size={48} className="mb-3 opacity-40" />
                    <p className="font-semibold text-on-surface">No encontramos la ubicación</p>
                    <p className="text-sm mt-1">Código: <span className="font-mono">{code}</span></p>
                    <Button variant="filled" className="mt-4" onClick={onClose}>Volver</Button>
                </div>
            ) : (
                <>
                    {data.description && (
                        <div className="bg-surface-container-low rounded-xl px-4 py-3 mb-4 text-sm text-on-surface-variant">
                            {data.description}
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
                            Productos asignados
                        </h2>
                        <span className="text-sm text-on-surface-variant">
                            {data.items.length} producto{data.items.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {data.items.length === 0 ? (
                        <div className="text-center py-12 text-on-surface-variant bg-white border border-dashed border-outline-variant rounded-2xl">
                            <MIcon name="inventory_2" size={40} className="mb-2 opacity-40" />
                            <p>Sin productos asignados a esta ubicación</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {data.items.map(item => {
                                const isOut = item.stock <= 0;
                                const isLow = !isOut && item.stock <= item.stockMin;
                                return (
                                    <div
                                        key={item.id}
                                        className={`bg-white border rounded-xl px-3 md:px-4 py-3 ${
                                            isOut ? 'border-red-200' : isLow ? 'border-amber-200' : 'border-surface-variant'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.article.image ? (
                                                <img src={item.article.image} alt={item.article.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
                                            ) : (
                                                <div className="w-11 h-11 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                                                    <MIcon name="inventory_2" className="text-on-surface-variant" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-on-background truncate">{item.article.name}</p>
                                                {item.article.category && (
                                                    <p className="text-xs text-on-surface-variant">{item.article.category}</p>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <div className={`text-xl font-bold tabular-nums ${isOut ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-on-background'}`}>
                                                    {item.stock}
                                                </div>
                                                <div className="text-xs text-on-surface-variant">{item.unit}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LocationScanView;
