import React, { useEffect } from 'react';
import { Toast } from './Toast';
import { CATEGORIES, type Product } from '../data/catalog';

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
  if (type === 'success') Toast.success(message);
  else if (type === 'error') Toast.error(message);
  else Toast.info(message);
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className={`bg-surface-container-lowest rounded-2xl shadow-2xl ${maxWidth} w-full max-h-[92vh] flex flex-col overflow-hidden border border-surface-variant`}
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

export const Button: React.FC<ButtonProps> = ({ variant = 'filled', size = 'md', icon, iconFill, children, className = '', ...rest }) => {
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
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
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

// ---------- Product image placeholder ----------
interface ProductThumbProps {
  product: Product;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ProductThumb: React.FC<ProductThumbProps> = ({ product, size = 'md', className = '' }) => {
  const sizes = {
    xs: 'w-8 h-8 text-[10px]',
    sm: 'w-12 h-12 text-xs',
    md: 'w-16 h-16 text-sm',
    lg: 'w-24 h-24 text-base',
    xl: 'w-full aspect-square text-lg',
  };
  const cat = CATEGORIES.find(c => c.id === product.category);
  const initials = product.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  if (product.image) {
    return <img src={product.image} alt={product.name} className={`${sizes[size]} rounded-xl object-cover ${className}`} />;
  }
  return (
    <div
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold text-white relative overflow-hidden ${className}`}
      style={{ backgroundColor: cat?.color ?? '#42493e' }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,.3) 4px, rgba(255,255,255,.3) 5px)' }}
      />
      <span className="relative font-epilogue">{initials}</span>
    </div>
  );
};

// ---------- Currency ----------
export const fmt = (n: number): string =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- Stock badge ----------
export const StockBadge: React.FC<{ stock: number }> = ({ stock }) => {
  if (stock === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-error-container text-on-error-container">Sin stock</span>;
  if (stock < 5)   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary-container text-on-secondary-container">Bajo: {stock}</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-fixed text-on-primary-fixed">{stock} disp.</span>;
};
