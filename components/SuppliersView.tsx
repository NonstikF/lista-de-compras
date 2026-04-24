import React, { useState, useEffect } from 'react';
import type { Supplier } from '../types';
import { AuthError, getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/catalogService';
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
        await onSave({ name: form.name.trim(), contact: form.contact.trim(), phone: form.phone.trim() });
        setSaving(false);
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

// ---------- Fila de proveedor ----------
const SupplierRow: React.FC<{
    supplier: Supplier;
    onEdit: (s: Supplier) => void;
    onDelete: (s: Supplier) => void;
}> = ({ supplier, onEdit, onDelete }) => (
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
        </main>
    );
};

export default SuppliersView;
