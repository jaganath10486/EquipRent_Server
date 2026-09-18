import zod from "zod";
import { z } from "zod";

export const EquipmentFilterSchema = zod.object({
  skip: zod.number().min(0).optional(),
  limit: zod.number().min(1).optional(),
  isFeatured: zod.boolean().optional(),
  category: zod.string().optional(),
});

export const CompareEquipmentSchema = zod
  .object({
    equipmentId1: zod.string().nonempty("First equipment ID is required"),
    equipmentId2: zod.string().nonempty("Second equipment ID is required"),
  })
  .strict();

export const ParsedSearchFiltersZodSchema = z.object({
  /**
   * The exact `categoryName` from the list supplied in the prompt, or null.
   * This used to be free text: the prompt named only two of the eleven real
   * categories, so the model invented plausible ones ("Event Equipment",
   * "Fitness Equipment") that the regex lookup then failed to match, silently
   * dropping the filter. Grounding the model in the real list is the fix.
   */
  category: z.string().nullable(),
  subCategory: z.string().nullable(),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  keywords: z.array(z.string()),
  sortBy: z.enum(["price_asc", "price_desc", "relevance"]),
});

export type ParsedSearchFilters = z.infer<typeof ParsedSearchFiltersZodSchema>;

export const NaturalSearchRequestSchema = z
  .object({
    query: z.string().min(1, "Query is required"),
  })
  .strict();

/** What the kit builder returns: a bill of materials for an occasion. */
export const KitPlanZodSchema = z.object({
  kitName: z.string(),
  summary: z.string(),
  lines: z
    .array(
      z.object({
        equipmentId: z.string(),
        quantity: z.number().min(1).max(20),
        reason: z.string(),
        essential: z.boolean(),
      })
    )
    .min(1)
    .max(12),
});

export type KitPlan = z.infer<typeof KitPlanZodSchema>;

export const KitRequestSchema = z
  .object({
    brief: z.string().min(3, "Describe the event or shoot"),
    startDate: z.string().datetime({ message: "Not a valid start date" }),
    endDate: z.string().datetime({ message: "Not a valid end date" }),
    budget: z.number().positive().optional(),
  })
  .strict()
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const AvailabilityQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
