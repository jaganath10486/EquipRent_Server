import { equipmentService } from "./equipment.service";
import { GeminiService } from "./gemini.service";
import { availabilityService, startOfDay, rentalDayCount } from "./availability.service";
import { priceLine, sumLines } from "@utils/pricing.util";
import HttpExceptionError from "@src/exception/httpexception";
import { EquipmentModel } from "@src/models/equipment.model";
import { CategoryPopulate, SubCategoryPopulate } from "@src/queries/equipment.query";
import { EquipmentClass } from "@src/classes/equipment.class";

/**
 * The kit builder.
 *
 * People do not need "a camera", they need to cover a 200-person wedding on the
 * 14th. The booking model has always been an array of items with per-item dates,
 * and the pricing loop already iterated it correctly — the only thing stopping
 * multi-item bookings was a `.length(1)` on the request validator. This turns an
 * occasion into a bill of materials, checks every line against real stock, and
 * prices it with the same function a single booking uses.
 *
 * The split matters: the model chooses what a job needs; it never invents an id,
 * a price or an availability. Those are computed here.
 */
export class KitService {
  private equipmentModel = EquipmentModel();

  public buildKit = async (params: {
    brief: string;
    startDate: string;
    endDate: string;
    budget?: number;
  }) => {
    const from = startOfDay(params.startDate);
    const to = startOfDay(params.endDate);
    const rentalDays = rentalDayCount(from, to);

    const candidates = await equipmentService.getKitCandidates(from, to);
    if (candidates.length === 0) {
      throw new HttpExceptionError(
        409,
        "Nothing in the catalogue is free on those dates."
      );
    }

    const candidateById = new Map(candidates.map((c) => [c.id, c]));

    let plan;
    try {
      plan = await GeminiService.getInstance().generateKitPlan(
        params.brief,
        rentalDays,
        params.budget,
        candidates.map(({ raw, ...rest }) => rest)
      );
    } catch {
      throw new HttpExceptionError(
        503,
        "Could not put a kit together just now. Please try again."
      );
    }

    // Every line the model produced is re-checked against reality. Anything it
    // invented, duplicated, or over-committed is dropped rather than shown.
    const seen = new Set<string>();
    const lines = [];
    const pricedLines = [];

    for (const line of plan.lines) {
      const candidate = candidateById.get(line.equipmentId);
      if (!candidate || seen.has(line.equipmentId)) continue;
      seen.add(line.equipmentId);

      const quantity = Math.min(line.quantity, candidate.available);
      if (quantity < 1) continue;

      const priced = priceLine({
        dailyRent: candidate.raw.prices?.dailyRent ?? 0,
        depositPerUnit: candidate.raw.deposits?.dailyDeposit ?? 0,
        quantity,
        startDate: from,
        endDate: to,
      });
      pricedLines.push(priced);

      lines.push({
        equipmentId: candidate.id,
        name: candidate.name,
        category: candidate.category,
        subCategory: candidate.subCategory,
        imageUrl: candidate.raw.assets?.[0]?.url ?? "",
        quantity,
        requestedQuantity: line.quantity,
        trimmedForStock: line.quantity > quantity,
        available: candidate.available,
        reason: line.reason,
        essential: line.essential,
        dailyRent: priced.dailyRent,
        rentAmount: priced.rentAmount,
        depositAmount: priced.depositAmount,
      });
    }

    if (lines.length === 0) {
      throw new HttpExceptionError(
        409,
        "Could not assemble a kit from what is free on those dates."
      );
    }

    const totals = sumLines(pricedLines);
    const essentialTotal = lines
      .filter((line) => line.essential)
      .reduce((sum, line) => sum + line.rentAmount, 0);

    return {
      kitName: plan.kitName,
      summary: plan.summary,
      startDate: from,
      endDate: to,
      rentalDays,
      lines,
      ...totals,
      budget: params.budget ?? null,
      withinBudget: params.budget ? totals.totalRentalAmount <= params.budget : null,
      essentialTotal,
      /** What to drop first if the budget is tight. */
      optionalTotal: totals.totalRentalAmount - essentialTotal,
    };
  };
}

export const kitService = new KitService();
