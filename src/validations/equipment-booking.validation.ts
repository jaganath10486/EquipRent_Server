import zod from "zod";

export const CreateEquipmentBookingSchema = zod.object({
  items: zod
    .object({
      equipmentId: zod.string(),
      endDate: zod.string().datetime({ message: "Not Valid Date" }),
      startDate: zod
        .string()
        .datetime({ message: "StartDate is not valid date type" }),
      quantity: zod.number("Quantity should be of number type").min(1),
    })
    .array()
    .length(1)
    .nonempty({ message: "Items object cannot be3 empty" }),
});
