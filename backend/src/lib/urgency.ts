export type Urgency = "critical" | "soon" | "later";

const DAY_MS = 86_400_000;

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

export function closingUrgency(
  closingAt: Date | null,
  now = new Date(),
): Urgency | null {
  if (
    !closingAt ||
    !isValidDate(closingAt) ||
    !isValidDate(now) ||
    closingAt <= now
  ) {
    return null;
  }

  const days = (closingAt.getTime() - now.getTime()) / DAY_MS;

  if (days <= 3) {
    return "critical";
  }

  if (days <= 14) {
    return "soon";
  }

  return "later";
}

export function daysUntil(date: Date | null, now = new Date()): number | null {
  if (!date || !isValidDate(date) || !isValidDate(now)) {
    return null;
  }

  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

export function dayKey(date: Date): string {
  if (!isValidDate(date)) {
    throw new RangeError("Cannot create a day key from an invalid date");
  }

  return date.toISOString().slice(0, 10);
}
