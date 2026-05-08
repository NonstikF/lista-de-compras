import React, { useState, useEffect } from 'react';
import type { User } from '../../types';
import { AuthError, getUsers, createUser, updateUser, deleteUser } from '../../services/api';
import { Modal, Button, Field, Input, MIcon, useToast } from '../ui';

interface UsersViewProps {
    authToken: string;
    onAuthError: () => void;
}

interface UserForm {
    username: string;
    nombre: string;
    password: string;
    confirmPassword: string;
}

interface EditForm {
    nombre: string;
    password: string;
    confirmPassword: string;
}

// ---------- Modal nuevo usuario ----------
const NewUserModal: React.FC<{
    onClose: () => void;
    onSave: (data: { username: string; nombre: string; password: string }) => Promise<void>;
}> = ({ onClose, onSave }) => {
    const [form, setForm] = useState<UserForm>({ username: '', nombre: '', password: '', confirmPassword: '' });
    const [errors, setErrors] = useState<Partial<UserForm>>({});
    const [saving, setSaving] = useState(false);

    const update = (k: keyof UserForm, v: string) => {
        setForm(f => ({ ...f, [k]: v }));
        setErrors(e => ({ ...e, [k]: undefined }));
    };

    const validate = (): boolean => {
        const e: Partial<UserForm> = {};
        if (!form.username.trim()) e.username = 'Requerido';
        if (!form.nombre.trim()) e.nombre = 'Requerido';
        if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
        if (form.password !== form.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave({ username: form.username.trim(), nombre: form.nombre.trim(), password: form.password });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Nuevo usuario"
            maxWidth="max-w-md"
            footer={
                <>
                    <Button variant="neutral" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button variant="filled" icon="person_add" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando…' : 'Crear'}
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <Field label="Username" error={errors.username}>
                    <Input value={form.username} onChange={e => update('username', e.target.value)} placeholder="ej: maria" autoFocus />
                </Field>
                <Field label="Nombre completo" error={errors.nombre}>
                    <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} placeholder="ej: María García" />
                </Field>
                <Field label="Contraseña" error={errors.password}>
                    <Input value={form.password} onChange={e => update('password', e.target.value)} type="password" placeholder="Mínimo 6 caracteres" />
                </Field>
                <Field label="Confirmar contraseña" error={errors.confirmPassword}>
                    <Input value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} type="password" placeholder="Repetir contraseña" />
                </Field>
            </form>
        </Modal>
    );
};

// ---------- Modal editar usuario ----------
const EditUserModal: React.FC<{
    user: User;
    onClose: () => void;
    onSave: (data: { nombre?: string; password?: string }) => Promise<void>;
}> = ({ user, onClose, onSave }) => {
    const [form, setForm] = useState<EditForm>({ nombre: user.nombre, password: '', confirmPassword: '' });
    const [errors, setErrors] = useState<Partial<EditForm>>({});
    const [saving, setSaving] = useState(false);

    const update = (k: keyof EditForm, v: string) => {
        setForm(f => ({ ...f, [k]: v }));
        setErrors(e => ({ ...e, [k]: undefined }));
    };

    const validate = (): boolean => {
        const e: Partial<EditForm> = {};
        if (!form.nombre.trim()) e.nombre = 'Requerido';
        if (form.password && form.password.length < 6) e.password = 'Mínimo 6 caracteres';
        if (form.password && form.password !== form.confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        const data: { nombre?: string; password?: string } = { nombre: form.nombre.trim() };
        if (form.password) data.password = form.password;
        try {
            await onSave(data);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={`Editar: ${user.username}`}
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
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <Field label="Nombre completo" error={errors.nombre}>
                    <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} autoFocus />
                </Field>
                <Field label="Nueva contraseña" hint="Dejar vacío para no cambiar" error={errors.password}>
                    <Input value={form.password} onChange={e => update('password', e.target.value)} type="password" placeholder="Nueva contraseña (opcional)" />
                </Field>
                {form.password && (
                    <Field label="Confirmar contraseña" error={errors.confirmPassword}>
                        <Input value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} type="password" placeholder="Repetir contraseña" />
                    </Field>
                )}
            </form>
        </Modal>
    );
};

// ---------- Vista principal ----------
const UsersView: React.FC<UsersViewProps> = ({ authToken, onAuthError }) => {
    const toast = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            setUsers(await getUsers(authToken));
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (data: { username: string; nombre: string; password: string }) => {
        try {
            const user = await createUser(authToken, data);
            setUsers(u => [...u, user]);
            setShowNew(false);
            toast('success', `Usuario ${user.username} creado`);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al crear usuario');
            throw err;
        }
    };

    const handleEdit = async (data: { nombre?: string; password?: string }) => {
        if (!editingUser) return;
        try {
            const updated = await updateUser(authToken, editingUser.id, data);
            setUsers(u => u.map(x => x.id === updated.id ? updated : x));
            setEditingUser(null);
            toast('success', 'Usuario actualizado');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al actualizar usuario');
            throw err;
        }
    };

    const handleToggleActive = async (user: User) => {
        try {
            const updated = await updateUser(authToken, user.id, { activo: !user.activo });
            setUsers(u => u.map(x => x.id === updated.id ? updated : x));
            toast('success', updated.activo ? `${user.username} activado` : `${user.username} desactivado`);
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', 'Error al cambiar estado');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteUser(authToken, id);
            setUsers(u => u.filter(x => x.id !== id));
            setDeletingId(null);
            toast('success', 'Usuario eliminado');
        } catch (err) {
            if (err instanceof AuthError) { onAuthError(); return; }
            toast('error', err instanceof Error ? err.message : 'Error al eliminar usuario');
        }
    };

    const userToDelete = users.find(u => u.id === deletingId);

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 md:pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-epilogue text-2xl md:text-3xl font-bold text-on-background">Usuarios</h1>
                    <p className="text-on-surface-variant text-sm mt-0.5">Gestión de acceso al sistema</p>
                </div>
                <Button variant="filled" icon="person_add" onClick={() => setShowNew(true)}>
                    Nuevo usuario
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <MIcon name="progress_activity" className="animate-spin mr-2" />
                    Cargando...
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-16 text-on-surface-variant">
                    <MIcon name="group_off" size={48} className="mb-3 opacity-40" />
                    <p>No hay usuarios registrados</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {users.map(user => (
                        <div
                            key={user.id}
                            className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${
                                user.activo ? 'border-surface-variant' : 'border-surface-variant opacity-50'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                user.activo ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
                            }`}>
                                <MIcon name="person" fill={user.activo} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-on-background truncate">{user.nombre || user.username}</span>
                                    {!user.activo && (
                                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
                                            Inactivo
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm text-on-surface-variant">@{user.username}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => handleToggleActive(user)}
                                    title={user.activo ? 'Desactivar' : 'Activar'}
                                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
                                >
                                    <MIcon name={user.activo ? 'toggle_on' : 'toggle_off'} fill={user.activo} className={user.activo ? 'text-primary' : ''} />
                                </button>
                                <button
                                    onClick={() => setEditingUser(user)}
                                    title="Editar"
                                    className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
                                >
                                    <MIcon name="edit" />
                                </button>
                                <button
                                    onClick={() => setDeletingId(user.id)}
                                    title="Eliminar"
                                    className="p-2 rounded-full text-on-surface-variant hover:bg-error-container/30 hover:text-error transition-colors"
                                >
                                    <MIcon name="delete" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showNew && (
                <NewUserModal onClose={() => setShowNew(false)} onSave={handleCreate} />
            )}

            {editingUser && (
                <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleEdit} />
            )}

            {deletingId && userToDelete && (
                <Modal
                    open
                    onClose={() => setDeletingId(null)}
                    title="Eliminar usuario"
                    maxWidth="max-w-sm"
                    footer={
                        <>
                            <Button variant="neutral" onClick={() => setDeletingId(null)}>Cancelar</Button>
                            <Button variant="danger" icon="delete" onClick={() => handleDelete(deletingId)}>Eliminar</Button>
                        </>
                    }
                >
                    <p className="px-6 py-4 text-on-surface-variant">
                        ¿Eliminar al usuario <strong className="text-on-background">@{userToDelete.username}</strong>? Esta acción no se puede deshacer.
                    </p>
                </Modal>
            )}
        </div>
    );
};

export default UsersView;
