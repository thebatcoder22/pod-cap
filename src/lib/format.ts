// Dates read the way the team in India reads them, wherever the server runs.
const format = (d: Date, style: Intl.DateTimeFormatOptions) =>
  d.toLocaleString("en-GB", { ...style, timeZone: "Asia/Kolkata" });

/** 23 Oct 2026, 14:00 */
export const dateTime = (d: Date) => format(d, { dateStyle: "medium", timeStyle: "short" });

/** 26 Oct */
export const day = (d: Date) => format(d, { day: "numeric", month: "short" });
