import { CronService } from "./cron.service";
import { EquipmentBookingService } from "../equipment-booking.service";
import { EmailService } from "../email.service";
import { EquipmentBooking } from "@interfaces/equipment-booking.interface";

export class EquipmentBookingRemainder {
  public isRunning: boolean;
  private cronService = new CronService();
  private thresholdDate = 2;
  private equipmentBookingService = new EquipmentBookingService();
  cronScheduleTime = "";
  constructor() {
    this.isRunning = false;
  }
  schedule() {
    this.cronService.initialzeCronJob(this.cronScheduleTime, this.job, {});
  }

  job = async () => {
    if (this.isRunning) {
      console.log("Cron job is running");
      return;
    }

    this.isRunning = true;

    try {
      await this.getExiperyCollections();
    } catch (error) {
    } finally {
      this.isRunning = false;
    }
  };

  getExiperyCollections = async () => {
    const data: EquipmentBooking[] =
      await this.equipmentBookingService.getBookingsAboutToExpiry(
        this.thresholdDate
      );
    console.log("data :", data)
    data.map(async (value, index) => {});
  };
}
