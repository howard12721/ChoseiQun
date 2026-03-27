export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function buildMonthCells(monthDate: Date) {
  const start = startOfMonth(monthDate);
  const firstDay = start.getDay();
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function buildDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate];
  }

  const [from, to] = start <= end ? [start, end] : [end, start];
  const dates: string[] = [];
  const current = new Date(from);
  while (current <= to) {
    dates.push(isoDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sortDates(dates: string[]) {
  return [...new Set(dates)].sort((left, right) => left.localeCompare(right));
}

export function initialMonthForDates(dates: string[]) {
  const first = sortDates(dates)[0];
  return first ? startOfMonth(new Date(`${first}T00:00:00`)) : startOfMonth(new Date());
}

export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatCandidateSummary(dates?: string[] | null) {
  if (!dates?.length) {
    return "候補日未設定";
  }
  const labels = sortDates(dates).map(formatDateLabel);
  if (labels.length <= 4) {
    return labels.join(", ");
  }
  return `${labels.slice(0, 4).join(", ")} ほか${labels.length - 4}日`;
}

export function formatWindow(dates: string[]) {
  if (!dates.length) {
    return "--";
  }
  const sorted = sortDates(dates);
  if (sorted.length === 1) {
    return formatDateLabel(sorted[0]);
  }
  return `${formatMonthDay(sorted[0])} - ${formatMonthDay(sorted[sorted.length - 1])}`;
}

export function formatMonthDay(date: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatCommentTimestamp(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
