import HttpExceptionError from "@src/exception/httpexception";
import { EquipmentInterface } from "@interfaces/equipment.interface";
import { EquipmentModel } from "@src/models/equipment.model";
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

  public isEquipmentExists = async (filters: Record<string, any>) => {
    const isEquipmentExists = await this.equipmentModel.exists({ ...filters });
    return isEquipmentExists;
  };

  public getRecommendedEquipments = async (userId: string) => {
    const { likedIds, viewedIds, bookedEquipmentIds } =
      await this.getUserInterestIds(userId);
    const { categoryIds, subCategoryIds } =
      await this.getUserInterestCategories({
        likedIds,
        viewedIds,
        bookedEquipmentIds,
      });

    const sameSubCategory = await this.equipmentModel
      .find({
        subCategoryId: { $in: subCategoryIds },
        _id: { $nin: bookedEquipmentIds }, // exclude already booked
      })
      .populate([
        ...userPopulateQuery,
        ...CategoryPopulate,
        ...SubCategoryPopulate,
      ])
      .limit(10)
      .lean()
      .exec();

    const sameCategory = await this.equipmentModel
      .find({
        categoryId: { $in: categoryIds },
        subCategoryId: { $nin: subCategoryIds }, // avoid duplicates
        _id: { $nin: bookedEquipmentIds },
      })
      .populate([
        ...userPopulateQuery,
        ...CategoryPopulate,
        ...SubCategoryPopulate,
      ])
      .limit(5)
      .lean()
      .exec();

    const recommended = [...sameSubCategory, ...sameCategory].slice(0, 15);
    const transformedResponse = recommended.map(
      (item) => new EquipmentClass(item)
    );
    return transformedResponse;
  };
  public getUserInterestIds = async (userId: string) => {
    const objectId = new Types.ObjectId(userId);

    // get all equipment user liked or viewed
    const userActivities = await this.userActivityModel
      .find({
        userId: objectId,
        reference: UserActivityReference.EQUIPMENT,
        isPositive: 1,
        action: { $in: [UserActivity.LIKE, UserActivity.VIEW] },
      })
      .lean();

    // get all booked equipments by the user
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
