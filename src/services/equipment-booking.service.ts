import {
  DeliveryType,
  EquipmentBookingStatus,
  PaymentMode,
} from "@src/enums/equipment.enum";
import {
  EquipmentBooking,
  EquipmentBookingItem,
} from "@interfaces/equipment-booking.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { EquipmentBookingModel } from "@src/models/equipments-booking.model";
import { isEmpty } from "@utils/data.util";
import { isValidObjectId } from "@validations/data.validation";
import { UserService } from "./user.service";
import { EquipmentService } from "./equipment.service";
import { EquipmentModel } from "@src/models/equipment.model";
import { Types } from "mongoose";
import { Collections } from "@src/enums/collections.enum";
import { emailQueueService } from "./email-queue.service";

export class EquipmentBookingService {
  private equipmentModel = EquipmentModel();
  private userService = new UserService();
  private equipmentBookingModel = EquipmentBookingModel();
  private equipmentService = new EquipmentService();

  public createBooking = async (data: any, userId: string) => {
    const items = data.items;
    if (!userId) throw new HttpExceptionError(400, "User Id is required.");

    if (!Types.ObjectId.isValid(userId)) {
      throw new HttpExceptionError(400, "Invalid userId format");
    }

    const userObjectId = new Types.ObjectId(userId);
    if (!Array.isArray(items) || items.length === 0)
      throw new HttpExceptionError(
        400,
        "At least one equipment item is required."
      );

    const userData = await this.userService.getUserById(userId);
    if (!userData)
      throw new HttpExceptionError(404, "No user found with given Id");

    const equipmentIds = items.map((item: any) => item.equipmentId);

    const equipmentList = await this.equipmentModel
      .find({
        _id: { $in: equipmentIds },
      })
      .lean();

    if (equipmentList.length !== equipmentIds.length) {
      throw new HttpExceptionError(
        404,
        "One or more equipment items not found."
      );
    }

    let totalRentalAmount = 0;
    let totalDepositAmount = 0;
    let totalAmountPaid = 0;
    const finalItems = [];

    for (const item of items) {
      const { equipmentId, quantity, startDate, endDate } = item;
      if (!equipmentId || !quantity || !startDate || !endDate) {
        throw new HttpExceptionError(
          400,
          "equipmentId, quantity, startDate, and endDate are required."
        );
      }

      const equipment = equipmentList.find(
        (eq) => eq._id.toString() === equipmentId.toString()
      );
      if (!equipment) {
        throw new HttpExceptionError(
          404,
          `Equipment with id ${equipmentId} not found.`
        );
      }

      if (equipment.avilableQuantity && equipment.avilableQuantity < quantity) {
        throw new HttpExceptionError(
          404,
          `${equipment.name} Equipmnet does not have anu enough quantity to proceed further booking`
        );
      }

      const rentPerDay = equipment.prices?.dailyRent;
      const depositPerDay = equipment.deposits?.dailyDeposit || 0;

      const rentalDays =
        Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;
      if (rentPerDay) {
        totalRentalAmount += rentPerDay * rentalDays * quantity;
        totalDepositAmount += depositPerDay * rentalDays * quantity;
      }

      finalItems.push({
        equipmentId: equipment._id,
        quantity,
        name: equipment.name,
        description: equipment.description,
        startDate,
        endDate,
        dailyRent: rentPerDay,
        depositAmount: depositPerDay,
      });
    }

    const isDepositPaid = totalDepositAmount > 0;
    totalAmountPaid = totalDepositAmount + totalRentalAmount;
    const bookingData = {
      userId: userObjectId,
      items: finalItems,
      totalRentalAmount,
      totalDepositAmount,
      isDepositPaid,
      status: EquipmentBookingStatus.PENDING,
      deliveryType: DeliveryType.PICKUP,
      paymentMode: PaymentMode.CASH,
      isPaid: false,
      totalAmountPaid: totalAmountPaid,
    };

    const booking = await this.equipmentBookingModel.create(bookingData);
    const emailId = userData.emailId;
    if (emailId) {
      await emailQueueService.sendEmail({
        to: [emailId],
        subject: "Successfully booked Equipment",
        html: "Successfully booked an equipment",
      });
    }
    return booking;
  };

  public getBookingById = async (bookingId: string) => {
    if (isEmpty(bookingId) || !isValidObjectId(bookingId)) {
      throw new HttpExceptionError(400, "Not valid Booking Id");
    }
    const data = await this.equipmentModel.findById(bookingId).lean().exec();
    return data;
  };

  public getAllBookingsByUserId = async (userId: string) => {
    if (isEmpty(userId) || !isValidObjectId(userId)) {
      throw new HttpExceptionError(400, "Invalid User Id");
    }

    const userData = await this.userService.isUserExists({
      _id: new Types.ObjectId(userId),
    });
    if (!userData)
      throw new HttpExceptionError(404, "No user found with given Id");
    const equipmentsBookings = await this.equipmentBookingModel
      .aggregate([
        {
          $match: { userId: new Types.ObjectId(userId) },
        },
        {
          $lookup: {
            from: Collections.EQUIPMENT, // collection name of equipments
            localField: "items.equipmentId", // the field inside items array
            foreignField: "_id", // the _id field in equipments
            as: "equipmentDetails", // output array field
          },
        },
        {
          $addFields: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $mergeObjects: [
                    "$$item",
                    {
                      details: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$equipmentDetails",
                              as: "ed",
                              cond: { $eq: ["$$ed._id", "$$item.equipmentId"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            equipmentDetails: 0, // remove temp field
          },
        },
      ])
      .exec();
    return equipmentsBookings;
  };
}
