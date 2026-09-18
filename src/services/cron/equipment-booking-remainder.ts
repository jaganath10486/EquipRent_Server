import { CronService } from "./cron.service";
import { EquipmentBookingModel } from "@src/models/equipments-booking.model";
import { UserService } from "../user.service";
import { emailQueueService } from "../email-queue.service";
import { EquipmentBookingStatus } from "@src/enums/equipment.enum";
import {
  STOCK_HOLDING_STATUSES,
  startOfDay,
  DAY_MS,
} from "../availability.service";
import {
  pickupReminderEmail,
  returnDueEmail,
  overdueEmail,
} from "@utils/email-template.util";

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The rental lifecycle engine.
 *
 * All of the machinery for this already existed — the expiry query, a BullMQ
 * queue with retries, two configured mail providers, and an `overdue` member on
 * the status enum. What was missing was the job itself: the previous body was
 * `data.map(async () => {})`, the cron expression was the empty string, and
 * `server.ts` never constructed the class at all. So the product went silent at
 * exactly the point a rental starts to carry risk.
 */
export class EquipmentBookingRemainder {
  public isRunning: boolean;
  private cronService = new CronService();
  private equipmentBookingModel = EquipmentBookingModel();
  private userService = new UserService();

  /** Hourly. Reminders are day-grained, and hourly keeps them timely without spamming. */
  cronScheduleTime = "0 * * * *";

  constructor() {
    this.isRunning = false;
  }

  schedule() {
    this.cronService.initialzeCronJob(this.cronScheduleTime, this.job, {});
    console.log(
      `[reminders] scheduled "${this.cronScheduleTime}" — pickup, return-due and overdue`
    );
  }

  job = async () => {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const [pickups, dues, overdues] = await Promise.all([
        this.sendPickupReminders(),
        this.sendReturnDueReminders(),
        this.flagOverdue(),
      ]);
      if (pickups + dues + overdues > 0) {
        console.log(
          `[reminders] pickup=${pickups} due=${dues} overdue=${overdues}`
        );
      }
    } catch (err: any) {
      console.error("[reminders] run failed:", err?.message ?? err);
    } finally {
      this.isRunning = false;
    }
  };

  /** Sends once per booking per key; the key is stored on the booking itself. */
  private notifyOnce = async (
    booking: any,
    key: string,
    mail: { subject: string; html: string }
  ) => {
    if ((booking.notificationsSent || []).includes(key)) return false;

    const user = await this.userService.getUserById(booking.userId.toString());
    if (!user?.emailId) return false;

    try {
      await emailQueueService.sendEmail({
        to: [user.emailId],
        subject: mail.subject,
        html: mail.html,
      });
    } catch (err: any) {
      console.error("[reminders] send failed:", err?.message ?? err);
      return false;
    }

    await this.equipmentBookingModel.updateOne(
      { _id: booking._id },
      { $addToSet: { notificationsSent: key } }
    );
    return true;
  };

  /** "Your rental starts tomorrow" — for bookings the owner has confirmed. */
  private sendPickupReminders = async () => {
    const tomorrow = startOfDay(new Date(Date.now() + DAY_MS));
    const bookings = await this.equipmentBookingModel.find({
      status: EquipmentBookingStatus.CONFIRMED,
      items: { $elemMatch: { startDate: tomorrow } },
    });

    let sent = 0;
    for (const booking of bookings) {
      const item = booking.items.find(
        (i: any) => startOfDay(i.startDate).getTime() === tomorrow.getTime()
      );
      if (!item) continue;
      if (
        await this.notifyOnce(
          booking,
          `pickup:${dayKey(tomorrow)}`,
          pickupReminderEmail(booking.toObject(), item)
        )
      )
        sent++;
    }
    return sent;
  };

  /** "Due back tomorrow" — only once the item is actually out. */
  private sendReturnDueReminders = async () => {
    const tomorrow = startOfDay(new Date(Date.now() + DAY_MS));
    const bookings = await this.equipmentBookingModel.find({
      status: {
        $in: [
          EquipmentBookingStatus.PICKEDUP,
          EquipmentBookingStatus.DELIVERED,
        ],
      },
      isReturned: false,
      items: { $elemMatch: { endDate: tomorrow } },
    });

    let sent = 0;
    for (const booking of bookings) {
      const item = booking.items.find(
        (i: any) => startOfDay(i.endDate).getTime() === tomorrow.getTime()
      );
      if (!item) continue;
      if (
        await this.notifyOnce(
          booking,
          `due:${dayKey(tomorrow)}`,
          returnDueEmail(booking.toObject(), item)
        )
      )
        sent++;
    }
    return sent;
  };

  /**
   * Moves live rentals past their return date into `overdue` and tells the
   * renter what it is costing them. This is the state nothing ever set.
   */
  private flagOverdue = async () => {
    const today = startOfDay(new Date());
    const bookings = await this.equipmentBookingModel.find({
      status: {
        $in: [
          EquipmentBookingStatus.PICKEDUP,
          EquipmentBookingStatus.DELIVERED,
          EquipmentBookingStatus.OVERDUE,
        ],
      },
      isReturned: false,
      items: { $elemMatch: { endDate: { $lt: today } } },
    });

    let notified = 0;
    for (const booking of bookings) {
      const latestEnd = booking.items.reduce(
        (latest: Date, item: any) =>
          new Date(item.endDate) > latest ? new Date(item.endDate) : latest,
        new Date(0)
      );
      const daysLate = Math.round(
        (today.getTime() - startOfDay(latestEnd).getTime()) / DAY_MS
      );
      if (daysLate < 1) continue;

      if (booking.status !== EquipmentBookingStatus.OVERDUE) {
        booking.status = EquipmentBookingStatus.OVERDUE;
        await booking.save();
      }

      const item =
        booking.items.find(
          (i: any) =>
            startOfDay(i.endDate).getTime() === startOfDay(latestEnd).getTime()
        ) || booking.items[0];

      // Re-nudges daily while the item stays out, but only once per day.
      if (
        await this.notifyOnce(
          booking,
          `overdue:${dayKey(today)}`,
          overdueEmail(booking.toObject(), item, daysLate)
        )
      )
        notified++;
    }
    return notified;
  };

  /** Exposed so the route can show what the next run would do. */
  public preview = async (daysThreshold = 2) => {
    const threshold = new Date(Date.now() + daysThreshold * DAY_MS);
    return this.equipmentBookingModel
      .find({
        isReturned: false,
        status: { $in: STOCK_HOLDING_STATUSES },
        items: { $elemMatch: { endDate: { $lt: threshold } } },
      })
      .select("status items notificationsSent totalDepositAmount")
      .lean();
  };
}

export const equipmentBookingRemainder = new EquipmentBookingRemainder();
