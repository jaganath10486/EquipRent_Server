import { z } from "zod";

export const CreateSubCategoryValidation = z
  .object({
    categoryId: z.string().nonempty(),
    subCategoryName: z.string().nonempty(),
    isActive: z.boolean(),
  })
  .strict();
