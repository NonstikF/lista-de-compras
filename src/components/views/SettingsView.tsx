import React, { useState, useEffect, useRef } from 'react';
import type { CompanySettings } from '../../types';
import { AuthError, getSettings, updateSettings } from '../../services/api';
import { Button, Field, Input, MIcon, useToast } from '../ui';

interface SettingsViewProps {
    authToken: string;
    onAuthError: () => void;
}

const MAX_LOGO_SIZE = 500 * 1024; // 500 KB

const SettingsView: React.FC<SettingsViewProps> = ({ authToken, onAuthError }) => {
    const toast = useToast();
    const fileRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<CompanySettings | null>(null);

    // form state
    const [name, setName] = useState('');
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoChanged, setLogoChanged] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const s = await getSettings(authToken);
            setSettings(s);
            setName(s.name);
            setLogoPreview(s.logo);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast('error', 'Solo se permiten imágenes');
            return;
        }
        if (file.size > MAX_LOGO_SIZE) {
            toast('error', 'La imagen debe ser menor a 500 KB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setLogoPreview(reader.result as string);
            setLogoChanged(true);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setLogoPreview(null);
        setLogoChanged(true);
        if (fileRef.current) fileRef.current.value = '';
    };

    const hasChanges = name !== (settings?.name ?? '') || logoChanged;

    const handleSave = async () => {
        if (!hasChanges) return;
        setSaving(true);
        try {
            const data: { name?: string; logo?: string | null } = {};
            if (name !== (settings?.name ?? '')) data.name = name.trim();
            if (logoChanged) data.logo = logoPreview;
            const updated = await updateSettings(authToken, data);
            setSettings(updated);
            setName(updated.name);
            setLogoPreview(updated.logo);
            setLogoChanged(false);
            toast('success', 'Configuración guardada');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
                <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <MIcon name="progress_activity" className="animate-spin mr-2" />
                    Cargando...
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
            <div className="mb-6">
                <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background">Configuración</h1>
                <p className="text-on-surface-variant text-sm mt-0.5">Datos generales de la empresa</p>
            </div>

            <div className="bg-white border border-surface-variant rounded-2xl p-6 space-y-6">
                {/* Logo */}
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block mb-3">
                        Logotipo
                    </span>
                    <div className="flex items-center gap-5">
                        <div
                            className="w-24 h-24 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary transition-colors"
                            onClick={() => fileRef.current?.click()}
                        >
                            {logoPreview ? (
                                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                                <MIcon name="add_photo_alternate" size={32} className="text-on-surface-variant/40" />
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                icon="upload"
                                onClick={() => fileRef.current?.click()}
                            >
                                Subir imagen
                            </Button>
                            {logoPreview && (
                                <Button
                                    variant="text"
                                    size="sm"
                                    icon="delete"
                                    onClick={handleRemoveLogo}
                                    className="text-error hover:text-error"
                                >
                                    Eliminar
                                </Button>
                            )}
                            <span className="text-xs text-on-surface-variant">PNG, JPG o SVG. Máx 500 KB.</span>
                        </div>
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                {/* Company name */}
                <Field label="Nombre de la empresa">
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="ej: PlantArte"
                    />
                </Field>

                {/* Save */}
                <div className="flex justify-end pt-2">
                    <Button
                        variant="filled"
                        icon="save"
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
