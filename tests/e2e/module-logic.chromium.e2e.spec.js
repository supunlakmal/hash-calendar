const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("urlPathEventParser handles documented patterns and fallback title", async ({ page }) => {
  const entries = await page.evaluate(async () => {
    const { parsePathToEventEntries } = await import("/modules/urlPathEventParser.js");
    return parsePathToEventEntries("/2025/12/25/10/00+90/Family-Brunch,2025/12/25/Christmas-Day,2025/12/25")
      .map((entry) => ({
        startMin: entry[0],
        duration: entry[1],
        title: entry[2],
        colorIndex: entry[3],
      }));
  });

  expect(entries).toHaveLength(3);
  expect(entries[0].duration).toBe(90);
  expect(entries[0].title).toBe("Family Brunch");
  expect(entries[0].colorIndex).toBe(0);
  expect(entries[1].duration).toBe(0);
  expect(entries[1].title).toBe("Christmas Day");
  expect(entries[2].title).toBe("New Event (URL)");
});

test("icsImporter maps RRULE frequency values to internal recurrence rules", async ({ page }) => {
  const rules = await page.evaluate(async () => {
    const { parseIcs } = await import("/modules/icsImporter.js");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:Daily Event",
      "DTSTART;VALUE=DATE:20260101",
      "RRULE:FREQ=DAILY",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Weekly Event",
      "DTSTART;VALUE=DATE:20260102",
      "RRULE:FREQ=WEEKLY",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Monthly Event",
      "DTSTART;VALUE=DATE:20260103",
      "RRULE:FREQ=MONTHLY",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Yearly Event",
      "DTSTART;VALUE=DATE:20260104",
      "RRULE:FREQ=YEARLY",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Unsupported Event",
      "DTSTART;VALUE=DATE:20260105",
      "RRULE:FREQ=HOURLY",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\n");

    return parseIcs(ics).map((event) => event.rule || "");
  });

  expect(rules).toEqual(["d", "w", "m", "y", ""]);
});

test("recurrenceEngine expands month-end and leap-day recurrences to valid dates", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { expandEvents } = await import("/modules/recurrenceEngine.js");
    const toMin = (iso) => Math.floor(new Date(iso).getTime() / 60000);

    const monthEdgeEvents = [[toMin("2025-01-31T00:00:00Z"), 0, "MonthEdge", 0, "m"]];
    const leapEdgeEvents = [[toMin("2024-02-29T00:00:00Z"), 0, "LeapEdge", 0, "y"]];

    const monthOccurrences = expandEvents(
      monthEdgeEvents,
      new Date("2025-02-01T00:00:00Z"),
      new Date("2025-02-28T23:59:59Z"),
    );
    const leapOccurrences = expandEvents(
      leapEdgeEvents,
      new Date("2025-02-01T00:00:00Z"),
      new Date("2025-02-28T23:59:59Z"),
    );

    return {
      monthStartIso: monthOccurrences[0] ? new Date(monthOccurrences[0].start).toISOString() : null,
      leapStartIso: leapOccurrences[0] ? new Date(leapOccurrences[0].start).toISOString() : null,
    };
  });

  expect(result.monthStartIso).toContain("2025-02-28T00:00:00.000Z");
  expect(result.leapStartIso).toContain("2025-02-28T00:00:00.000Z");
});
