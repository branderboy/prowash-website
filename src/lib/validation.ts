import { z } from "zod";

export const emailSchema = z.string().email().max(254);

export const slugSchema = z
  .string()
  .min(0)
  .max(160)
  .regex(/^[a-z0-9\-/]*$/, "lowercase letters, numbers, slashes, and hyphens only");

export const pageUpdateSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(200),
  meta_description: z.string().max(320).nullable().optional(),
  meta_keywords: z.string().max(320).nullable().optional(),
  og_image_url: z
    .string()
    .max(500)
    .regex(/^(https?:\/\/.+|\/.+)?$/, "must be an absolute URL or a root-relative path")
    .nullable()
    .optional(),
  structured_data: z.string().max(20000).nullable().optional(),
  body_html: z.string().max(500000),
  is_published: z.boolean().optional(),
});

export type PageUpdateInput = z.infer<typeof pageUpdateSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
