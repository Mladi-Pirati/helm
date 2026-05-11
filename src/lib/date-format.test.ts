import { describe, expect, test } from "bun:test";

import {
  formatSlovenianDate,
  formatSlovenianDateTime,
  parseDateOnly,
} from "./date-format";

describe("Slovenian date formatting", () => {
  test("formats date-only values as d. m. YYYY", () => {
    expect(formatSlovenianDate(parseDateOnly("1994-12-10"))).toBe(
      "10. 12. 1994",
    );
  });

  test("formats timestamps as d. m. YYYY, HH:mm", () => {
    const timestamp = new Date(2026, 1, 9, 15, 5);

    expect(formatSlovenianDateTime(timestamp)).toBe("9. 2. 2026, 15:05");
  });

  test("rejects invalid date-only strings", () => {
    expect(() => parseDateOnly("1994-13-10")).toThrow(
      "Invalid date-only value.",
    );
    expect(() => parseDateOnly("1994-12-32")).toThrow(
      "Invalid date-only value.",
    );
    expect(() => parseDateOnly("1994-12-10T00:00:00")).toThrow(
      "Invalid date-only value.",
    );
  });
});
