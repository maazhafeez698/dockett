const TZ = "America/Los_Angeles";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

// "YYYY-MM-DD" in Pacific time.
export function quotaDay(at: Date): string {
  return fmt.format(at);
}

// The next instant (to the minute) at which the Pacific calendar day changes.
export function nextQuotaDayStart(at: Date): Date {
  const today = quotaDay(at);
  let t = at.getTime();
  // Coarse: hour steps until the date flips (≤ 25 iterations even across DST)…
  for (let i = 0; i < 26; i++) {
    const next = t + 3_600_000;
    if (quotaDay(new Date(next)) !== today) {
      // …then fine: minute steps inside that hour.
      for (let m = 1; m <= 60; m++) {
        const probe = t + m * 60_000;
        if (quotaDay(new Date(probe)) !== today) return new Date(probe);
      }
      return new Date(next);
    }
    t = next;
  }
  return new Date(at.getTime() + 24 * 3_600_000);
}
