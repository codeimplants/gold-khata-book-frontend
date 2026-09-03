/**
 * GST filing period presets. Indian financial year runs Apr 1 – Mar 31;
 * quarters are Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar.
 */

export type GstPeriodPreset =
    | 'thisMonth'
    | 'lastMonth'
    | 'thisQuarter'
    | 'lastQuarter'
    | 'thisFY'
    | 'lastFY'
    | 'custom';

export interface GstPeriod {
    startDate: Date;
    endDate: Date;
}

const startOfDay = (d: Date) => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
};

const endOfDay = (d: Date) => {
    const out = new Date(d);
    out.setHours(23, 59, 59, 999);
    return out;
};

/** 0-based month of the Indian FY quarter start containing `month`. */
const quarterStartMonth = (month: number) => {
    // FY quarters start in Apr(3), Jul(6), Oct(9), Jan(0)
    if (month >= 3 && month <= 5) return 3;
    if (month >= 6 && month <= 8) return 6;
    if (month >= 9 && month <= 11) return 9;
    return 0;
};

/** Calendar year in which the Indian FY containing `date` starts. */
const fyStartYear = (date: Date) =>
    date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

export function getGstPeriod(preset: Exclude<GstPeriodPreset, 'custom'>, now = new Date()): GstPeriod {
    switch (preset) {
        case 'thisMonth': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { startDate: startOfDay(start), endDate: endOfDay(end) };
        }
        case 'lastMonth': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return { startDate: startOfDay(start), endDate: endOfDay(end) };
        }
        case 'thisQuarter': {
            const qStart = quarterStartMonth(now.getMonth());
            const start = new Date(now.getFullYear(), qStart, 1);
            const end = new Date(now.getFullYear(), qStart + 3, 0);
            return { startDate: startOfDay(start), endDate: endOfDay(end) };
        }
        case 'lastQuarter': {
            const thisQStart = quarterStartMonth(now.getMonth());
            const start = new Date(now.getFullYear(), thisQStart - 3, 1);
            const end = new Date(now.getFullYear(), thisQStart, 0);
            return { startDate: startOfDay(start), endDate: endOfDay(end) };
        }
        case 'thisFY': {
            const year = fyStartYear(now);
            return {
                startDate: startOfDay(new Date(year, 3, 1)),
                endDate: endOfDay(new Date(year + 1, 2, 31)),
            };
        }
        case 'lastFY': {
            const year = fyStartYear(now) - 1;
            return {
                startDate: startOfDay(new Date(year, 3, 1)),
                endDate: endOfDay(new Date(year + 1, 2, 31)),
            };
        }
    }
}

/** yyyy-mm-dd for API query params (local date, not UTC). */
export function toApiDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** dd/mm/yyyy for display. */
export function toDisplayDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const day = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${m}/${date.getFullYear()}`;
}
