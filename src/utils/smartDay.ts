import type { Supplier, SmartDayWeek } from '../types';

// Cálculo de "Smart Day": fecha recurrente de oferta de un proveedor
// (ej. Smart & Final = último miércoles de cada mes) y ventana de aviso.

const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEK_LABELS: Record<SmartDayWeek, string> = {
    first: 'primer',
    second: 'segundo',
    third: 'tercer',
    fourth: 'cuarto',
    last: 'último',
};

export const weekdayLabel = (w: number): string => WEEKDAY_LABELS[w] ?? '';
export const weekLabel = (w: SmartDayWeek): string => WEEK_LABELS[w] ?? '';

/** ¿El proveedor tiene una regla de Smart Day completa y activa? */
export function hasSmartDayRule(s: Supplier): boolean {
    return s.smartDayEnabled && s.smartDayWeekday != null && s.smartDayWeek != null;
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Fecha del Smart Day para un mes dado (year, month 0-11).
 * Devuelve la fecha del N-ésimo (o último) `weekday` de ese mes.
 */
function smartDayInMonth(year: number, month: number, weekday: number, week: SmartDayWeek): Date {
    if (week === 'last') {
        // Último `weekday`: empezar desde el último día del mes y retroceder.
        const lastDay = new Date(year, month + 1, 0); // día 0 del mes siguiente = último del actual
        const diff = (lastDay.getDay() - weekday + 7) % 7;
        return new Date(year, month, lastDay.getDate() - diff);
    }
    const nth = { first: 1, second: 2, third: 3, fourth: 4 }[week];
    const firstDay = new Date(year, month, 1);
    const offset = (weekday - firstDay.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (nth - 1) * 7);
}

/**
 * Próximo Smart Day en o después de `from` (inclusive del propio día).
 * Devuelve null si el proveedor no tiene regla activa.
 */
export function nextSmartDayDate(s: Supplier, from: Date = new Date()): Date | null {
    if (!hasSmartDayRule(s)) return null;
    const weekday = s.smartDayWeekday as number;
    const week = s.smartDayWeek as SmartDayWeek;
    const today = startOfDay(from);

    const thisMonth = smartDayInMonth(today.getFullYear(), today.getMonth(), weekday, week);
    if (thisMonth.getTime() >= today.getTime()) return thisMonth;

    // Ya pasó este mes → siguiente mes
    const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return smartDayInMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), weekday, week);
}

/** Días enteros desde `from` hasta `target` (0 = hoy). */
export function daysUntil(target: Date, from: Date = new Date()): number {
    const a = startOfDay(from).getTime();
    const b = startOfDay(target).getTime();
    return Math.round((b - a) / 86_400_000);
}

export interface SmartDayWindow {
    active: boolean;       // ventana abierta (0..leadDays)
    date: Date | null;     // próximo Smart Day
    daysLeft: number;      // días faltantes (0 = hoy)
}

/**
 * Estado de la ventana de aviso del proveedor para `today`.
 * Ventana abierta cuando faltan entre 0 y `smartDayLeadDays` días (día incluido).
 */
export function smartDayWindow(s: Supplier, today: Date = new Date()): SmartDayWindow {
    const date = nextSmartDayDate(s, today);
    if (!date) return { active: false, date: null, daysLeft: -1 };
    const daysLeft = daysUntil(date, today);
    const active = daysLeft >= 0 && daysLeft <= s.smartDayLeadDays;
    return { active, date, daysLeft };
}

/** Etiqueta corta para mostrar en la cabecera de la sección. */
export function smartDayBadgeLabel(daysLeft: number): string {
    if (daysLeft <= 0) return '¡Hoy es Smart Day!';
    if (daysLeft === 1) return 'Smart Day mañana';
    return `Smart Day en ${daysLeft} días`;
}
