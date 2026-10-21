import { getLanguage, translateCopy } from './i18n';
type DateStyle = 'date' | 'time' | 'timeSeconds' | 'timestamp';
const options: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { year: 'numeric', month: 'numeric', day: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
  timeSeconds: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
  timestamp: {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
};
const formatters = new Map<string, Intl.DateTimeFormat>();

// Reuse locale formatters across rows and live updates instead of constructing one per cell.
export function formatDateTime(value: string | number, style: DateStyle = 'timestamp') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translateCopy('Unknown time');
  const language = getLanguage();
  const key = `${language}:${style}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language === 'ja' ? 'ja-JP' : 'en-US', options[style]);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
}
