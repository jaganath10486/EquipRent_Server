import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "@configs/environment";
import { z } from "zod";
import {
  ParsedSearchFiltersZodSchema,
  ParsedSearchFilters,
  KitPlanZodSchema,
  KitPlan,
} from "@validations/equipment.validation";

export interface TaxonomyEntry {
  categoryName: string;
  subCategories: string[];
}

const AIRecommendationZodSchema = z.object({
  recommendations: z.array(z.object({
    id: z.string(),
    reason: z.string(),
  })).min(1).max(15),
  profileSummary: z.string(),
});

export type AIRecommendationResult = z.infer<typeof AIRecommendationZodSchema>;

const EquipmentSummaryZodSchema = z.object({
  overview: z.string(),
  keyFeatures: z.array(z.string()),
  useCases: z.array(z.string()),
  pricingNote: z.string(),
  idealFor: z.string(),
  quickVerdict: z.string(),
});

export type EquipmentSummaryData = z.infer<typeof EquipmentSummaryZodSchema>;

export class GeminiService {
  private static instance: GeminiService;
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  public generatePersonalizedRecommendations = async (
    userInterestProfile: string,
    candidates: { id: string; name: string; category: string; subCategory: string; price: number; tags: string[] }[]
  ): Promise<AIRecommendationResult> => {
    const jsonSchema = z.toJSONSchema(AIRecommendationZodSchema);
    const response = await this.client.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: this.buildPersonalizedRecommendationPrompt(userInterestProfile, candidates),
      config: { responseMimeType: "application/json", responseSchema: jsonSchema as any },
    });
    const raw = JSON.parse(response.text!);
    const result = AIRecommendationZodSchema.safeParse(raw);
    if (!result.success) throw new Error("Gemini recommendation response invalid");
    return result.data;
  };

  private buildPersonalizedRecommendationPrompt = (
    profile: string,
    candidates: { id: string; name: string; category: string; subCategory: string; price: number; tags: string[] }[]
  ): string =>
    `You are a personalized recommendation engine for EquipRent, a peer-to-peer equipment rental platform in India.

Based on the user's interest history, select the 10–15 most relevant equipment items from the candidates list.
Order them by relevance (best match first).
For each item, write a concise 1-sentence reason (≤15 words) why it matches this user.
Also write a 1-sentence profile summary (≤20 words) describing what the user is looking for.

Only include IDs that exist in the candidates list. Return ONLY valid JSON matching the schema.

USER INTEREST HISTORY:
${profile}

CANDIDATE EQUIPMENT (JSON array):
${JSON.stringify(candidates)}`;

  public generateEquipmentComparisonStream = async (
    equipment1: any,
    equipment2: any
  ) => {
    const prompt = this.buildEquipmentComparisonPrompt(equipment1, equipment2);
    return this.client.models.generateContentStream({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });
  };

  public generateEquipmentSummaryStream = async (equipment: any) => {
    const prompt = this.buildEquipmentSummaryPrompt(equipment);
    return this.client.models.generateContentStream({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });
  };

  public generateStructuredEquipmentSummary = async (
    equipment: any
  ): Promise<EquipmentSummaryData> => {
    const prompt = this.buildStructuredEquipmentSummaryPrompt(equipment);
    const jsonSchema = z.toJSONSchema(EquipmentSummaryZodSchema);

    const response = await this.client.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: jsonSchema as any,
      },
    });

    const raw = JSON.parse(response.text!);
    const result = EquipmentSummaryZodSchema.safeParse(raw);
    if (!result.success) {
      throw new Error("Gemini returned an unexpected response shape");
    }
    return result.data;
  };

  private buildEquipmentComparisonPrompt = (eq1: any, eq2: any): string => {
    const fmt = (eq: any) =>
      `Name: ${eq.name ?? "N/A"}
Category: ${eq.category?.categoryName ?? "N/A"} > ${eq.subCategory?.subCategoryName ?? "N/A"}
Daily Rent: ₹${eq.prices?.dailyRent ?? "N/A"}/day
Daily Deposit: ₹${eq.depoists?.dailyDeposit ?? "N/A"}/day
Description: ${eq.description ?? "N/A"}
Tags: ${Array.isArray(eq.tags) && eq.tags.length ? eq.tags.join(", ") : "None"}`;

    return `You are an equipment rental assistant for EquipRent.
Compare these two rental equipment items and help the customer decide which one to rent.
Be concise (120–150 words), highlight the 2–3 most important differences, and end with a clear recommendation.
Friendly, direct tone. No markdown headers or bullet points.

--- Equipment A ---
${fmt(eq1)}

--- Equipment B ---
${fmt(eq2)}`;
  };

  private buildEquipmentSummaryPrompt = (equipment: any): string => {
    const specs =
      equipment.specifications &&
      Object.keys(equipment.specifications).length > 0
        ? Object.entries(equipment.specifications)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "Not specified";

    const tags =
      Array.isArray(equipment.tags) && equipment.tags.length > 0
        ? equipment.tags.join(", ")
        : "None";

    return `You are an equipment rental assistant for EquipRent.
Provide a concise, helpful summary for a customer looking to rent the equipment below.
Cover: what it is used for, key features/specs, pricing overview, ideal use cases.
Keep it 150–200 words, friendly tone, no markdown headers or bullet points.

--- Equipment Details ---
Name: ${equipment.name ?? "N/A"}
Category: ${equipment.category?.categoryName ?? "N/A"}
Subcategory: ${equipment.subCategory?.subCategoryName ?? "N/A"}
Description: ${equipment.description ?? "Not provided"}
Daily Rent: ₹${equipment.prices?.dailyRent ?? "N/A"}/day
Daily Deposit: ₹${equipment.depoists?.dailyDeposit ?? "N/A"}/day
Tags: ${tags}
Specifications: ${specs}`;
  };

  public parseNaturalSearchQuery = async (
    query: string,
    taxonomy: TaxonomyEntry[]
  ): Promise<ParsedSearchFilters | null> => {
    try {
      const jsonSchema = z.toJSONSchema(ParsedSearchFiltersZodSchema);
      const response = await this.client.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: this.buildNaturalSearchParsePrompt(query, taxonomy),
        config: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema as any,
        },
      });
      const raw = JSON.parse(response.text!);
      const result = ParsedSearchFiltersZodSchema.safeParse(raw);
      if (!result.success) return null;

      // The model is told to copy a name verbatim, but a hallucinated name must
      // never reach the query layer and silently disable the filter. Anything
      // not in the real taxonomy is dropped here.
      const validCategories = new Set(taxonomy.map((t) => t.categoryName));
      const validSubCategories = new Set(
        taxonomy.flatMap((t) => t.subCategories)
      );
      const data = result.data;
      if (data.category && !validCategories.has(data.category)) {
        data.category = null;
      }
      if (data.subCategory && !validSubCategories.has(data.subCategory)) {
        data.subCategory = null;
      }
      return data;
    } catch {
      return null;
    }
  };

  private buildNaturalSearchParsePrompt = (
    query: string,
    taxonomy: TaxonomyEntry[]
  ): string => {
    const catalogue = taxonomy
      .map((entry) => {
        const subs = entry.subCategories.length
          ? `\n    subcategories: ${entry.subCategories.join(", ")}`
          : "";
        return `- ${entry.categoryName}${subs}`;
      })
      .join("\n");

    return `You are a search query parser for an equipment rental platform called EquipRent (India, prices in INR per day).
Parse the user's query into structured search filters.
Return ONLY a valid JSON object matching the provided schema.

These are the ONLY categories that exist. Copy a name EXACTLY as written or use null.
Never invent a category name.

${catalogue}

Guidelines:
- category: the single best match from the list above, copied verbatim. null if genuinely unclear.
- subCategory: a subcategory of the chosen category, copied verbatim, or null.
- priceMin/priceMax: per-day rupee constraints. null if not mentioned.
- keywords: 2-5 SINGLE words naming the item or a concrete feature. Prefer the
  noun a listing would actually contain ("treadmill", "chair", "tent", "stove").
  Never emit multi-word phrases, guest counts, or event names.
- sortBy: "cheapest/under/affordable/budget" -> "price_asc". "best/premium/top" -> "price_desc". Otherwise "relevance".

User query: "${query}"`;
  };

  /**
   * Turns an occasion into a bill of materials.
   *
   * This is the place an LLM genuinely earns its keep: mapping "outdoor wedding,
   * 200 guests, evening" to the gear that job needs is open-ended reasoning that
   * cannot be enumerated as rules. The model only ever picks IDs and quantities
   * from a supplied candidate list — availability and every rupee are computed
   * deterministically afterwards.
   */
  public generateKitPlan = async (
    brief: string,
    rentalDays: number,
    budget: number | undefined,
    candidates: {
      id: string;
      name: string;
      category: string;
      subCategory: string;
      pricePerDay: number;
      available: number;
      tags: string[];
    }[]
  ): Promise<KitPlan> => {
    const jsonSchema = z.toJSONSchema(KitPlanZodSchema);
    const response = await this.client.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `You are a rental kit planner for EquipRent (India, INR).

The customer described what they are doing. Assemble the equipment they need for it.

BRIEF: "${brief}"
RENTAL LENGTH: ${rentalDays} day(s)
${budget ? `BUDGET: Rs ${budget} total for the whole rental period.` : "BUDGET: not stated."}

Rules:
- Choose ONLY from the candidate list. Use the exact id string.
- Never exceed an item's "available" count in your quantity.
- Cover the job properly: think about what a professional would actually need,
  including the supporting items people forget (stands, cables, lighting, power,
  seating, shelter) when the brief implies them.
- Mark essential:true for items the job fails without, false for items that
  improve it. Keep essentials within budget when a budget is given.
- Give each line a specific reason (<=15 words) tied to THIS brief, not generic praise.
- 3 to 10 lines. No duplicate ids.

CANDIDATES (JSON): ${JSON.stringify(candidates)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: jsonSchema as any,
      },
    });

    const raw = JSON.parse(response.text!);
    const result = KitPlanZodSchema.safeParse(raw);
    if (!result.success) throw new Error("Gemini kit plan response invalid");
    return result.data;
  };

  private buildStructuredEquipmentSummaryPrompt = (equipment: any): string => {
    const specs =
      equipment.specifications &&
      Object.keys(equipment.specifications).length > 0
        ? Object.entries(equipment.specifications)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "Not specified";

    const tags =
      Array.isArray(equipment.tags) && equipment.tags.length > 0
        ? equipment.tags.join(", ")
        : "None";

    return `You are an equipment rental assistant for EquipRent.
Analyze the equipment below and return a JSON summary to help a customer decide whether to rent it.
Be concise and specific in each field. Return only a valid JSON object matching the provided schema — no markdown, no extra prose.

--- Equipment Details ---
Name: ${equipment.name ?? "N/A"}
Category: ${equipment.category?.categoryName ?? "N/A"}
Subcategory: ${equipment.subCategory?.subCategoryName ?? "N/A"}
Description: ${equipment.description ?? "Not provided"}
Daily Rent: ₹${equipment.prices?.dailyRent ?? "N/A"}/day
Daily Deposit: ₹${equipment.depoists?.dailyDeposit ?? "N/A"}/day
Tags: ${tags}
Specifications: ${specs}`;
  };
}
