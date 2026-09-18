import { Schema, SchemaTypes, model, Document } from "mongoose";
import { Collections } from "@src/enums/collections.enum";

/**
 * Every natural-language search, kept.
 *
 * These were previously parsed by Gemini and thrown away, which made them the
 * most valuable discarded data in the system: a search is a person stating what
 * they want in their own words, and a search that returns nothing is a precise
 * statement of demand the catalogue cannot meet. Retained, they drive the demand
 * radar and tell owners what is worth listing.
 */
const SearchQuerySchema = new Schema(
  {
    query: { type: SchemaTypes.String, required: true },
    userId: { type: SchemaTypes.ObjectId, required: false, ref: Collections.USER },
    parsedCategory: { type: SchemaTypes.String, required: false },
    matchedCategoryId: {
      type: SchemaTypes.ObjectId,
      required: false,
      ref: Collections.CATGORY,
    },
    keywords: { type: [SchemaTypes.String], default: [] },
    priceMin: { type: SchemaTypes.Number, required: false },
    priceMax: { type: SchemaTypes.Number, required: false },
    resultCount: { type: SchemaTypes.Number, required: true, default: 0 },
    /** True when the parser produced nothing usable and we fell back to text search. */
    usedFallback: { type: SchemaTypes.Boolean, default: false },
  },
  { timestamps: true }
);

SearchQuerySchema.index({ createdAt: -1 });
SearchQuerySchema.index({ resultCount: 1, createdAt: -1 });

export const SearchQueryModel = () =>
  model<Document>(Collections.SEARCHQUERY, SearchQuerySchema);

export { SearchQuerySchema };
