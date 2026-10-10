const TIMELINE_DAYS = 14;

function getDayKey(date: Date, formatter: Intl.DateTimeFormat): string {
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) throw new Error("Could not format analytics date");
  return `${year}-${month}-${day}`;
}

export function buildResponseTimeline(
  submissions: { createdAt: Date | null }[],
  timeZone: string,
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = getDayKey(now, formatter);
  const firstDay = new Date(`${today}T00:00:00.000Z`);
  firstDay.setUTCDate(firstDay.getUTCDate() - (TIMELINE_DAYS - 1));

  const timelineMap = new Map<string, number>();
  for (let i = 0; i < TIMELINE_DAYS; i++) {
    const date = new Date(firstDay);
    date.setUTCDate(date.getUTCDate() + i);
    timelineMap.set(date.toISOString().slice(0, 10), 0);
  }

  for (const submission of submissions) {
    if (!submission.createdAt) continue;
    const key = getDayKey(submission.createdAt, formatter);
    if (timelineMap.has(key)) timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1);
  }

  return Array.from(timelineMap, ([date, count]) => ({ date, count }));
}
