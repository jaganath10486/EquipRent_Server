import {
  UserActivity,
  UserActivityReference,
} from "@src/enums/user-activity.enum";
import { z } from "zod";

export const UserActivityValidation = z
  .object({
    sourceId: z.string(),
    userId: z.string(),
    reference: z.enum(UserActivityReference),
    isPositive: z.union([z.literal(0), z.literal(1)]),
    action: z.enum(UserActivity),
  })
  .strict();
