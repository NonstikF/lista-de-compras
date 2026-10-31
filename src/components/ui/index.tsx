import React, { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from './Toast';

// ---------- Icon ----------
interface MIconProps {
  name: string;
  className?: string;
  fill?: boolean;
  size?: number;
}

export const MIcon: React.FC<MIconProps> = ({ name, className = '', fill = false, size }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={{
      fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0",
      fontSize: size ? `${size}px` : undefined,
    }}
  >
    {name}
  </span>
);

// ---------- Toast hook ----------
export const useToast = () => (type: 'success' | 'error' | 'info', message: string) => {
  showToast(type, message);
};

// ---------- Modal ----------
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, maxWidth = 'max-w-2xl' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl ${maxWidth} w-full max-h-[92vh] sm:max-h-[92vh] h-[92vh] sm:h-auto flex flex-col overflow-hidden border border-surface-variant`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-variant">
          <h3 className="font-epilogue text-xl font-bold text-on-background">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <MIcon name="close" className="text-xl" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-surface-variant bg-surface-container-low flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Button ----------
type ButtonVariant = 'filled' | 'tonal' | 'outline' | 'text' | 'danger' | 'neutral';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconFill?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'filled', size = 'md', icon, iconFill, children, className = '', type = 'button', ...rest }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  const variants: Record<ButtonVariant, string> = {
    filled:  'bg-primary text-on-primary hover:bg-primary-container hover:shadow-md',
    tonal:   'bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed-dim',
    outline: 'bg-transparent border border-outline text-primary hover:bg-primary/8',
    text:    'bg-transparent text-primary hover:bg-primary/8',
    danger:  'bg-error text-on-error hover:bg-error/90',
    neutral: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
  };
  return (
    <button type={type} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {icon && <MIcon name={icon} fill={iconFill} className="text-lg" />}
      {children}
    </button>
  );
};

// ---------- Field ----------
interface FieldProps {
  label?: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const Field: React.FC<FieldProps> = ({ label, children, hint, error, required }) => (
  <label className="flex flex-col gap-1.5">
    {label && (
      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </span>
    )}
    {children}
    {hint && !error && <span className="text-xs text-on-surface-variant">{hint}</span>}
    {error && <span className="text-xs text-error">{error}</span>}
  </label>
);

// ---------- Form inputs ----------
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...rest }) => (
  <input
    className={`px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface placeholder:text-on-surface-variant/60 transition ${className}`}
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...rest }) => (
  <select
    className={`px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface transition ${className}`}
    {...rest}
  >
    {children}
  </select>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...rest }) => (
  <textarea
    className={`px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white outline-none text-sm text-on-surface placeholder:text-on-surface-variant/60 transition resize-y min-h-[72px] ${className}`}
    {...rest}
  />
);

// ---------- Chip ----------
interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  icon?: string;
  children: React.ReactNode;
  count?: number;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({ active, onClick, icon, children, count, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
      active
        ? 'bg-primary text-on-primary border-primary shadow-sm'
        : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container'
    } ${className}`}
  >
    {icon && <MIcon name={icon} className="text-base" fill={active} />}
    {children}
    {count != null && (
      <span className={`ml-1 px-1.5 py-0 rounded-full text-[11px] font-bold ${
        active ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
      }`}>
        {count}
      </span>
    )}
  </button>
);

// ---------- Image viewer ----------
// Visor a pantalla completa: rueda / pellizco / clic en la imagen para zoom,
// arrastrar para mover, clic fuera de la imagen o Escape para cerrar.
interface ImageViewerProps {
  src: string;
  alt?: string;
  caption?: React.ReactNode;
  onClose: () => void;
}

type ViewState = { scale: number; x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const CLICK_ZOOM = 2.5;

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, caption, onClose }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: ViewState; x: number; y: number; dist: number } | null>(null);
  const moved = useRef(false);

  // Mantiene la imagen dentro del escenario cuando está ampliada
  const clamp = useCallback((v: ViewState): ViewState => {
    const stage = stageRef.current, img = imgRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale));
    if (!stage || !img || scale === 1) return { scale, x: 0, y: 0 };
    const maxX = Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2);
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, v.x)),
      y: Math.min(maxY, Math.max(-maxY, v.y)),
    };
  }, []);

  // Zoom manteniendo fijo el punto (px, py) de pantalla, partiendo del estado `from`
  const zoomAt = useCallback((from: ViewState, scale: number, px: number, py: number, ox = px, oy = py): ViewState => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return from;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    return clamp({
      scale: s,
      x: px - cx - (s * (ox - cx - from.x)) / from.scale,
      y: py - cy - (s * (oy - cy - from.y)) / from.scale,
    });
  }, [clamp]);

  const zoomBy = (factor: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView(v => zoomAt(v, v.scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Evita que el Modal de abajo también se cierre
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // La rueda necesita un listener no pasivo para poder bloquear el scroll
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView(v => zoomAt(v, v.scale * factor, e.clientX, e.clientY));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) { gesture.current = null; return; }
    const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { view: viewRef.current, x, y, dist };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const x = (pts[0].x + pts[1].x) / 2, y = (pts[0].y + pts[1].y) / 2;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      moved.current = true;
      setDragging(true);
      setView(zoomAt(g.view, g.view.scale * (dist / g.dist), x, y, g.x, g.y));
    } else {
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!moved.current && Math.hypot(dx, dy) < 5) return;
      moved.current = true;
      if (g.view.scale > 1) {
        setDragging(true);
        setView(clamp({ ...g.view, x: g.view.x + dx, y: g.view.y + dy }));
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
    startGesture();
  };

  const onStageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moved.current) return;
    if (e.target === imgRef.current) {
      setView(v => v.scale > 1 ? { scale: 1, x: 0, y: 0 } : zoomAt(v, CLICK_ZOOM, e.clientX, e.clientY));
    } else {
      onClose();
    }
  };

  const zoomed = view.scale > 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex flex-col select-none" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-sm text-white/70 truncate min-w-0">{caption}</p>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button className="p-2 rounded-full hover:bg-white/10 disabled:opacity-40" onClick={() => zoomBy(1 / 1.5)} disabled={!zoomed} aria-label="Alejar">
            <MIcon name="zoom_out" />
          </button>
          <button className="w-14 text-xs tabular-nums text-white/80 hover:text-white" onClick={() => setView({ scale: 1, x: 0, y: 0 })} title="Restablecer">
            {Math.round(view.scale * 100)}%
          </button>
          <button className="p-2 rounded-full hover:bg-white/10 disabled:opacity-40" onClick={() => zoomBy(1.5)} disabled={view.scale >= MAX_SCALE} aria-label="Acercar">
            <MIcon name="zoom_in" />
          </button>
          <button className="ml-2 flex items-center gap-1 text-sm px-3 py-1.5 rounded-full hover:bg-white/10" onClick={onClose}>
            <MIcon name="close" /> Cerrar
          </button>
        </div>
      </div>
      <div
        ref={stageRef}
        className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center p-4"
        style={{ touchAction: 'none' }}
        onClick={onStageClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full object-contain rounded-xl"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
            cursor: zoomed ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
        />
      </div>
      <p className="text-center text-white/50 text-xs py-2 px-4">
        Rueda, pellizco o clic en la imagen para hacer zoom · clic fuera para cerrar
      </p>
    </div>
  );
};

// ---------- Currency ----------
export const fmt = (n: number): string =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
