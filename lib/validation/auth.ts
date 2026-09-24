import { z } from "zod";
import { checkbox, password } from "./common";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or ID number.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
  remember: checkbox,
  next: z.string().max(500).optional(),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or ID number.").max(254),
});

export const newPasswordSchema = z.object({
  password,
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export const changePasswordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  password,
  confirm: z.string(),
})
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "New password must be different from the current one." });
