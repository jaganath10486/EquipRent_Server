import zod from "zod";

export const EquipmentFilterSchema = zod.object({
  skip: zod.number().min(0).optional(),
  limit: zod.number().min(1).optional(),
  isFeatured: zod.boolean().optional(),
});
