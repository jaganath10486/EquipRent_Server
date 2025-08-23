import zod from "zod";
export const RefreshTokenSchema = zod
  .object({
    refreshToken: zod.string(),
  })
  .strict();
