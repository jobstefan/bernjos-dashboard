import { z } from "zod";

// ── Product categories (reference data) ─────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(80),
});

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().min(1),
});

// ── Products (global catalog) ───────────────────────────────────────────────

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Product name is required.").max(120),
    unit: z.string().trim().min(1, "Unit is required (e.g. pc, loaf, bottle).").max(20),
    type: z.enum(["sale", "production"], { message: "Choose sale or production." }),
    categoryId: z.string().min(1, "Pick a category."),
    /**
     * Selling price. Required and positive for sale items; must be omitted/null
     * for production items, which are never sold (§5.3).
     */
    price: z.coerce
      .number({ message: "Enter a valid price." })
      .positive("Price must be greater than zero.")
      .optional()
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "sale" && (v.price === null || v.price === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Sale items need a selling price.",
      });
    }
    if (v.type === "production" && v.price != null) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Production items can't have a selling price.",
      });
    }
  });

export const updateProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Product name is required.").max(120),
    unit: z.string().trim().min(1, "Unit is required.").max(20),
    type: z.enum(["sale", "production"]),
    categoryId: z.string().min(1, "Pick a category."),
    price: z.coerce.number().positive("Price must be greater than zero.").optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "sale" && (v.price === null || v.price === undefined)) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Sale items need a selling price." });
    }
    if (v.type === "production" && v.price != null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Production items can't have a selling price." });
    }
  });

// ── Per-branch reorder thresholds ───────────────────────────────────────────

export const upsertThresholdSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  reorderThreshold: z.coerce
    .number({ message: "Enter a whole number." })
    .int("Must be a whole number.")
    .min(0, "Can't be negative."),
});

export type CreateCategorySchema = z.infer<typeof createCategorySchema>;
export type UpdateCategorySchema = z.infer<typeof updateCategorySchema>;
export type CreateProductSchema = z.infer<typeof createProductSchema>;
export type UpdateProductSchema = z.infer<typeof updateProductSchema>;
export type UpsertThresholdSchema = z.infer<typeof upsertThresholdSchema>;
