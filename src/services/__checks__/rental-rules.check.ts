/**
 * Self-check for the rules that decide money and stock.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/services/__checks__/rental-rules.check.ts
 *
 * These are the paths where being wrong is expensive — a deposit that is out by
 * a factor of two, or a day boundary that lets two people hold the same camera.
 * Pure functions only, so it needs no database.
 */
import assert from "assert";
import { rentalDayCount, eachDayKey, startOfDay } from "../availability.service";
import { priceLine, sumLines } from "@utils/pricing.util";
import { EquipmentBookingStatus } from "@src/enums/equipment.enum";
import {
  BookingActor,
  isTransitionAllowed,
  allowedNextStates,
} from "@src/enums/booking-lifecycle.enum";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// --- rental days are inclusive of both ends -------------------------------
assert.strictEqual(rentalDayCount(day("2026-10-01"), day("2026-10-03")), 3);
assert.strictEqual(rentalDayCount(day("2026-10-01"), day("2026-10-01")), 1);
// A mid-day pickup must not round into an extra billable day.
assert.strictEqual(
  rentalDayCount(new Date("2026-10-01T18:30:00Z"), new Date("2026-10-03T06:00:00Z")),
  3
);
// Must survive a DST-shifting local timezone: everything is normalised to UTC.
assert.strictEqual(startOfDay("2026-10-03T23:59:59Z").toISOString(), "2026-10-03T00:00:00.000Z");

// --- day expansion drives both the overlap check and the calendar ---------
assert.deepStrictEqual(eachDayKey(day("2026-10-01"), day("2026-10-03")), [
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
]);

// --- the deposit is one-time, not per day ---------------------------------
// The regression this guards: a 3-day Canon rental at 1500/day with a 5000
// deposit was quoted to the user at 9,500 and written to the database as
// 19,500, because the server multiplied the deposit by the rental days.
const canon = priceLine({
  dailyRent: 1500,
  depositPerUnit: 5000,
  quantity: 1,
  startDate: day("2026-10-01"),
  endDate: day("2026-10-03"),
});
assert.strictEqual(canon.rentAmount, 4500, "rent is per day");
assert.strictEqual(canon.depositAmount, 5000, "deposit must NOT scale with days");
assert.strictEqual(sumLines([canon]).totalAmountPaid, 9500);

// Deposit does scale with units, because each unit carries its own risk.
const twoUnits = priceLine({
  dailyRent: 1500,
  depositPerUnit: 5000,
  quantity: 2,
  startDate: day("2026-10-01"),
  endDate: day("2026-10-02"),
});
assert.strictEqual(twoUnits.rentAmount, 6000);
assert.strictEqual(twoUnits.depositAmount, 10000);

// A missing deposit is zero, never NaN leaking into a total.
const noDeposit = priceLine({
  dailyRent: 900,
  quantity: 1,
  startDate: day("2026-10-01"),
  endDate: day("2026-10-01"),
});
assert.strictEqual(noDeposit.depositAmount, 0);
assert.strictEqual(sumLines([noDeposit]).totalAmountPaid, 900);

// --- lifecycle transitions ------------------------------------------------
assert.ok(
  isTransitionAllowed(
    EquipmentBookingStatus.PENDING,
    EquipmentBookingStatus.CONFIRMED,
    BookingActor.OWNER
  )
);
// A renter cannot confirm their own booking.
assert.ok(
  !isTransitionAllowed(
    EquipmentBookingStatus.PENDING,
    EquipmentBookingStatus.CONFIRMED,
    BookingActor.RENTER
  )
);
// but may cancel it.
assert.ok(
  isTransitionAllowed(
    EquipmentBookingStatus.PENDING,
    EquipmentBookingStatus.CANCELLED,
    BookingActor.RENTER
  )
);
// Returned is terminal — nothing reopens it.
assert.deepStrictEqual(
  allowedNextStates(EquipmentBookingStatus.RETURNED, BookingActor.OWNER),
  []
);
// Only the system flags overdue, never a person.
assert.ok(
  isTransitionAllowed(
    EquipmentBookingStatus.PICKEDUP,
    EquipmentBookingStatus.OVERDUE,
    BookingActor.SYSTEM
  )
);
assert.ok(
  !isTransitionAllowed(
    EquipmentBookingStatus.PICKEDUP,
    EquipmentBookingStatus.OVERDUE,
    BookingActor.OWNER
  )
);
// An overdue item can still be returned.
assert.ok(
  isTransitionAllowed(
    EquipmentBookingStatus.OVERDUE,
    EquipmentBookingStatus.RETURNED,
    BookingActor.OWNER
  )
);

console.log("rental rules: all checks passed");
