/**
 * Real-time Clock Utility for Maya AI
 * Always derives from device system clock with Asia/Kolkata (IST) timezone
 */

export interface TimeInfo {
  timeFormatted: string; // e.g. "01:25:30 AM IST"
  timeShort: string; // e.g. "01:25:30 AM"
  time24h: string; // e.g. "01:25:30"
  dateFormatted: string; // e.g. "Tuesday, 20 October 2026"
  dateShort: string; // e.g. "Tue, 20 Oct"
  timestamp: number;
  timeZone: string;
}

export function getISTTimeInfo(dateObj: Date = new Date()): TimeInfo {
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const time24Formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dateShortFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const timeShort = timeFormatter.format(dateObj);
  const time24h = time24Formatter.format(dateObj);
  const dateFormatted = dateFormatter.format(dateObj);
  const dateShort = dateShortFormatter.format(dateObj);

  return {
    timeFormatted: `${timeShort} IST`,
    timeShort: timeShort,
    time24h: time24h,
    dateFormatted: dateFormatted,
    dateShort: dateShort,
    timestamp: dateObj.getTime(),
    timeZone: 'Asia/Kolkata (IST)',
  };
}

/**
 * Checks whether user query is asking for current time or date
 */
export function isClockQuery(query: string): boolean {
  const q = query.toLowerCase().trim();
  const patterns = [
    /what('s| is) the time/i,
    /current time/i,
    /what time is it/i,
    /tell me the time/i,
    /what('s| is) today'?s? date/i,
    /what date is it/i,
    /today'?s? date/i,
    /current date/i,
    /what day is (it|today)/i,
    /time in india/i,
    /ist time/i,
    /समय क्या हुआ/i,
    /कितने बजे/i,
    /क्या समय है/i,
    /आज की तारीख/i,
    /आज कौन सा दिन/i,
    /टाइम क्या हुआ/i,
  ];

  return patterns.some((p) => p.test(q));
}

/**
 * Generates instant, 100% accurate system clock answer without asking AI
 */
export function getClockResponse(query: string, language: string): string {
  const info = getISTTimeInfo();
  const q = query.toLowerCase();

  const isDateOnly =
    q.includes('date') ||
    q.includes('day') ||
    q.includes('तारीख') ||
    q.includes('दिन');

  const isHindi = language === 'hi' || /[\u0900-\u097F]/.test(query);

  if (isHindi) {
    if (isDateOnly) {
      return `कमांडर, आज ${info.dateFormatted} है। भारतीय समय ${info.timeFormatted} है।`;
    }
    return `अभी भारतीय मानक समय (IST) ${info.timeFormatted} हुआ है। आज ${info.dateFormatted} है।`;
  }

  if (isDateOnly) {
    return `Commander, today is ${info.dateFormatted}. The current time is ${info.timeFormatted}.`;
  }

  return `The current time is ${info.timeFormatted}. Today is ${info.dateFormatted}.`;
}
