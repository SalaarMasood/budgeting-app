/**
 * Utility functions to strictly enforce Pakistan Standard Time (PKT / Asia/Karachi)
 * so that "Today" rolls over exactly at midnight PKT, regardless of the browser or server timezone.
 */

/**
 * Returns today's date safely formatted as YYYY-MM-DD strictly in the Asia/Karachi timezone.
 */
export function getTodayPSTStr(): string {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(new Date());
}

/**
 * Returns the current date and time as a Date object adjusted to Asia/Karachi timezone.
 * Useful for Date.getFullYear(), Date.getMonth(), Date.getDate().
 */
export function getNowPST(): Date {
    const nowString = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" });
    return new Date(nowString);
}
