import React, { useState, useEffect, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    type: ToastType;
    message: string;
}

let addToastFn: ((type: ToastType, message: string) => void) | null = null;
let toastId = 0;

export function showToast(type: ToastType, message: string): void {
    if (addToastFn) {
        addToastFn(type, message);
    }
}

const TOAST_COLORS: Record<ToastType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
};

const TOAST_ICONS: Record<ToastType, string> = {
    success: '\u2713',
    error: '\u2717',
    info: '\u2139',
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 4000);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
        <div
            className={`${TOAST_COLORS[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-md`}
            style={{ animation: 'slideIn 0.3s ease-out' }}
            role="alert"
        >
            <span className="text-lg font-bold flex-shrink-0">{TOAST_ICONS[toast.type]}</span>
            <p className="text-sm font-medium flex-grow">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 text-white/80 hover:text-white text-lg font-bold leading-none"
                aria-label="Cerrar"
            >
                &times;
            </button>
        </div>
    );
};

export const Toast = {
    success: (message: string) => showToast('success', message),
    error: (message: string) => showToast('error', message),
    info: (message: string) => showToast('info', message),
};

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        addToastFn = (type: ToastType, message: string) => {
            setToasts(prev => [...prev, { id: ++toastId, type, message }]);
        };
        return () => { addToastFn = null; };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
                ))}
            </div>
        </>
    );
};
