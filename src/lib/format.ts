// Dates read the way the team in India reads them, wherever the server runs.
const TIME_ZONE = "Asia/Kolkata";
const format = (d: Date, style: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("en-GB", { ...style, timeZone: TIME_ZONE });

/** 23 Oct 2026, 14:00 */
export const dateTime = (d: Date) => format(d, { dateStyle: "medium", timeStyle: "short" });

/** 26 Oct */
export const day = (d: Date) => format(d, { day: "numeric", month: "short" });

/** 2026-10-26, the calendar day in India. */
export const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

/** Mon, 9 Nov 2026 */
export const longDay = (d: Date) => format(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
