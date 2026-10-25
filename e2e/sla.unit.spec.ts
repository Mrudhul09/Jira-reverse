import { expect, test } from "@playwright/test";
import { workingMs, type SlaCalendar } from "../src/lib/sla";

const H = 3_600_000;
const office: SlaCalendar = {
  id: "c",
  name: "Office",
  always_on: 0,
  days_json: "[1,2,3,4,5]",
  start_minute: 9 * 60,
  end_minute: 17 * 60,
  utc_offset_minutes: 0,
  holidays_json: "[]",
};
const utc = (s: string) => Date.parse(`${s}Z`);

test.describe("SLA-U1 working time", () => {
  test("round the clock counts every hour", () => {
    expect(workingMs(utc("2026-10-24T22:00:00"), utc("2026-10-25T02:00:00"), { ...office, always_on: 1 })).toBe(4 * H);
  });

  test("office hours skip nights and weekends", () => {
    // Friday 16:00 to Monday 10:00 = 1h Friday + 1h Monday.
    expect(workingMs(utc("2026-10-23T16:00:00"), utc("2026-10-26T10:00:00"), office)).toBe(2 * H);
  });

  test("holidays don't count", () => {
    const withHoliday = { ...office, holidays_json: '["2026-10-26"]' };
    expect(workingMs(utc("2026-10-23T16:00:00"), utc("2026-10-27T10:00:00"), withHoliday)).toBe(2 * H);
  });

  test("the calendar's UTC offset moves the working day", () => {
    // Office at UTC+5:30: 09:00 local is 03:30 UTC. 03:00-04:00 UTC on a Monday = 30 working minutes.
    const india = { ...office, utc_offset_minutes: 330 };
    expect(workingMs(utc("2026-10-26T03:00:00"), utc("2026-10-26T04:00:00"), india)).toBe(0.5 * H);
  });

  test("a negative span is zero", () => {
    expect(workingMs(utc("2026-10-26T12:00:00"), utc("2026-10-26T10:00:00"), office)).toBe(0);
  });
});
