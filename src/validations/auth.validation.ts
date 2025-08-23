import { z } from "zod";

export const EmailLoginSchema = z
  .object({
    emailId: z.email({ message: "Not valid email Id" }),
    password: z.string({ message: "Not valid string type" }),
  })
  .strict();

export const EmailRegisterSchema = z
  .object({
    emailId: z.email({}).nonempty(),
    password: z.string().nonempty(),
    fullName: z.string().nonempty(),
  })
  .strict();
