import { Schema, SchemaTypes, model, Document } from "mongoose";
import { Collections } from "@src/enums/collections.enum";

export enum InteractionType {
  VIEW = "view",
  /** Opened the date picker and priced a rental, then left without booking. */
  QUOTE_ABANDONED = "quote_abandoned",
}

/**
 * An append-only interaction log.
 *
 * `useractivity` upserts one row per (user, item, action), so a view is a set
 * membership — you can tell *that* someone looked at an item, never when or how
 * often. That silently capped trending, re-engagement timing, seasonality and
 * every conversion measure, and it is not reconstructable after the fact. This
 * collection records each occurrence instead, and carries the priced-but-
 * abandoned quote, which is the sharpest price-sensitivity signal available:
 * the exact item, the exact dates, and the exact number that was too high.
 */
const ViewEventSchema = new Schema(
  {
    equipmentId: {
      type: SchemaTypes.ObjectId,
      required: true,
      ref: Collections.EQUIPMENT,
    },
    userId: { type: SchemaTypes.ObjectId, required: false, ref: Collections.USER },
    type: {
      type: SchemaTypes.String,
      enum: Object.values(InteractionType),
      default: InteractionType.VIEW,
    },
    /** Present on abandoned quotes only. */
    quotedAmount: { type: SchemaTypes.Number, required: false },
    startDate: { type: SchemaTypes.Date, required: false },
    endDate: { type: SchemaTypes.Date, required: false },
  },
  { timestamps: true }
);

ViewEventSchema.index({ equipmentId: 1, type: 1, createdAt: -1 });
ViewEventSchema.index({ userId: 1, createdAt: -1 });

export const ViewEventModel = () =>
  model<Document>(Collections.VIEWEVENT, ViewEventSchema);

export { ViewEventSchema };
