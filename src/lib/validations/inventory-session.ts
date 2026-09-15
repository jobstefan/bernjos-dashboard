import { z } from "zod";

const positiveQty = z.coerce
  .number({ message: "Enter a quantity." })
  .int("Whole numbers only.")
  .positive("Must be greater than zero.");

const nonNegativeQty = z.coerce
  .number({ message: "Enter a quantity." })
  .int("Whole numbers only.")
  .min(0, "Can't be negative.");

export const logRestockSchema = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  quantity: positiveQty,
});

export const logWastageSchema = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  quantity: positiveQty,
  reason: z.enum(["expired", "damaged", "given_away", "other"], {
    message: "Pick a wastage reason.",
  }),
  note: z.string().trim().max(300).optional().nullable(),
});

export const closeSessionSchema = z.object({
  sessionId: z.string().min(1),
  counts: z
    .array(z.object({ productId: z.string().min(1), quantity: nonNegativeQty }))
    .min(1, "Enter at least one closing count."),
});

/** One entry queued offline on the kiosk, replayed on reconnect (§6/§9.7). */
export const offlineEntrySchema = z.object({
  clientId: z.string().min(1),
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  type: z.enum(["restock", "wastage"]),
  quantity: positiveQty,
  reason: z.enum(["expired", "damaged", "given_away", "other"]).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
  /** Original client timestamp — preserved so the entry keeps its real time. */
  enteredAt: z.coerce.date(),
});

export const syncOfflineEntriesSchema = z.object({
  entries: z.array(offlineEntrySchema).max(500),
});

export type LogRestockSchema = z.infer<typeof logRestockSchema>;
export type LogWastageSchema = z.infer<typeof logWastageSchema>;
export type CloseSessionSchema = z.infer<typeof closeSessionSchema>;
export type OfflineEntry = z.infer<typeof offlineEntrySchema>;
export type SyncOfflineEntriesSchema = z.infer<typeof syncOfflineEntriesSchema>;
