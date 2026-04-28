import React, { useState, useEffect, useRef } from 'react';
import type { Supplier, SupplierTicket } from '../types';
import {
    AuthError, getSuppliers, createSupplier, updateSupplier, deleteSupplier,
    getSupplierTickets, getSupplierTicketContent, createSupplierTicket, deleteSupplierTicket,
} from '../services/catalogService';
import { Modal, Button, Field, Input, MIcon, useToast } from './ui';

interface SuppliersViewProps {
    authToken: string;
    onAuthError: () => void;
}

// ---------- Modal de edición ----------
interface SupplierForm {
    name: string;
    contact: string;
    phone: string;
}

const SupplierEditModal: React.FC<{
    supplier: Supplier | 'new' | null;
    onClose: () => void;
    onSave: (data: SupplierForm) => Promise<void>;
}> = ({ supplier, onClose, onSave }) => {
    const isNew = supplier === 'new';
    const initial: SupplierForm = isNew
        ? { name: '', contact: '', phone: '' }
        : { name: (supplier as Supplier).name, contact: (supplier as Supplier).contact, phone: (supplier as Supplier).phone };

    const [form, setForm] = useState<SupplierForm>(initial);
    const [nameError, setNameError] = useState('');
    const [saving, setSaving] = useState(false);

    const update = (k: keyof SupplierForm, v: string) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setNameError('El nombre es requerido'); return; }
        setSaving(true);
        try {
            await onSave({ name: form.name.trim(), contact: form.contact.trim(), phone: form.phone.trim() });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={isNew ? 'Nuevo proveedor' : 'Editar proveedor'}
            maxWidth="max-w-md"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" icon="save" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <Field label="Nombre" required error={nameError}>
                    <Input
                        value={form.name}
                        onChange={e => { update('name', e.target.value); setNameError(''); }}
                        placeholder="Ej. Viveros del Sur"
                        autoFocus
                    />
                </Field>
                <Field label="Contacto">
                    <Input
                        value={form.contact}
                        onChange={e => update('contact', e.target.value)}
                        placeholder="Nombre del contacto"
                    />
                </Field>
                <Field label="Teléfono">
                    <Input
                        type="tel"
                        value={form.phone}
                        onChange={e => update('phone', e.target.value)}
                        placeholder="55 1234 5678"
                    />
                </Field>
            </form>
        </Modal>
    );
};

// ---------- Modal de tickets ----------
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openPdfInNewTab(dataUrl: string, filename: string) {
    // Convert base64 dataURL to Blob and open via object URL to avoid document.write
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        // Fallback: force download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    }
    // Clean up the object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const SupplierTicketsModal: React.FC<{
    supplier: Supplier;
    authToken: string;
    onClose: () => void;
    onAuthError: () => void;
}> = ({ supplier, authToken, onClose, onAuthError }) => {
    const [tickets, setTickets] = useState<SupplierTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [viewingContent, setViewingContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getSupplierTickets(authToken, supplier.id);
                if (!cancelled) setTickets(data);
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) toast('error', err instanceof Error ? err.message : 'Error al cargar tickets');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [supplier.id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (!ALLOWED_TYPES.includes(file.type)) {
            setFileError('Solo se permiten archivos JPG, PNG o PDF.');
            return;
        }
        if (file.size > 1_000_000) {
            setFileError('El archivo no puede superar 1 MB.');
            return;
        }
        setFileError('');

        const reader = new FileReader();
        reader.onload = ev => {
            const content = ev.target?.result as string;
            handleUpload(file, content);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async (file: File, content: string) => {
        setUploading(true);
        try {
            const ticket = await createSupplierTicket(authToken, supplier.id, {
                filename: file.name,
                mimeType: file.type,
                size: file.size,
                content,
            });
            setTickets(prev => [ticket, ...prev]);
            toast('success', 'Ticket subido correctamente');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al subir ticket');
        } finally {
            setUploading(false);
        }
    };

    const handleView = async (ticket: SupplierTicket) => {
        try {
            const full = await getSupplierTicketContent(authToken, supplier.id, ticket.id);
            if (!full.content) return;
            if (full.mimeType === 'application/pdf') {
                openPdfInNewTab(full.content, full.filename);
            } else {
                setViewingContent(full.content);
                setViewingFilename(full.filename);
            }
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'No se pudo cargar el ticket');
        }
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        setDeleting(true);
        try {
            await deleteSupplierTicket(authToken, supplier.id, confirmDeleteId);
            setTickets(prev => prev.filter(t => t.id !== confirmDeleteId));
            toast('success', 'Ticket eliminado');
            setConfirmDeleteId(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar ticket');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title={`Tickets — ${supplier.name}`}
                maxWidth="max-w-2xl"
                footer={<Button variant="neutral" onClick={onClose}>Cerrar</Button>}
            >
                <div className="p-6 space-y-5">
                    {/* Zona de subida */}
                    <div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="w-full border-2 border-dashed border-surface-variant rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                            ) : (
                                <MIcon name="upload_file" size={32} className="text-on-surface-variant" />
                            )}
                            <span className="text-sm text-on-surface-variant">
                                {uploading ? 'Subiendo…' : 'Subir ticket (JPG, PNG o PDF — máx. 1 MB)'}
                            </span>
                        </button>
                        {fileError && (
                            <p className="mt-1.5 text-sm text-error flex items-center gap-1">
                                <MIcon name="error" className="text-sm" />
                                {fileError}
                            </p>
                        )}
                    </div>

                    {/* Lista de tickets */}
                    {isLoading && (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                        </div>
                    )}

                    {!isLoading && tickets.length === 0 && (
                        <div className="flex flex-col items-center py-8 text-center text-on-surface-variant">
                            <MIcon name="receipt_long" size={40} className="mb-2 opacity-40" />
                            <p className="text-sm">No hay tickets para este proveedor</p>
                        </div>
                    )}

                    {!isLoading && tickets.length > 0 && (
                        <div className="space-y-2">
                            {tickets.map(ticket => (
                                <div
                                    key={ticket.id}
                                    className="flex items-center gap-3 bg-surface rounded-xl border border-surface-variant px-4 py-3"
                                >
                                    <MIcon
                                        name={ticket.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                                        className="text-on-surface-variant flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-on-background truncate">{ticket.filename}</p>
                                        <p className="text-xs text-on-surface-variant">
                                            {formatSize(ticket.size)} · {new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <Button variant="tonal" size="sm" icon="visibility" onClick={() => handleView(ticket)}>
                                            Ver
                                        </Button>
                                        <Button
                                            variant="text"
                                            size="sm"
                                            icon="delete"
                                            className="text-error hover:bg-error/8"
                                            onClick={() => setConfirmDeleteId(ticket.id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Confirmar eliminar ticket */}
            {confirmDeleteId && (
                <Modal
                    open
                    onClose={() => setConfirmDeleteId(null)}
                    title="Eliminar ticket"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancelar</Button>
                            <Button variant="danger" icon="delete" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </Button>
                        </>
                    }
                >
                    <div className="p-6 text-on-surface">
                        ¿Eliminar este ticket? Esta acción no se puede deshacer.
                    </div>
                </Modal>
            )}

            {/* Visor de imagen */}
            {viewingContent && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setViewingContent(null)}
                >
                    <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                        <button
                            className="absolute -top-10 right-0 text-white flex items-center gap-1 text-sm hover:opacity-80"
                            onClick={() => setViewingContent(null)}
                        >
                            <MIcon name="close" /> Cerrar
                        </button>
                        <img
                            src={viewingContent}
                            alt={viewingFilename ?? 'Ticket'}
                            className="w-full rounded-xl object-contain max-h-[80vh]"
                        />
                        <p className="text-center text-white/70 text-xs mt-2">{viewingFilename}</p>
                    </div>
                </div>
            )}
        </>
    );
};

// ---------- Fila de proveedor ----------
const SupplierRow: React.FC<{
    supplier: Supplier;
    onEdit: (s: Supplier) => void;
    onDelete: (s: Supplier) => void;
    onTickets: (s: Supplier) => void;
}> = ({ supplier, onEdit, onDelete, onTickets }) => (
    <div className="bg-white rounded-xl border border-surface-variant shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MIcon name="local_shipping" className="text-primary" fill />
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-epilogue font-semibold text-on-background truncate">{supplier.name}</p>
            <div className="flex gap-3 text-sm text-on-surface-variant mt-0.5 flex-wrap">
                {supplier.contact && (
                    <span className="flex items-center gap-1">
                        <MIcon name="person" className="text-sm" />
                        {supplier.contact}
                    </span>
                )}
                {supplier.phone && (
                    <span className="flex items-center gap-1">
                        <MIcon name="phone" className="text-sm" />
                        {supplier.phone}
                    </span>
                )}
            </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
            <Button variant="tonal" size="sm" icon="receipt_long" onClick={() => onTickets(supplier)}>
                Tickets
            </Button>
            <Button variant="tonal" size="sm" icon="edit" onClick={() => onEdit(supplier)}>
                Editar
            </Button>
            <Button
                variant="text"
                size="sm"
                icon="delete"
                className="text-error hover:bg-error/8"
                onClick={() => onDelete(supplier)}
            />
        </div>
    </div>
);

// ---------- Vista principal ----------
const SuppliersView: React.FC<SuppliersViewProps> = ({ authToken, onAuthError }) => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [ticketsSupplier, setTicketsSupplier] = useState<Supplier | null>(null);
    const toast = useToast();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getSuppliers(authToken);
                if (!cancelled) setSuppliers(data);
            } catch (err) {
                if (err instanceof AuthError) { onAuthError(); return; }
                if (!cancelled) toast('error', err instanceof Error ? err.message : 'Error al cargar proveedores');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [authToken]);

    const handleSave = async (data: { name: string; contact: string; phone: string }) => {
        const isNew = editing === 'new';
        try {
            if (isNew) {
                const created = await createSupplier(authToken, data);
                setSuppliers(prev => [...prev, created]);
                toast('success', `${data.name} agregado`);
            } else {
                const updated = await updateSupplier(authToken, (editing as Supplier).id, data);
                setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
                toast('success', `${data.name} actualizado`);
            }
            setEditing(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al guardar');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            await deleteSupplier(authToken, confirmDelete.id);
            setSuppliers(prev => prev.filter(s => s.id !== confirmDelete.id));
            toast('success', `${confirmDelete.name} eliminado`);
            setConfirmDelete(null);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-epilogue text-3xl font-bold text-on-background">Proveedores</h1>
                    <p className="text-on-surface-variant mt-0.5">
                        {isLoading ? 'Cargando…' : suppliers.length === 0 ? 'Sin proveedores' : `${suppliers.length} proveedor${suppliers.length !== 1 ? 'es' : ''}`}
                    </p>
                </div>
                <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                    Nuevo proveedor
                </Button>
            </div>

            {isLoading && (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                </div>
            )}

            {!isLoading && suppliers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MIcon name="local_shipping" size={40} className="text-primary" fill />
                    </div>
                    <h2 className="font-epilogue text-xl font-bold text-on-background">Sin proveedores</h2>
                    <p className="text-on-surface-variant mt-1 mb-6 max-w-sm">
                        Agrega tus proveedores para asignarlos a los artículos del catálogo.
                    </p>
                    <Button variant="filled" icon="add" onClick={() => setEditing('new')}>
                        Agregar proveedor
                    </Button>
                </div>
            )}

            {!isLoading && suppliers.length > 0 && (
                <div className="space-y-3">
                    {suppliers.map(s => (
                        <SupplierRow
                            key={s.id}
                            supplier={s}
                            onEdit={setEditing}
                            onDelete={setConfirmDelete}
                            onTickets={setTicketsSupplier}
                        />
                    ))}
                </div>
            )}

            {editing !== null && (
                <SupplierEditModal
                    supplier={editing}
                    onClose={() => setEditing(null)}
                    onSave={handleSave}
                />
            )}

            {confirmDelete && (
                <Modal
                    open
                    onClose={() => setConfirmDelete(null)}
                    title="Eliminar proveedor"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
                            <Button variant="danger" icon="delete" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </Button>
                        </>
                    }
                >
                    <div className="p-6 text-on-surface">
                        ¿Eliminar <strong>{confirmDelete.name}</strong>? Esta acción no se puede deshacer.
                    </div>
                </Modal>
            )}

            {ticketsSupplier && (
                <SupplierTicketsModal
                    supplier={ticketsSupplier}
                    authToken={authToken}
                    onClose={() => setTicketsSupplier(null)}
                    onAuthError={onAuthError}
                />
            )}
        </main>
    );
};

export default SuppliersView;
