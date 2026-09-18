import {
  DeliveryType,
  EquipmentBookingStatus,
  PaymentMode,
} from "@src/enums/equipment.enum";
import {
  BookingActor,
  allowedNextStates,
  isTransitionAllowed,
} from "@src/enums/booking-lifecycle.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { EquipmentBookingModel } from "@src/models/equipments-booking.model";
import { isEmpty } from "@utils/data.util";
import { isValidObjectId } from "@validations/data.validation";
import { UserService } from "./user.service";
import { EquipmentModel } from "@src/models/equipment.model";
import { Types, PipelineStage } from "mongoose";
import { Collections } from "@src/enums/collections.enum";
import { emailQueueService } from "./email-queue.service";
import {
  availabilityService,
  startOfDay,
  STOCK_HOLDING_STATUSES,
} from "./availability.service";
import { priceLine, sumLines } from "@utils/pricing.util";
import {
  bookingConfirmedEmail,
  depositRefundedEmail,
} from "@utils/email-template.util";

export class EquipmentBookingService {
  private equipmentModel = EquipmentModel();
  private userService = new UserService();
  private equipmentBookingModel = EquipmentBookingModel();

  /**
   * Transactional email must never decide whether a booking succeeded.
   *
   * This used to be awaited inline. Render cannot reach Gmail's SMTP, so the
   * send hung for ~110s and threw — after the booking row had already been
   * written. Every booking in production therefore returned
   * "Internal Server Error: Connection timeout" to a user whose booking had in
   * fact been created, and the UI told them to try again, which produced
   * duplicates. The queue exists precisely so this cannot happen; when Redis is
   * off the send still has to be detached from the request.
   */
  private dispatchEmail = (to: string | undefined, mail: { subject: string; html: string }) => {
    if (!to) return;
    void emailQueueService
      .sendEmail({ to: [to], subject: mail.subject, html: mail.html })
      .catch((err) =>
        console.error("[booking] notification failed:", err?.message ?? err)
      );
  };

  public createBooking = async (data: any, userId: string) => {
    const items = data?.items;
    if (!userId) throw new HttpExceptionError(400, "User Id is required.");
    if (!Types.ObjectId.isValid(userId)) {
      throw new HttpExceptionError(400, "Invalid userId format");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpExceptionError(400, "At least one equipment item is required.");
    }

    const userObjectId = new Types.ObjectId(userId);
    const userData = await this.userService.getUserById(userId);
    if (!userData) throw new HttpExceptionError(404, "No user found with given Id");

    const equipmentIds = items.map((item: any) => item.equipmentId);
    if (new Set(equipmentIds.map(String)).size !== equipmentIds.length) {
      throw new HttpExceptionError(
        400,
        "The same equipment appears twice — combine it into one line with a higher quantity."
      );
    }

    const equipmentList = await this.equipmentModel
      .find({ _id: { $in: equipmentIds } })
      .lean();
    if (equipmentList.length !== equipmentIds.length) {
      throw new HttpExceptionError(404, "One or more equipment items not found.");
    }

    const finalItems = [];
    const lines = [];

    for (const item of items) {
      const { equipmentId, quantity, startDate, endDate } = item;
      if (!equipmentId || !quantity || !startDate || !endDate) {
        throw new HttpExceptionError(
          400,
          "equipmentId, quantity, startDate, and endDate are required."
        );
      }

      const equipment: any = equipmentList.find(
        (eq: any) => eq._id.toString() === equipmentId.toString()
      );
      if (!equipment) {
        throw new HttpExceptionError(404, `Equipment with id ${equipmentId} not found.`);
      }

      const from = startOfDay(startDate);
      const to = startOfDay(endDate);

      // The gate. Nothing reaches the database without passing it.
      await availabilityService.assertAvailable(
        equipmentId.toString(),
        from,
        to,
        quantity
      );

      const line = priceLine({
        dailyRent: equipment.prices?.dailyRent ?? 0,
        depositPerUnit: equipment.deposits?.dailyDeposit ?? 0,
        quantity,
        startDate: from,
        endDate: to,
      });
      lines.push(line);

      finalItems.push({
        equipmentId: equipment._id,
        quantity: line.quantity,
        name: equipment.name,
        description: equipment.description,
        startDate: from,
        endDate: to,
        dailyRent: line.dailyRent,
        depositAmount: line.depositAmount,
      });
    }

    const totals = sumLines(lines);

    const booking = await this.equipmentBookingModel.create({
      userId: userObjectId,
      items: finalItems,
      ...totals,
      isDepositPaid: false,
      isDepositRefunded: false,
      isReturned: false,
      status: EquipmentBookingStatus.PENDING,
      deliveryType: data?.deliveryType ?? DeliveryType.PICKUP,
      paymentMode: data?.paymentMode ?? PaymentMode.CASH,
      isPaid: false,
    });

    this.dispatchEmail(userData.emailId, bookingConfirmedEmail(booking.toObject()));
    return booking;
  };

  /**
   * A price quote without writing anything, so the client never has to repeat
   * the arithmetic. The UI used to compute its own total and disagreed with the
   * server by more than 2x on a three-day booking.
   */
  public quoteBooking = async (items: any[]) => {
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpExceptionError(400, "At least one item is required to quote.");
    }

    const lines = [];
    const detail = [];

    for (const item of items) {
      const equipment: any = await this.equipmentModel
        .findById(item.equipmentId)
        .select("name prices deposits totalQuantity")
        .lean();
      if (!equipment) {
        throw new HttpExceptionError(404, "Equipment not found");
      }

      const from = startOfDay(item.startDate);
      const to = startOfDay(item.endDate);
      const line = priceLine({
        dailyRent: equipment.prices?.dailyRent ?? 0,
        depositPerUnit: equipment.deposits?.dailyDeposit ?? 0,
        quantity: item.quantity ?? 1,
        startDate: from,
        endDate: to,
      });
      lines.push(line);

      const { available, totalQuantity } =
        await availabilityService.getAvailableQuantity(
          String(item.equipmentId),
          from,
          to
        );

      detail.push({
        equipmentId: String(item.equipmentId),
        name: equipment.name,
        ...line,
        available,
        totalQuantity,
        isAvailable: available >= line.quantity,
      });
    }

    return {
      items: detail,
      ...sumLines(lines),
      isAvailable: detail.every((d) => d.isAvailable),
    };
  };

  public getBookingById = async (bookingId: string) => {
    if (isEmpty(bookingId) || !isValidObjectId(bookingId)) {
      throw new HttpExceptionError(400, "Not valid Booking Id");
    }
    return this.equipmentBookingModel.findById(bookingId).lean().exec();
  };

  private withEquipmentDetails = (
    matchStage: Record<string, any>
  ): PipelineStage[] => [
    { $match: matchStage },
    {
      $lookup: {
        from: Collections.EQUIPMENT,
        localField: "items.equipmentId",
        foreignField: "_id",
        as: "equipmentDetails",
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
    { $project: { equipmentDetails: 0 } },
    { $sort: { createdAt: -1 } },
  ];

  public getAllBookingsByUserId = async (userId: string) => {
    if (isEmpty(userId) || !isValidObjectId(userId)) {
      throw new HttpExceptionError(400, "Invalid User Id");
    }
    const userData = await this.userService.isUserExists({
      _id: new Types.ObjectId(userId),
    });
    if (!userData) throw new HttpExceptionError(404, "No user found with given Id");

    const bookings = await this.equipmentBookingModel
      .aggregate(this.withEquipmentDetails({ userId: new Types.ObjectId(userId) }))
      .exec();

    return bookings.map((booking) => ({
      ...booking,
      nextActions: allowedNextStates(booking.status, BookingActor.RENTER),
    }));
  };

  /**
   * Everything booked against equipment this user owns — the request queue the
   * owner console is built on. `equipment.userId` has existed from the start
   * with no product surface at all.
   */
  public getBookingsForOwner = async (ownerId: string) => {
    if (!isValidObjectId(ownerId)) {
      throw new HttpExceptionError(400, "Invalid owner Id");
    }
    const ownedIds = await this.equipmentModel
      .find({ userId: new Types.ObjectId(ownerId) })
      .distinct("_id");

    if (ownedIds.length === 0) return [];

    const bookings = await this.equipmentBookingModel
      .aggregate([
        ...this.withEquipmentDetails({ "items.equipmentId": { $in: ownedIds } }),
        {
          $lookup: {
            from: Collections.USER,
            localField: "userId",
            foreignField: "_id",
            as: "renter",
            pipeline: [{ $project: { fullName: 1, emailId: 1, mobileNumber: 1 } }],
          },
        },
        { $addFields: { renter: { $arrayElemAt: ["$renter", 0] } } },
      ])
      .exec();

    return bookings.map((booking) => ({
      ...booking,
      nextActions: allowedNextStates(booking.status, BookingActor.OWNER),
    }));
  };

  private isOwnerOfBooking = async (booking: any, userId: string) => {
    const ids = booking.items.map((item: any) => item.equipmentId);
    const owned = await this.equipmentModel.exists({
      _id: { $in: ids },
      userId: new Types.ObjectId(userId),
    });
    return Boolean(owned);
  };

  /**
   * The only way a booking changes state. Validates the move against the
   * lifecycle table and applies the side effects that field on the booking
   * schema were always meant to carry.
   */
  public updateBookingStatus = async (
    bookingId: string,
    nextStatus: EquipmentBookingStatus,
    userId: string,
    reason?: string
  ) => {
    if (!isValidObjectId(bookingId)) {
      throw new HttpExceptionError(400, "Invalid booking Id");
    }
    const booking: any = await this.equipmentBookingModel.findById(bookingId);
    if (!booking) throw new HttpExceptionError(404, "Booking not found");

    const isRenter = booking.userId.toString() === userId;
    const isOwner = await this.isOwnerOfBooking(booking, userId);
    if (!isRenter && !isOwner) {
      throw new HttpExceptionError(403, "This booking is not yours to change.");
    }
    const actor = isOwner ? BookingActor.OWNER : BookingActor.RENTER;

    if (!isTransitionAllowed(booking.status, nextStatus, actor)) {
      const allowed = allowedNextStates(booking.status, actor);
      throw new HttpExceptionError(
        409,
        allowed.length
          ? `A ${booking.status} booking can only move to: ${allowed.join(", ")}.`
          : `A ${booking.status} booking is final and cannot be changed.`
      );
    }

    booking.status = nextStatus;

    if (nextStatus === EquipmentBookingStatus.CANCELLED) {
      booking.cancelledReason =
        reason || (actor === BookingActor.OWNER ? "Declined by owner" : "Cancelled by renter");
      // A cancelled booking must not keep holding money. Nothing released the
      // deposit on cancellation before, so it stayed "held" forever.
      if (booking.isDepositPaid && !booking.isDepositRefunded) {
        booking.isDepositRefunded = true;
        booking.depositRefundDate = new Date();
      }
    }

    if (
      nextStatus === EquipmentBookingStatus.PICKEDUP ||
      nextStatus === EquipmentBookingStatus.DELIVERED
    ) {
      // Money changes hands at handover under the current cash model.
      booking.isPaid = true;
      booking.isDepositPaid = booking.totalDepositAmount > 0;
    }

    if (nextStatus === EquipmentBookingStatus.RETURNED) {
      booking.isReturned = true;
      booking.actualReturnDate = new Date();
      if (booking.isDepositPaid && !booking.isDepositRefunded) {
        booking.isDepositRefunded = true;
        booking.depositRefundDate = new Date();
      }
    }

    await booking.save();

    if (nextStatus === EquipmentBookingStatus.RETURNED && booking.totalDepositAmount > 0) {
      const renter = await this.userService.getUserById(booking.userId.toString());
      this.dispatchEmail(renter?.emailId, depositRefundedEmail(booking.toObject()));
    }

    return booking;
  };

  /**
   * What the renter has tied up in deposits right now, and when each comes back.
   * The deposit is the largest number in the transaction — often several times
   * the rent — and until now it was written once at creation and never shown.
   */
  public getDepositLedger = async (userId: string) => {
    if (!isValidObjectId(userId)) {
      throw new HttpExceptionError(400, "Invalid user Id");
    }
    const bookings = await this.equipmentBookingModel
      .find({ userId: new Types.ObjectId(userId), totalDepositAmount: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .lean();

    const entries = bookings.map((booking: any) => {
      const lastEnd = booking.items.reduce(
        (latest: Date, item: any) =>
          new Date(item.endDate) > latest ? new Date(item.endDate) : latest,
        new Date(0)
      );
      // Only a live booking can be holding money. Legacy rows were written with
      // isDepositPaid true at creation time, so reading that flag alone counted
      // cancelled bookings as still holding a deposit.
      const isLive = STOCK_HOLDING_STATUSES.includes(booking.status);

      return {
        bookingId: String(booking._id),
        items: booking.items.map((i: any) => i.name),
        amount: booking.totalDepositAmount,
        isHeld: isLive && booking.isDepositPaid && !booking.isDepositRefunded,
        isRefunded: Boolean(booking.isDepositRefunded),
        refundedOn: booking.depositRefundDate ?? null,
        expectedBackBy: lastEnd,
        status: booking.status,
      };
    });

    return {
      entries,
      totalHeld: entries
        .filter((e) => e.isHeld)
        .reduce((sum, e) => sum + e.amount, 0),
      totalRefunded: entries
        .filter((e) => e.isRefunded)
        .reduce((sum, e) => sum + e.amount, 0),
    };
  };

  /** Bookings whose return date is inside the threshold and not yet returned. */
  public getBookingsAboutToExpiry = async (daysThreshold: number) => {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    return this.equipmentBookingModel.aggregate([
      {
        $match: {
          isReturned: false,
          status: { $in: STOCK_HOLDING_STATUSES },
          items: { $elemMatch: { endDate: { $lt: thresholdDate } } },
        },
      },
      {
        $lookup: {
          from: Collections.USER,
          localField: "userId",
          foreignField: "_id",
          as: "userInfo",
          pipeline: [{ $project: { _id: 0, emailId: 1, fullName: 1 } }],
        },
      },
    ]);
  };
}

export const equipmentBookingService = new EquipmentBookingService();
