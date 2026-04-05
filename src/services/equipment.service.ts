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

class EquipmentService {
  private equipmentModel = EquipmentModel();
  private categoryModel = CategoryModel();
  private categoryService = new CategoryService();
  private subCategoryService = new SubCategoryService();
  private cacheService = new CacheService();
  private userActivityService = new UserActivityService();
  private userActivityModel = UserActivityModel();
  private equipmentBookingModel = EquipmentBookingModel();

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

  public naturalSearchEquipments = async (
    filters: ParsedSearchFilters | null,
    rawQuery: string,
    limit = 20
  ): Promise<{ results: any[]; usedFallback: boolean }> => {
    if (!filters) {
      try {
        const data = await this.equipmentModel
          .find({ $text: { $search: rawQuery }, isActive: true })
          .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
          .limit(limit)
          .lean();
        return { results: data.map((item) => new EquipmentClass(item)), usedFallback: true };
      } catch {
        const data = await this.equipmentModel
          .find({ name: { $regex: rawQuery, $options: "i" }, isActive: true })
          .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
          .limit(limit)
          .lean();
        return { results: data.map((item) => new EquipmentClass(item)), usedFallback: true };
      }
    }

    const mongoFilters: Record<string, any> = { isActive: true };

    if (filters.category) {
      const category = await this.categoryModel.findOne({
        categoryName: { $regex: new RegExp(filters.category, "i") },
      });
      if (category) mongoFilters["categoryId"] = category._id;
    }

    if (filters.priceMin !== null || filters.priceMax !== null) {
      mongoFilters["prices.dailyRent"] = {};
      if (filters.priceMin !== null)
        mongoFilters["prices.dailyRent"]["$gte"] = filters.priceMin;
      if (filters.priceMax !== null)
        mongoFilters["prices.dailyRent"]["$lte"] = filters.priceMax;
    }

    if (filters.keywords && filters.keywords.length > 0) {
      const escaped = filters.keywords.map((k) =>
        k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );
      const pattern = escaped.join("|");
      mongoFilters["$or"] = [
        { name: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
        { tags: { $elemMatch: { $regex: pattern, $options: "i" } } },
      ];
    }

    const sortQuery: Record<string, any> = {};
    if (filters.sortBy === "price_asc") sortQuery["prices.dailyRent"] = 1;
    if (filters.sortBy === "price_desc") sortQuery["prices.dailyRent"] = -1;

    const data = await this.equipmentModel
      .find(mongoFilters)
      .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
      .sort(Object.keys(sortQuery).length > 0 ? sortQuery : undefined)
      .limit(limit)
      .lean();

    return { results: data.map((item) => new EquipmentClass(item)), usedFallback: false };
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

    const [sameSubCategory, sameCategory] = await Promise.all([
      this.equipmentModel
        .find({ subCategoryId: { $in: subCategoryIds }, _id: { $nin: bookedEquipmentIds } })
        .populate([...userPopulateQuery, ...CategoryPopulate, ...SubCategoryPopulate])
        .limit(30).lean().exec(),
      this.equipmentModel
        .find({ categoryId: { $in: categoryIds }, subCategoryId: { $nin: subCategoryIds }, _id: { $nin: bookedEquipmentIds } })
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
