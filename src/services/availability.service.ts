import { EquipmentBookingModel } from "@src/models/equipments-booking.model";
import { EquipmentModel } from "@src/models/equipment.model";
import { EquipmentBookingStatus } from "@src/enums/equipment.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { Types } from "mongoose";

/**
 * Bookings in these states are still holding physical stock. Cancelled and
 * returned bookings release it.
 *
 * Availability is derived from this list rather than from a denormalised
 * counter on the equipment document. There used to be an `avilableQuanitity`
 * field that nothing ever decremented and whose misspelling meant the one
 * guard reading it never fired; a counter that can drift is worse than no
 * counter, so stock is now always computed from the bookings themselves.
 */
export const STOCK_HOLDING_STATUSES: EquipmentBookingStatus[] = [
  EquipmentBookingStatus.PENDING,
  EquipmentBookingStatus.CONFIRMED,
  EquipmentBookingStatus.PICKEDUP,
  EquipmentBookingStatus.DELIVERED,
  EquipmentBookingStatus.OVERDUE,
];

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Rentals are priced and reserved per whole day, in UTC. */
export const startOfDay = (value: Date | string): Date => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/** Inclusive of both ends: 1 Oct → 3 Oct is 3 rental days, not 2. */
export const rentalDayCount = (start: Date | string, end: Date | string) =>
  Math.round(
    (startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS
  ) + 1;

export const eachDayKey = (start: Date | string, end: Date | string) => {
  const keys: string[] = [];
  const last = startOfDay(end).getTime();
  for (let t = startOfDay(start).getTime(); t <= last; t += DAY_MS) {
    keys.push(new Date(t).toISOString().slice(0, 10));
  }
  return keys;
};

export interface DayUsage {
  [isoDate: string]: number;
}

export interface AvailabilityWindow {
  equipmentId: string;
  totalQuantity: number;
  /** Days where at least one unit is already committed. */
  usageByDay: DayUsage;
  /** Days where nothing is left — what the calendar greys out. */
  fullyBookedDays: string[];
}

export class AvailabilityService {
  private equipmentBookingModel = EquipmentBookingModel();
  private equipmentModel = EquipmentModel();

  /**
   * Every booked item for this equipment that touches [from, to].
   *
   * Overlap is `existing.start <= requested.end && existing.end >= requested.start`.
   * `excludeBookingId` lets a booking be re-checked without colliding with itself.
   */
  private getOverlappingItems = async (
    equipmentId: string,
    from: Date,
    to: Date,
    excludeBookingId?: string
  ) => {
    const match: Record<string, any> = {
      status: { $in: STOCK_HOLDING_STATUSES },
    };
    if (excludeBookingId && Types.ObjectId.isValid(excludeBookingId)) {
      match["_id"] = { $ne: new Types.ObjectId(excludeBookingId) };
    }

    return this.equipmentBookingModel.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $match: {
          "items.equipmentId": new Types.ObjectId(equipmentId),
          "items.startDate": { $lte: to },
          "items.endDate": { $gte: from },
        },
      },
      {
        $project: {
          _id: 0,
          quantity: "$items.quantity",
          startDate: "$items.startDate",
          endDate: "$items.endDate",
        },
      },
    ]);
  };

  /**
   * Units committed on each day of the window.
   *
   * Summing every overlapping booking would over-count — two bookings on
   * either side of a long window never actually coincide. Stock is counted
   * per day so a request is only refused on days that genuinely clash.
   */
  public getUsageByDay = async (
    equipmentId: string,
    from: Date,
    to: Date,
    excludeBookingId?: string
  ): Promise<DayUsage> => {
    const items = await this.getOverlappingItems(
      equipmentId,
      startOfDay(from),
      startOfDay(to),
      excludeBookingId
    );

    const usage: DayUsage = {};
    for (const item of items) {
      for (const day of eachDayKey(item.startDate, item.endDate)) {
        usage[day] = (usage[day] || 0) + (item.quantity || 0);
      }
    }
    return usage;
  };

  /** Peak concurrent usage across the requested range. */
  private peakUsage = (usage: DayUsage, from: Date, to: Date) =>
    eachDayKey(from, to).reduce(
      (peak, day) => Math.max(peak, usage[day] || 0),
      0
    );

  public getEquipmentStock = async (equipmentId: string) => {
    const equipment = await this.equipmentModel
      .findById(equipmentId)
      .select("name totalQuantity isActive")
      .lean();
    if (!equipment) {
      throw new HttpExceptionError(404, "Equipment not found");
    }
    return {
      name: (equipment as any).name as string,
      isActive: (equipment as any).isActive as boolean,
      // Legacy rows predate totalQuantity being required; one unit is the
      // safe reading of "an owner listed this", never unlimited.
      totalQuantity: Number((equipment as any).totalQuantity) || 1,
    };
  };

  /**
   * How many units are free across the whole requested range.
   * Returns 0 rather than a negative number when already oversubscribed.
   */
  public getAvailableQuantity = async (
    equipmentId: string,
    from: Date,
    to: Date,
    excludeBookingId?: string
  ): Promise<{ available: number; totalQuantity: number }> => {
    const { totalQuantity } = await this.getEquipmentStock(equipmentId);
    const usage = await this.getUsageByDay(
      equipmentId,
      from,
      to,
      excludeBookingId
    );
    const peak = this.peakUsage(usage, from, to);
    return { available: Math.max(0, totalQuantity - peak), totalQuantity };
  };

  /**
   * Throws with a usable message when the request cannot be honoured.
   * This is the single gate every booking path goes through.
   */
  public assertAvailable = async (
    equipmentId: string,
    from: Date,
    to: Date,
    quantity: number,
    excludeBookingId?: string
  ) => {
    const { name, isActive, totalQuantity } = await this.getEquipmentStock(
      equipmentId
    );
    if (!isActive) {
      throw new HttpExceptionError(
        409,
        `${name} is not currently available to rent.`
      );
    }
    if (quantity > totalQuantity) {
      throw new HttpExceptionError(
        409,
        `Only ${totalQuantity} unit${totalQuantity === 1 ? "" : "s"} of ${name} exist${totalQuantity === 1 ? "s" : ""}. You asked for ${quantity}.`
      );
    }

    const usage = await this.getUsageByDay(
      equipmentId,
      from,
      to,
      excludeBookingId
    );
    const peak = this.peakUsage(usage, from, to);
    const available = totalQuantity - peak;

    if (available < quantity) {
      const clashingDays = eachDayKey(from, to).filter(
        (day) => totalQuantity - (usage[day] || 0) < quantity
      );
      throw new HttpExceptionError(
        409,
        available > 0
          ? `Only ${available} of ${totalQuantity} ${name} free on those dates — ${clashingDays[0]} is the first day short.`
          : `${name} is already booked on ${clashingDays[0]}${clashingDays.length > 1 ? ` and ${clashingDays.length - 1} other day${clashingDays.length > 2 ? "s" : ""}` : ""}.`
      );
    }
    return { available, totalQuantity };
  };

  /**
   * Calendar feed: which days the date picker must disable.
   */
  public getAvailabilityWindow = async (
    equipmentId: string,
    from: Date,
    to: Date
  ): Promise<AvailabilityWindow> => {
    const { totalQuantity } = await this.getEquipmentStock(equipmentId);
    const usageByDay = await this.getUsageByDay(equipmentId, from, to);

    const fullyBookedDays = Object.entries(usageByDay)
      .filter(([, used]) => totalQuantity - used < 1)
      .map(([day]) => day)
      .sort();

    return { equipmentId, totalQuantity, usageByDay, fullyBookedDays };
  };

  /** Bulk variant so the kit builder checks a whole basket in one pass. */
  public getAvailableQuantities = async (
    requests: { equipmentId: string; from: Date; to: Date }[]
  ) => {
    const results = await Promise.all(
      requests.map(async (request) => {
        try {
          const { available, totalQuantity } = await this.getAvailableQuantity(
            request.equipmentId,
            request.from,
            request.to
          );
          return { ...request, available, totalQuantity };
        } catch {
          return {
            ...request,
            available: 0,
            totalQuantity: 0,
          };
        }
      })
    );
    return new Map(results.map((r) => [r.equipmentId, r]));
  };

  /** Next window of `days` length that is free, searched forward from `from`. */
  public findNextFreeWindow = async (
    equipmentId: string,
    from: Date,
    days: number,
    horizonDays = 120
  ): Promise<{ startDate: string; endDate: string } | null> => {
    const { totalQuantity } = await this.getEquipmentStock(equipmentId);
    const searchEnd = new Date(startOfDay(from).getTime() + horizonDays * DAY_MS);
    const usage = await this.getUsageByDay(equipmentId, from, searchEnd);

    const allDays = eachDayKey(from, searchEnd);
    let run = 0;
    for (let i = 0; i < allDays.length; i++) {
      const free = totalQuantity - (usage[allDays[i]] || 0) >= 1;
      run = free ? run + 1 : 0;
      if (run === days) {
        return { startDate: allDays[i - days + 1], endDate: allDays[i] };
      }
    }
    return null;
  };
}

export const availabilityService = new AvailabilityService();
