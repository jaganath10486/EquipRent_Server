import zod from "zod";
import { EquipmentBookingStatus } from "@src/enums/equipment.enum";

const startOfToday = () => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
};

const BookingItemSchema = zod
  .object({
    equipmentId: zod.string(),
    endDate: zod.string().datetime({ message: "Not Valid Date" }),
    startDate: zod
      .string()
      .datetime({ message: "StartDate is not valid date type" }),
    quantity: zod
      .number("Quantity should be of number type")
      .int("Quantity must be a whole number")
      .min(1)
      // Nothing capped quantity before: a request for 999 units of a
      // single-unit camera was accepted and priced at over a crore. Real stock
      // is still checked per item at booking time; this is only a sanity bound.
      .max(50, "That is more units than anyone lists — check the quantity"),
  })
  .refine((item) => new Date(item.endDate) >= new Date(item.startDate), {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  })
  .refine((item) => new Date(item.startDate) >= startOfToday(), {
    message: "Rentals cannot start in the past",
    path: ["startDate"],
  });

export const CreateEquipmentBookingSchema = zod.object({
  // The `.length(1)` that used to be here blocked multi-item bookings at the
  // API even though the model, the pricing loop and the aggregation all
  // supported them. Lifting it is what makes the kit builder possible.
  items: BookingItemSchema.array()
    .min(1, { message: "At least one item is required" })
    .max(12, { message: "A single booking can hold up to 12 items" }),
});

export const QuoteBookingSchema = zod.object({
  items: BookingItemSchema.array().min(1).max(12),
});

export const UpdateBookingStatusSchema = zod.object({
  status: zod.enum(
    Object.values(EquipmentBookingStatus) as [string, ...string[]]
  ),
  reason: zod.string().max(300).optional(),
});
