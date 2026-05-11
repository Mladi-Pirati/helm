const slovenianDateFormatter = new Intl.DateTimeFormat("sl-SI", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const slovenianDateTimeFormatter = new Intl.DateTimeFormat("sl-SI", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    throw new Error("Invalid date-only value.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid date-only value.");
  }

  return date;
}

export function formatSlovenianDate(value: Date): string {
  return slovenianDateFormatter.format(value);
}

export function formatSlovenianDateTime(value: Date): string {
  return slovenianDateTimeFormatter.format(value);
}
