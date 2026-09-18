import HttpExceptionError from "@src/exception/httpexception";
import { GeminiService } from "./gemini.service";
import { EquipmentInterface } from "@interfaces/equipment.interface";
import { EquipmentModel } from "@src/models/equipment.model";
import { CategoryModel } from "@src/models/category.model";
import { ParsedSearchFilters } from "@validations/equipment.validation";
import { isEmpty } from "@utils/data.util";
import { isValidObjectId } from "@validations/data.validation";
import { userPopulateQuery } from "@src/queries/common.query";
import { ObjectId } from "mongodb";
import {
  CategoryPopulate,
  SubCategoryPopulate,
} from "@src/queries/equipment.query";
import { EquipmentClass } from "@src/classes/equipment.class";
import { CategoryService } from "./category.service";
import { SubCategoryService } from "./sub-category.service";
import { Types } from "mongoose";
import { CacheService } from "./cache.service";
import { RedisKeys } from "@src/enums/redis.enum";
import { REDIS_TTL } from "@configs/environment";
import { UserActivityService } from "./user-activity.service";
import {
  UserActivity,
  UserActivityReference,
} from "@src/enums/user-activity.enum";
import { UserActivityModel } from "@src/models/user-activity.model";
import { EquipmentBookingModel } from "@src/models/equipments-booking.model";
import { SubCategoryModel } from "@src/models/sub-category.model";
import { SearchQueryModel } from "@src/models/search-query.model";
import { availabilityService } from "./availability.service";
import { TaxonomyEntry } from "./gemini.service";

class EquipmentService {
  private equipmentModel = EquipmentModel();
  private categoryModel = CategoryModel();
  private categoryService = new CategoryService();
  private subCategoryService = new SubCategoryService();
  private cacheService = new CacheService();
  private userActivityService = new UserActivityService();
  private userActivityModel = UserActivityModel();
  private equipmentBookingModel = EquipmentBookingModel();
  private subCategoryModel = SubCategoryModel();
  private searchQueryModel = SearchQueryModel();

  public getEquipments = async (filters: any) => {
    const data = await this.equipmentModel
      .find({ ...filters })
      .populate([
        ...userPopulateQuery,
        ...CategoryPopulate,
        ...SubCategoryPopulate,
      ])
      .lean()
      .exec();
    const transformedResponse = data.map((item) => new EquipmentClass(item));
    return transformedResponse;
  };

  public getEquipmentById = async (id: string, userId: string) => {
    if (isEmpty(id) || !isValidObjectId(id)) {
      throw new HttpExceptionError(400, "Not valid Id");
    }
    const cachedData = this.cacheService.getJson(
      RedisKeys.EquipmentDetails,
      id
    );
    if (!isEmpty(cachedData)) {
      return cachedData;
    }
    let data: any = await this.equipmentModel
      .findById(new ObjectId(id))
      .populate([
        ...userPopulateQuery,
        ...CategoryPopulate,
        ...SubCategoryPopulate,
      ])
      .lean();
    if (!data) {
      throw new HttpExceptionError(204, "No Equipment Found");
    }
    data = [data];
    const sourceIds = data.map((item: any) => item._id);
    let activityMap: Record<string, Record<string, boolean>> = {};
    if (userId) {
      const userActivities =
        await this.userActivityService.getUserActivityBySource(
          new Types.ObjectId(userId),
          sourceIds,
          UserActivityReference.EQUIPMENT,
          [UserActivity.LIKE]
        );
      activityMap = userActivities.reduce((acc, curr) => {
        if (!acc[curr.sourceId]) acc[curr.sourceId] = {};
        acc[curr.sourceId][curr.action] = true;
        return acc;
      }, {} as Record<string, Record<string, boolean>>);
    }
    const finalResult: any[] = data.map((content: any) => ({
      ...content,
      isLiked: activityMap[content._id]?.like || false,
    }));
    const equipmentData = new EquipmentClass(finalResult[0]);
    return equipmentData;
  };

  public createEquipment = async (data: EquipmentInterface) => {
    if (isEmpty(data)) {
      throw new HttpExceptionError(400, "Data required to create an equipment");
    }
    const categoryExists = await this.categoryService.isCategoryExistsById(
      String(data?.categoryId || "")
    );
    if (!categoryExists) {
      throw new HttpExceptionError(
        400,
        "No category Found with given catgeory Id"
      );
    }
    const subCategoryExists =
      await this.subCategoryService.isSubCategoryExistsById(
        String(data?.subCategoryId || "")
      );
    if (!subCategoryExists) {
      throw new HttpExceptionError(
        400,
        "No Sub category Found with given catgeory Id"
      );
    }
    const equipData = await this.equipmentModel.create({
      ...data,
      categoryId: new Types.ObjectId(data.categoryId),
      subCategoryId: new Types.ObjectId(data.subCategoryId),
    });
    return equipData;
  };

  public updateEquipmentById = async (id: string, data: EquipmentInterface) => {
    if (isEmpty(data) || isEmpty(id))
      throw new HttpExceptionError(
        400,
        "Data required to perform update operation"
      );
    const equipData = await this.equipmentModel
      .findByIdAndUpdate(id, data, {
        new: true,
      })
      .populate([
        ...userPopulateQuery,
        ...CategoryPopulate,
        ...SubCategoryPopulate,
      ])
      .lean()
      .exec();
    const transformedEquipData = new EquipmentClass(equipData);
    this.cacheService.delete(RedisKeys.EquipmentDetails, id);
    return transformedEquipData;
  };

  public filterEquipments = async (payload: any) => {
    let limit = payload.limit || 10;
    let skip = payload.skip || 0;
    let filters: Record<string, any> = {};
    if (payload && Object.values(payload).length > 0) {
      if (payload.isFeatured != undefined) {
        filters["isFeatured"] = payload.isFeatured;
      }
      if (payload.category != undefined) {
        filters["categoryId"] = payload.category;
      }
      if (
        payload.subCategories != undefined &&
        payload.subCategories &&
        payload.subCategories.length > 0
      ) {
        filters["subCategoryId"] = { $in: [...payload.subCategories] };
      }
    }
    const data = await this.equipmentModel
      .find({ ...filters })
      .populate([
        ...userPopulateQuery,
        ...CategoryPopulate,
        ...SubCategoryPopulate,
      ])
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    const transformedResponse = data.map((item) => new EquipmentClass(item));
    return transformedResponse;
  };

  /**
   * The real category tree, handed to the parser so it stops guessing names.
   * Cached because it changes about once a quarter.
   */
  public getTaxonomy = async (): Promise<TaxonomyEntry[]> => {
    const cached = await this.cacheService.getJson(RedisKeys.Taxonomy, "all");
    if (cached) return cached;

    const [categories, subCategories] = await Promise.all([
      this.categoryModel.find({ isActive: true }).select("categoryName").lean(),
      this.subCategoryModel
        .find({ isActive: true })
        .select("subCategoryName categoryId")
        .lean(),
    ]);

    const taxonomy: TaxonomyEntry[] = categories.map((category: any) => ({
      categoryName: category.categoryName,
      subCategories: subCategories
        .filter((sub: any) => String(sub.categoryId) === String(category._id))
        .map((sub: any) => sub.subCategoryName),
    }));

    await this.cacheService.setJson(RedisKeys.Taxonomy, taxonomy, "all", 3600);
    return taxonomy;
  };

  /** Loose singular/plural folding so "chairs" finds "chair". */
  private keywordStem = (keyword: string) => {
    const escaped = String(keyword || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.replace(/(ies|es|s)$/i, "") || escaped;
  };

  /**
   * Short stems must match whole words.
   *
   * "PA speakers" yields the stem "pa", and as a bare substring that matches
   * "Padded Folding Chair" — which is how a query for a PA system came back
   * with chairs and a camping pillow. Anything under four characters is
   * anchored to a word boundary; longer stems stay loose so "camp" still finds
   * "camping".
   */
  private stemMatches = (stem: string, haystack: string) => {
    if (!stem) return false;
    if (stem.length >= 4) return haystack.includes(stem);
    return new RegExp(`\\b${stem}`, "i").test(haystack);
  };

  private stemRegex = (stem: string) => (stem.length >= 4 ? stem : `\\b${stem}`);

  /**
   * Relevance scoring.
   *
   * The old query built one `$or` of keyword regexes and returned whatever
   * matched in natural collection order, with no notion of a better or worse
   * match. That is how "tent for an outdoor party" came back with a Pentax DSLR
   * first: one weak keyword hit anywhere in a description was indistinguishable
   * from a direct name match. Scoring restores the ranking the parser worked out
   * and the query layer was throwing away.
   */
  private scoreEquipment = (
    equipment: any,
    filters: ParsedSearchFilters,
    matchedCategoryId?: string,
    matchedSubCategoryIds: string[] = []
  ) => {
    let score = 0;
    const name = String(equipment.name || "").toLowerCase();
    const description = String(equipment.description || "").toLowerCase();
    const tags = (equipment.tags || []).map((t: string) => String(t).toLowerCase());

    const categoryId = String(equipment.categoryId?._id ?? equipment.categoryId);
    const subCategoryId = String(
      equipment.subCategoryId?._id ?? equipment.subCategoryId
    );

    if (matchedCategoryId && categoryId === matchedCategoryId) score += 3;
    if (matchedSubCategoryIds.length && matchedSubCategoryIds.includes(subCategoryId)) {
      score += 3;
    }

    for (const keyword of filters.keywords || []) {
      const stem = this.keywordStem(keyword).toLowerCase();
      if (!stem) continue;
      if (this.stemMatches(stem, name)) score += 4;
      if (tags.some((tag: string) => this.stemMatches(stem, tag))) score += 2;
      if (this.stemMatches(stem, description)) score += 1;
    }

    if (equipment.isFeatured) score += 0.25;
    return score;
  };

  public naturalSearchEquipments = async (
    filters: ParsedSearchFilters | null,
    rawQuery: string,
    limit = 20
  ): Promise<{
    results: any[];
    usedFallback: boolean;
    matchedCategoryId?: string;
    hasExactMatch?: boolean;
  }> => {
    const textFallback = async () => {
      const escaped = String(rawQuery || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const data = await this.equipmentModel
        .find({
          isActive: true,
          $or: [
            { name: { $regex: escaped, $options: "i" } },
            { description: { $regex: escaped, $options: "i" } },
            { tags: { $elemMatch: { $regex: escaped, $options: "i" } } },
          ],
        })
        .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
        .limit(limit)
        .lean();
      return {
        results: data.map((item) => new EquipmentClass(item)),
        usedFallback: true,
      };
    };

    if (!filters) return textFallback();

    const mongoFilters: Record<string, any> = { isActive: true };
    let matchedCategoryId: string | undefined;
    let matchedSubCategoryIds: string[] = [];

    if (filters.category) {
      const category = await this.categoryModel
        .findOne({ categoryName: filters.category })
        .lean();
      if (category) matchedCategoryId = String((category as any)._id);
    }
    if (filters.subCategory) {
      const subCategories = await this.subCategoryModel
        .find({ subCategoryName: filters.subCategory })
        .lean();
      matchedSubCategoryIds = subCategories.map((sub: any) => String(sub._id));
    }

    if (filters.priceMin !== null || filters.priceMax !== null) {
      mongoFilters["prices.dailyRent"] = {};
      if (filters.priceMin !== null)
        mongoFilters["prices.dailyRent"]["$gte"] = filters.priceMin;
      if (filters.priceMax !== null)
        mongoFilters["prices.dailyRent"]["$lte"] = filters.priceMax;
    }

    // Candidates are drawn widely (category OR keyword hits) and ranked after,
    // rather than intersected: an item in the right category with an unusual
    // name should still beat an unrelated item that happened to share a word.
    const orClauses: Record<string, any>[] = [];
    if (matchedCategoryId) orClauses.push({ categoryId: matchedCategoryId });
    if (matchedSubCategoryIds.length)
      orClauses.push({ subCategoryId: { $in: matchedSubCategoryIds } });

    const stems = (filters.keywords || [])
      .map((keyword) => this.keywordStem(keyword))
      .filter(Boolean);
    if (stems.length) {
      const pattern = stems.map((stem) => this.stemRegex(stem)).join("|");
      orClauses.push({ name: { $regex: pattern, $options: "i" } });
      orClauses.push({ description: { $regex: pattern, $options: "i" } });
      orClauses.push({ tags: { $elemMatch: { $regex: pattern, $options: "i" } } });
    }
    if (orClauses.length) mongoFilters["$or"] = orClauses;

    const data = await this.equipmentModel
      .find(mongoFilters)
      .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
      .limit(120)
      .lean();

    if (data.length === 0) return { results: [], usedFallback: false, matchedCategoryId };

    // Anything scoring zero is noise, not a weak match. Returning nothing is a
    // more honest answer than returning a DSLR for a treadmill query.
    const ranked = data
      .map((item: any) => ({
        item,
        score: this.scoreEquipment(
          item,
          filters,
          matchedCategoryId,
          matchedSubCategoryIds
        ),
      }))
      .filter((entry) => entry.score > 0);

    ranked.sort((a, b) => b.score - a.score);

    const topScore = ranked[0]?.score ?? 0;

    /**
     * Relevance gates; price only orders what is already relevant.
     *
     * Sorting the whole result set by price destroyed the ranking: "PA speakers
     * under 1500" put the cheapest item in the catalogue first and buried the
     * actual PA speaker. "Under 1500" is a constraint on which speakers, not an
     * instruction to show the cheapest thing that shares a letter with the query.
     */
    const band = ranked.filter((entry) => entry.score >= topScore * 0.6);
    const rest = ranked.filter((entry) => entry.score < topScore * 0.6);

    if (filters.sortBy === "price_asc") {
      band.sort(
        (a, b) => (a.item.prices?.dailyRent ?? 0) - (b.item.prices?.dailyRent ?? 0)
      );
    } else if (filters.sortBy === "price_desc") {
      band.sort(
        (a, b) => (b.item.prices?.dailyRent ?? 0) - (a.item.prices?.dailyRent ?? 0)
      );
    }

    // A score at or below the category bonus means nothing actually matched the
    // words the user typed — we are showing the right shelf, not the right item.
    const categoryOnlyScore = (matchedCategoryId ? 3 : 0) + (matchedSubCategoryIds.length ? 3 : 0);
    const hasKeywordMatch = topScore > categoryOnlyScore + 0.25;

    return {
      results: [...band, ...rest]
        .slice(0, limit)
        .map((entry) => new EquipmentClass(entry.item)),
      usedFallback: false,
      matchedCategoryId,
      /** False when we matched the category but nothing matched the actual words. */
      hasExactMatch: hasKeywordMatch,
    };
  };

  /** Demand radar: keep every query, especially the ones that found nothing. */
  public recordSearch = async (payload: {
    query: string;
    userId?: string;
    filters: ParsedSearchFilters | null;
    matchedCategoryId?: string;
    resultCount: number;
    usedFallback: boolean;
  }) => {
    try {
      await this.searchQueryModel.create({
        query: payload.query,
        userId:
          payload.userId && isValidObjectId(payload.userId)
            ? new Types.ObjectId(payload.userId)
            : undefined,
        parsedCategory: payload.filters?.category ?? undefined,
        matchedCategoryId: payload.matchedCategoryId
          ? new Types.ObjectId(payload.matchedCategoryId)
          : undefined,
        keywords: payload.filters?.keywords ?? [],
        priceMin: payload.filters?.priceMin ?? undefined,
        priceMax: payload.filters?.priceMax ?? undefined,
        resultCount: payload.resultCount,
        usedFallback: payload.usedFallback,
      });
    } catch (err: any) {
      // Analytics must never break a search.
      console.error("[search] could not record query:", err?.message ?? err);
    }
  };

  /** Candidate pool for the kit builder, already filtered to what is free. */
  public getKitCandidates = async (from: Date, to: Date, limit = 120) => {
    const items = await this.equipmentModel
      .find({ isActive: true })
      .populate([...CategoryPopulate, ...SubCategoryPopulate])
      .limit(limit)
      .lean();

    const stock = await availabilityService.getAvailableQuantities(
      items.map((item: any) => ({
        equipmentId: String(item._id),
        from,
        to,
      }))
    );

    return items
      .map((item: any) => ({
        raw: item,
        id: String(item._id),
        name: item.name,
        category: item.categoryId?.categoryName ?? "",
        subCategory: item.subCategoryId?.subCategoryName ?? "",
        pricePerDay: item.prices?.dailyRent ?? 0,
        available: stock.get(String(item._id))?.available ?? 0,
        tags: Array.isArray(item.tags) ? item.tags : [],
      }))
      .filter((candidate) => candidate.available > 0);
  };

  /** Owner console: everything this user has listed, with live utilisation. */
  public getEquipmentsByOwner = async (ownerId: string) => {
    if (!isValidObjectId(ownerId)) {
      throw new HttpExceptionError(400, "Invalid owner Id");
    }
    const items = await this.equipmentModel
      .find({ userId: new Types.ObjectId(ownerId) })
      .populate([...CategoryPopulate, ...SubCategoryPopulate])
      .lean();

    const now = new Date();
    const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    return Promise.all(
      items.map(async (item: any) => {
        const window = await availabilityService.getAvailabilityWindow(
          String(item._id),
          now,
          horizon
        );
        return {
          ...new EquipmentClass(item),
          totalQuantity: item.totalQuantity ?? 1,
          isActive: item.isActive,
          committedDays: Object.keys(window.usageByDay).length,
          fullyBookedDays: window.fullyBookedDays.length,
        };
      })
    );
  };

  public isEquipmentExists = async (filters: Record<string, any>) => {
    const isEquipmentExists = await this.equipmentModel.exists({ ...filters });
    return isEquipmentExists;
  };

  public getRecommendedEquipments = async (userId: string): Promise<{
    items: EquipmentClass[];
    reasons: string[];
    profileSummary: string;
    isAiPowered: boolean;
  }> => {
    const cached = await this.cacheService.getJson(RedisKeys.AIRecommendations, userId);
    if (cached) return cached;

    const { likedIds, viewedIds, bookedEquipmentIds } = await this.getUserInterestIds(userId);
    const allIds = [...likedIds, ...viewedIds, ...bookedEquipmentIds];
    if (allIds.length === 0) return { items: [], reasons: [], profileSummary: "", isAiPowered: false };

    const { categoryIds, subCategoryIds } = await this.getUserInterestCategories({ likedIds, viewedIds, bookedEquipmentIds });

    // Previously booked items used to be excluded from the candidate pool, which
    // is backwards for rentals: re-renting what you rented last time is the most
    // likely next action, not the least. They are eligible now, and the interest
    // profile already tells the model which ones they are so it can frame them
    // as a repeat rather than a discovery.
    const [sameSubCategory, sameCategory] = await Promise.all([
      this.equipmentModel
        .find({ subCategoryId: { $in: subCategoryIds }, isActive: true })
        .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
        .limit(30).lean().exec(),
      this.equipmentModel
        .find({ categoryId: { $in: categoryIds }, subCategoryId: { $nin: subCategoryIds }, isActive: true })
        .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
        .limit(20).lean().exec(),
    ]);
    const candidatePool = [...sameSubCategory, ...sameCategory];
    if (candidatePool.length === 0) return { items: [], reasons: [], profileSummary: "", isAiPowered: false };

    const interestEquipments = await this.equipmentModel
      .find({ _id: { $in: allIds.slice(0, 20) } })
      .select("name prices categoryId subCategoryId tags")
      .populate([...CategoryPopulate, ...SubCategoryPopulate])
      .lean();

    const userInterestProfile = this.buildUserInterestProfileText(interestEquipments, likedIds, viewedIds, bookedEquipmentIds);

    const compactCandidates = candidatePool.map((eq: any) => ({
      id: eq._id.toString(),
      name: eq.name,
      category: eq.categoryId?.categoryName || "",
      subCategory: eq.subCategoryId?.subCategoryName || "",
      price: eq.prices?.dailyRent || 0,
      tags: Array.isArray(eq.tags) ? eq.tags : [],
    }));

    try {
      const geminiService = GeminiService.getInstance();
      const aiResult = await geminiService.generatePersonalizedRecommendations(userInterestProfile, compactCandidates);

      const candidateMap = new Map<string, any>(candidatePool.map((eq: any) => [eq._id.toString(), eq]));
      const validRecs = aiResult.recommendations.filter(r => candidateMap.has(r.id)).slice(0, 15);
      const items = validRecs.map(r => new EquipmentClass(candidateMap.get(r.id)));
      const reasons = validRecs.map(r => r.reason);

      const result = { items, reasons, profileSummary: aiResult.profileSummary, isAiPowered: true };

      await this.cacheService.setJson(RedisKeys.AIRecommendations, result, userId, 3600);
      return result;

    } catch {
      const fallbackItems = candidatePool.slice(0, 15).map((eq: any) => new EquipmentClass(eq));
      return { items: fallbackItems, reasons: [], profileSummary: "", isAiPowered: false };
    }
  };
  public getUserInterestIds = async (userId: string) => {
    const objectId = new Types.ObjectId(userId);

    const userActivities = await this.userActivityModel
      .find({
        userId: objectId,
        reference: UserActivityReference.EQUIPMENT,
        isPositive: 1,
        action: { $in: [UserActivity.LIKE, UserActivity.VIEW] },
      })
      .lean();

    const userBookings = await this.equipmentBookingModel.aggregate([
      { $match: { userId: objectId } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          bookedEquipmentIds: { $addToSet: "$items.equipmentId" },
        },
      },
    ]);

    const bookedEquipmentIds = userBookings?.[0]?.bookedEquipmentIds || [];

    const likedIds = userActivities
      .filter((a) => a.action === UserActivity.LIKE)
      .map((a) => a.sourceId);
    const viewedIds = userActivities
      .filter((a) => a.action === UserActivity.VIEW)
      .map((a) => a.sourceId);

    return { likedIds, viewedIds, bookedEquipmentIds };
  };

  private buildUserInterestProfileText = (
    equipments: any[],
    likedIds: Types.ObjectId[],
    viewedIds: Types.ObjectId[],
    bookedIds: Types.ObjectId[]
  ): string => {
    const likedSet = new Set(likedIds.map(id => id.toString()));
    const viewedSet = new Set(viewedIds.map(id => id.toString()));
    const bookedSet = new Set(bookedIds.map(id => id.toString()));

    const liked = equipments.filter(e => likedSet.has(e._id.toString()));
    const viewed = equipments.filter(e => viewedSet.has(e._id.toString()) && !likedSet.has(e._id.toString()));
    const booked = equipments.filter(e => bookedSet.has(e._id.toString()));

    const fmt = (e: any) => `- ${e.name} (${(e.categoryId as any)?.categoryName || "Unknown"}, ₹${(e.prices as any)?.dailyRent || "?"}/day)`;

    const prices = equipments.map((e: any) => (e.prices as any)?.dailyRent).filter(Boolean);
    const priceRange = prices.length > 0 ? `₹${Math.min(...prices)} – ₹${Math.max(...prices)}/day` : "Unknown";
    const categories = [...new Set(equipments.map((e: any) => (e.categoryId as any)?.categoryName).filter(Boolean))];

    const parts: string[] = [];
    if (liked.length > 0) parts.push(`LIKED (strong interest):\n${liked.slice(0, 5).map(fmt).join("\n")}`);
    if (viewed.length > 0) parts.push(`VIEWED (browsed):\n${viewed.slice(0, 5).map(fmt).join("\n")}`);
    if (booked.length > 0) parts.push(`PREVIOUSLY BOOKED:\n${booked.slice(0, 5).map(fmt).join("\n")}`);
    parts.push(`INFERRED PREFERENCES:\n- Price range engaged: ${priceRange}\n- Top categories: ${categories.join(", ")}`);

    return parts.join("\n\n");
  };

  public getUserInterestCategories = async ({
    likedIds,
    viewedIds,
    bookedEquipmentIds,
  }: any) => {
    const allInterestIds = [...likedIds, ...viewedIds, ...bookedEquipmentIds];

    const equipments = await this.equipmentModel
      .find({
        _id: { $in: allInterestIds },
      })
      .select("categoryId subCategoryId");

    const categoryIds = [
      ...new Set(equipments.map((e) => e.categoryId.toString())),
    ];
    const subCategoryIds = [
      ...new Set(equipments.map((e) => e.subCategoryId.toString())),
    ];

    return { categoryIds, subCategoryIds };
  };
}

const equipmentService = new EquipmentService();
export { equipmentService, EquipmentService };
