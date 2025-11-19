export function resolveDateIso(input: string | undefined, fmt: string): string {
  const m = (window as any).moment;
  if (!m) {
    const today = new Date();
    if (!input || input.toLowerCase() === "today") {
      return formatDate(today, fmt);
    }
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? formatDate(today, fmt) : formatDate(parsed, fmt);
  }
  if (!input || input.toLowerCase() === "today") return m().format(fmt);
  const tryParse = m(input, ["YYYY-MM-DD", "YYYY/MM/DD", "DD.MM.YYYY"], true);
  return tryParse.isValid() ? tryParse.format(fmt) : m().format(fmt);
}

export function formatDate(date: Date, fmt: string): string {
  if (fmt === "YYYY-MM-DD") {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return date.toISOString().split("T")[0];
}

export function parseDate(dateStr: string, fmt: string): Date {
  if (fmt === "YYYY-MM-DD") {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }
  return new Date(dateStr);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

