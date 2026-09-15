import { z } from "zod";

const qty = z.coerce.number({ message: "Enter a quantity." }).int("Whole numbers only.");

export const requestTransferSchema = z.object({
  sourceBranchId: z.string().min(1, "Pick a source branch."),
  lines: z
    .array(z.object({ productId: z.string().min(1), requestedQty: qty.positive("Must be > 0.") }))
    .min(1, "Add at least one product."),
});

export const prepareTransferSchema = z.object({
  transferId: z.string().min(1),
  lines: z.array(z.object({ lineId: z.string().min(1), preparedQty: qty.min(0, "Can't be negative.") })),
});

export const receiveTransferSchema = z.object({
  transferId: z.string().min(1),
  lines: z.array(z.object({ lineId: z.string().min(1), receivedQty: qty.min(0, "Can't be negative.") })),
});

export const resolveDiscrepancySchema = z.object({
  transferId: z.string().min(1),
  resolution: z.enum(["sender_wastage", "receiver_wastage", "variance_note"], {
    message: "Pick how to record the difference.",
  }),
  note: z.string().trim().max(300).optional().nullable(),
});

export type RequestTransferSchema = z.infer<typeof requestTransferSchema>;
export type PrepareTransferSchema = z.infer<typeof prepareTransferSchema>;
export type ReceiveTransferSchema = z.infer<typeof receiveTransferSchema>;
export type ResolveDiscrepancySchema = z.infer<typeof resolveDiscrepancySchema>;
