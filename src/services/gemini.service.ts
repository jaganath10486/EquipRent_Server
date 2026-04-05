import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "@configs/environment";
import { z } from "zod";
import {
  ParsedSearchFiltersZodSchema,
  ParsedSearchFilters,
} from "@validations/equipment.validation";

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
    query: string
  ): Promise<ParsedSearchFilters | null> => {
    try {
      const jsonSchema = z.toJSONSchema(ParsedSearchFiltersZodSchema);
      const response = await this.client.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: this.buildNaturalSearchParsePrompt(query),
        config: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema as any,
        },
      });
      const raw = JSON.parse(response.text!);
      const result = ParsedSearchFiltersZodSchema.safeParse(raw);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  };

  private buildNaturalSearchParsePrompt = (query: string): string =>
    `You are a search query parser for an equipment rental platform called EquipRent.
Parse the user's natural language query into structured search filters.
Return ONLY a valid JSON object matching the provided schema — no markdown, no extra text.

Guidelines:
- category: extract if user mentions a type (e.g. "camera/DSLR" → "Photography & Videography", "mic/speaker/PA" → "Audio / AV Equipment"). Set null if unclear.
- priceMin/priceMax: extract price constraints in Indian Rupees per day. Set null if not mentioned.
- keywords: extract 2–5 specific terms (equipment names, features, use-case adjectives). Exclude filler words.
- sortBy: "cheapest/under/affordable/budget" → "price_asc". "best/premium/top-rated" → "price_desc". Otherwise → "relevance".

User query: "${query}"`;

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
