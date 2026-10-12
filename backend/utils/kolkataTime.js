const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function toMillis(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Dashboard datetime-local values are Tirur wall-clock times and have no offset.
// A UTC VPS would otherwise store "17:30" as 17:30 UTC and hide the item for 5.5 hours.
function parseKolkataDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      const error = new Error('Invalid date.');
      error.statusCode = 400;
      throw error;
    }
    return value;
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return new Date(`${text}:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) return new Date(`${text}+05:30`);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Invalid date.');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function scheduleIsOpen(start, end, now = new Date()) {
  const nowMs = now.getTime();
  const startMs = toMillis(start);
  const endMs = toMillis(end);
  // Also treat a clock time that was saved on a UTC server as India time.
  const started = startMs == null || startMs <= nowMs + IST_OFFSET_MS;
  const stillOpen = endMs == null || endMs + IST_OFFSET_MS >= nowMs;
  return started && stillOpen;
}

module.exports = { parseKolkataDate, scheduleIsOpen, IST_OFFSET_MS };
