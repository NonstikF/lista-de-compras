// Smart Day on the server: the supplier's recurring sale date (e.g. third
// Wednesday of each month), computed on the store's calendar dates
// ("YYYY-MM-DD" from storeClock) so the container's UTC clock never shifts it.
// Mirrors src/utils/smartDay.ts on the frontend.

export type SmartDayWeek = 'first' | 'second' | 'third' | 'fourth' | 'last';

export type SmartDayRule = {
    smartDayEnabled: boolean;
    smartDayWeekday: number | null;
    smartDayWeek: string | null;
    smartDayLeadDays: number;
};

const NTH: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
const DAY_MS = 86_400_000;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function hasSmartDayRule(s: SmartDayRule): boolean {
    return s.smartDayEnabled && s.smartDayWeekday != null && !!s.smartDayWeek && (s.smartDayWeek === 'last' || s.smartDayWeek in NTH);
}

// Dates are handled as UTC midnights, which only stand for calendar days here.
const parse = (date: string): Date => new Date(`${date}T00:00:00Z`);
const format = (d: Date): string => d.toISOString().slice(0, 10);

function smartDayInMonth(year: number, month: number, weekday: number, week: string): Date {
    if (week === 'last') {
        const lastDay = new Date(Date.UTC(year, month + 1, 0));
        const diff = (lastDay.getUTCDay() - weekday + 7) % 7;
        return new Date(Date.UTC(year, month, lastDay.getUTCDate() - diff));
    }
    const firstDay = new Date(Date.UTC(year, month, 1));
    const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, month, 1 + offset + (NTH[week] - 1) * 7));
}

// Next Smart Day on or after `today`, and how many days away it is (0 = today).
export function nextSmartDay(s: SmartDayRule, today: string): { date: string; daysLeft: number } | null {
    if (!hasSmartDayRule(s)) return null;
    const from = parse(today);
    let date = smartDayInMonth(from.getUTCFullYear(), from.getUTCMonth(), s.smartDayWeekday as number, s.smartDayWeek as string);
    if (date < from) date = smartDayInMonth(from.getUTCFullYear(), from.getUTCMonth() + 1, s.smartDayWeekday as number, s.smartDayWeek as string);
    return { date: format(date), daysLeft: Math.round((date.getTime() - from.getTime()) / DAY_MS) };
}

// "miércoles 18 de noviembre"
export function smartDayDateLabel(date: string): string {
    const d = parse(date);
    return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}
