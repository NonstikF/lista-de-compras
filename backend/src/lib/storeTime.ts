// Wall-clock time at the store. Railway containers run in UTC, so anything
// that depends on "today" or "8:00" has to be computed in the store's zone.
export const STORE_TIMEZONE = process.env.APP_TIMEZONE || 'America/Tijuana';

export type StoreClock = {
    date: string;    // YYYY-MM-DD
    time: string;    // HH:MM
    weekday: number; // 0=Dom … 6=Sáb
    startOfDay: Date; // midnight at the store, as an absolute instant
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function storeClock(now: Date = new Date()): StoreClock {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: STORE_TIMEZONE,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            weekday: 'short', hourCycle: 'h23',
        }).formatToParts(now).map(p => [p.type, p.value]),
    );
    const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
    const h = Number(parts.hour), mi = Number(parts.minute), s = Number(parts.second);
    // Offset between the store's wall clock and UTC at this instant.
    const offsetMs = Date.UTC(y, m - 1, d, h, mi, s) - Math.floor(now.getTime() / 1000) * 1000;
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
        weekday: WEEKDAYS.indexOf(parts.weekday),
        startOfDay: new Date(Date.UTC(y, m - 1, d) - offsetMs),
    };
}
