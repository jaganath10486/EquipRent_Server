import { EquipmentModel } from "@src/models/equipment.model";
import { EquipmentBookingModel } from "@src/models/equipments-booking.model";
import { SearchQueryModel } from "@src/models/search-query.model";
import { ViewEventModel, InteractionType } from "@src/models/view-event.model";
import { UserActivityModel } from "@src/models/user-activity.model";
import { CategoryModel } from "@src/models/category.model";
import { STOCK_HOLDING_STATUSES, DAY_MS, rentalDayCount } from "./availability.service";
import { EquipmentBookingStatus } from "@src/enums/equipment.enum";
import { UserActivity } from "@src/enums/user-activity.enum";
import { isValidObjectId } from "@validations/data.validation";
import HttpExceptionError from "@src/exception/httpexception";
import { Types } from "mongoose";

/**
 * Below this many comparable data points a benchmark is noise wearing the
 * costume of an insight. Owners act on these numbers with real money, so the
 * API says "not enough data yet" rather than inventing confidence it lacks.
 */
const MIN_PEER_SAMPLE = 3;
const MIN_BOOKINGS_FOR_TREND = 3;

export class InsightsService {
  private equipmentModel = EquipmentModel();
  private equipmentBookingModel = EquipmentBookingModel();
  private searchQueryModel = SearchQueryModel();
  private viewEventModel = ViewEventModel();
  private userActivityModel = UserActivityModel();
  private categoryModel = CategoryModel();

  /**
   * Utilisation, peer pricing and the view-to-booking funnel for one owner.
   *
   * Every number here comes from data the product was already writing and never
   * reading: booking dates give days rented, `prices.dailyRent` across a
   * category gives the peer benchmark, and likes/views give the demand signal
   * that separates "nobody wants this" from "it is priced wrong".
   */
  public getOwnerInsights = async (ownerId: string, windowDays = 30) => {
    if (!isValidObjectId(ownerId)) {
      throw new HttpExceptionError(400, "Invalid owner Id");
    }
    const since = new Date(Date.now() - windowDays * DAY_MS);
    const owned = await this.equipmentModel
      .find({ userId: new Types.ObjectId(ownerId) })
      .populate([{ path: "categoryId", select: "categoryName" }])
      .lean();

    if (owned.length === 0) {
      return {
        windowDays,
        items: [],
        totals: { earned: 0, daysRented: 0, activeListings: 0 },
        notes: ["You have not listed any equipment yet."],
      };
    }

    const ownedIds = owned.map((item: any) => item._id);

    const bookedLines = await this.equipmentBookingModel.aggregate([
      {
        $match: {
          status: { $in: [...STOCK_HOLDING_STATUSES, EquipmentBookingStatus.RETURNED] },
          createdAt: { $gte: since },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.equipmentId": { $in: ownedIds } } },
      {
        $group: {
          _id: "$items.equipmentId",
          bookings: { $sum: 1 },
          quantity: { $sum: "$items.quantity" },
          lines: {
            $push: {
              startDate: "$items.startDate",
              endDate: "$items.endDate",
              dailyRent: "$items.dailyRent",
              quantity: "$items.quantity",
            },
          },
        },
      },
    ]);
    const bookedById = new Map(bookedLines.map((row: any) => [String(row._id), row]));

    const [views, likes] = await Promise.all([
      this.viewEventModel.aggregate([
        {
          $match: {
            equipmentId: { $in: ownedIds },
            type: InteractionType.VIEW,
            createdAt: { $gte: since },
          },
        },
        { $group: { _id: "$equipmentId", count: { $sum: 1 } } },
      ]),
      this.userActivityModel.aggregate([
        {
          $match: {
            sourceId: { $in: ownedIds },
            action: UserActivity.LIKE,
            isPositive: 1,
          },
        },
        { $group: { _id: "$sourceId", count: { $sum: 1 } } },
      ]),
    ]);
    const viewsById = new Map(views.map((v: any) => [String(v._id), v.count]));
    const likesById = new Map(likes.map((l: any) => [String(l._id), l.count]));

    // Peer benchmark: everything else in the same category, excluding this owner.
    const categoryIds = [...new Set(owned.map((i: any) => String(i.categoryId?._id ?? i.categoryId)))];
    const peers = await this.equipmentModel
      .find({
        categoryId: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
        userId: { $ne: new Types.ObjectId(ownerId) },
        isActive: true,
      })
      .select("categoryId prices")
      .lean();

    const peerPrices = new Map<string, number[]>();
    for (const peer of peers) {
      const key = String((peer as any).categoryId);
      const price = (peer as any).prices?.dailyRent;
      if (!price) continue;
      peerPrices.set(key, [...(peerPrices.get(key) || []), price]);
    }

    const items = owned.map((item: any) => {
      const id = String(item._id);
      const booked: any = bookedById.get(id);
      const totalQuantity = item.totalQuantity ?? 1;

      const daysRented = (booked?.lines || []).reduce(
        (sum: number, line: any) =>
          sum + rentalDayCount(line.startDate, line.endDate) * (line.quantity || 1),
        0
      );
      const earned = (booked?.lines || []).reduce(
        (sum: number, line: any) =>
          sum +
          rentalDayCount(line.startDate, line.endDate) *
            (line.quantity || 1) *
            (line.dailyRent || 0),
        0
      );

      const capacityDays = windowDays * totalQuantity;
      const utilisation = capacityDays > 0 ? daysRented / capacityDays : 0;

      const viewCount = viewsById.get(id) ?? 0;
      const likeCount = likesById.get(id) ?? 0;
      const bookingCount = booked?.bookings ?? 0;

      const categoryKey = String(item.categoryId?._id ?? item.categoryId);
      const sample = peerPrices.get(categoryKey) || [];
      const myPrice = item.prices?.dailyRent ?? 0;

      let pricing: Record<string, any> = {
        yourPrice: myPrice,
        peerSample: sample.length,
        enoughData: sample.length >= MIN_PEER_SAMPLE,
      };
      if (sample.length >= MIN_PEER_SAMPLE) {
        const sorted = [...sample].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const gap = median > 0 ? (myPrice - median) / median : 0;
        pricing = {
          ...pricing,
          categoryMedian: median,
          gapPercent: Math.round(gap * 100),
          verdict:
            Math.abs(gap) < 0.15
              ? "in line with similar items"
              : gap > 0
                ? "above the category median"
                : "below the category median",
        };
      }

      // The diagnosis owners actually want: is the problem demand, or is it me?
      let diagnosis: string | null = null;
      if (viewCount >= 10 && bookingCount === 0) {
        diagnosis =
          "People are finding it but not booking — that pattern is usually price or photos, not demand.";
      } else if (viewCount < 3 && bookingCount === 0) {
        diagnosis =
          "Almost nobody is seeing it. Tags and the category it sits in matter more here than price.";
      } else if (utilisation > 0.6) {
        diagnosis =
          "Rented most of the time. Room to raise the rate, or to list a second unit.";
      }

      return {
        equipmentId: id,
        name: item.name,
        category: item.categoryId?.categoryName ?? "",
        totalQuantity,
        daysRented,
        capacityDays,
        utilisationPercent: Math.round(utilisation * 100),
        earned,
        bookingCount,
        viewCount,
        likeCount,
        conversionPercent: viewCount > 0 ? Math.round((bookingCount / viewCount) * 100) : null,
        pricing,
        diagnosis,
      };
    });

    const notes: string[] = [];
    if (items.every((i) => i.viewCount === 0)) {
      notes.push(
        "No view data yet — view tracking starts collecting from now, so these numbers fill in over the coming weeks."
      );
    }
    if (items.every((i) => !i.pricing.enoughData)) {
      notes.push(
        `Price benchmarking needs at least ${MIN_PEER_SAMPLE} comparable listings in a category before it will show a median.`
      );
    }

    return {
      windowDays,
      items: items.sort((a, b) => b.earned - a.earned),
      totals: {
        earned: items.reduce((sum, i) => sum + i.earned, 0),
        daysRented: items.reduce((sum, i) => sum + i.daysRented, 0),
        activeListings: owned.filter((i: any) => i.isActive).length,
      },
      notes,
    };
  };

  /**
   * What people asked for and did not find.
   *
   * Zero-result searches are the sharpest supply signal a marketplace gets: a
   * person describing, unprompted, something the catalogue cannot sell them.
   * These were computed on every request and discarded until now.
   */
  public getDemandRadar = async (windowDays = 30, limit = 20) => {
    const since = new Date(Date.now() - windowDays * DAY_MS);

    const [unmet, topCategories, totals] = await Promise.all([
      this.searchQueryModel.aggregate([
        { $match: { createdAt: { $gte: since }, resultCount: 0 } },
        { $unwind: "$keywords" },
        {
          $group: {
            _id: { $toLower: "$keywords" },
            searches: { $sum: 1 },
            examples: { $addToSet: "$query" },
            category: { $first: "$parsedCategory" },
          },
        },
        { $sort: { searches: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            keyword: "$_id",
            searches: 1,
            category: 1,
            examples: { $slice: ["$examples", 3] },
          },
        },
      ]),
      this.searchQueryModel.aggregate([
        { $match: { createdAt: { $gte: since }, parsedCategory: { $ne: null } } },
        {
          $group: {
            _id: "$parsedCategory",
            searches: { $sum: 1 },
            emptyResults: { $sum: { $cond: [{ $eq: ["$resultCount", 0] }, 1, 0] } },
          },
        },
        { $sort: { searches: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, category: "$_id", searches: 1, emptyResults: 1 } },
      ]),
      this.searchQueryModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            empty: { $sum: { $cond: [{ $eq: ["$resultCount", 0] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const summary = totals[0] ?? { total: 0, empty: 0 };
    return {
      windowDays,
      totalSearches: summary.total,
      emptySearches: summary.empty,
      emptyRatePercent:
        summary.total > 0 ? Math.round((summary.empty / summary.total) * 100) : 0,
      unmetDemand: unmet,
      byCategory: topCategories,
      note:
        summary.total < 20
          ? "Search volume is still low, so treat these as anecdotes rather than trends."
          : null,
    };
  };

  /**
   * Rent-versus-buy, computed from the user's own rental history.
   *
   * It looks like advice against the platform's interest, and is not: the
   * heaviest renters are the people best placed to become owners, and this is
   * the only mechanism in the product that turns demand into supply.
   */
  public getRentVsBuy = async (userId: string) => {
    if (!isValidObjectId(userId)) {
      throw new HttpExceptionError(400, "Invalid user Id");
    }

    const rows = await this.equipmentBookingModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: { $ne: EquipmentBookingStatus.CANCELLED },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "equipments",
          localField: "items.equipmentId",
          foreignField: "_id",
          as: "equipment",
        },
      },
      { $addFields: { equipment: { $arrayElemAt: ["$equipment", 0] } } },
      {
        $group: {
          _id: "$equipment.subCategoryId",
          rentals: { $sum: 1 },
          names: { $addToSet: "$items.name" },
          lines: {
            $push: {
              startDate: "$items.startDate",
              endDate: "$items.endDate",
              dailyRent: "$items.dailyRent",
              quantity: "$items.quantity",
            },
          },
        },
      },
      { $sort: { rentals: -1 } },
    ]);

    const suggestions = [];
    for (const row of rows) {
      if (row.rentals < MIN_BOOKINGS_FOR_TREND) continue;

      const spent = row.lines.reduce(
        (sum: number, line: any) =>
          sum +
          rentalDayCount(line.startDate, line.endDate) *
            (line.quantity || 1) *
            (line.dailyRent || 0),
        0
      );
      const daysRented = row.lines.reduce(
        (sum: number, line: any) => sum + rentalDayCount(line.startDate, line.endDate),
        0
      );
      const avgDailyRent = daysRented > 0 ? Math.round(spent / daysRented) : 0;

      // No purchase-price data exists in the product, so this is explicitly an
      // estimate and is labelled as one rather than dressed up as a fact.
      const estimatedPurchasePrice = avgDailyRent * 30;
      const rentalsToBreakEven =
        spent >= estimatedPurchasePrice
          ? 0
          : Math.ceil((estimatedPurchasePrice - spent) / (spent / row.rentals));

      suggestions.push({
        subCategoryId: String(row._id ?? ""),
        examples: row.names.slice(0, 3),
        rentals: row.rentals,
        daysRented,
        totalSpent: spent,
        avgDailyRent,
        estimatedPurchasePrice,
        isEstimate: true,
        rentalsToBreakEven,
        verdict:
          spent >= estimatedPurchasePrice
            ? "You have already spent more renting this than a comparable unit would cost to buy."
            : `About ${rentalsToBreakEven} more rental${rentalsToBreakEven === 1 ? "" : "s"} before buying would have been cheaper.`,
        listingHint:
          "If you do buy one, you can list it here between your own uses.",
      });
    }

    return {
      suggestions,
      note:
        suggestions.length === 0
          ? `Rent-versus-buy needs at least ${MIN_BOOKINGS_FOR_TREND} rentals of the same kind of equipment before the maths means anything.`
          : "Purchase prices are estimated from rental rates, not retail data — treat them as a starting point.",
    };
  };
}

export const insightsService = new InsightsService();
