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
  category: z.string().nullable(),
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
