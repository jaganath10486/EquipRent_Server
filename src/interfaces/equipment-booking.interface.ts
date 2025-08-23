import {
  DeliveryType,
  EquipmentBookingStatus,
  PaymentMode,
} from "@src/enums/equipment.enum";
import { Types } from "mongoose";

export interface EquipmentBookingItem {
  equipmentId: Types.ObjectId;
  quantity: number;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  dailyRent: number;
  depositAmount?: number;
}

export interface EquipmentBooking {
  _id?: string;
  userId: Types.ObjectId;
  items: EquipmentBookingItem[];
  status: EquipmentBookingStatus;
  deliveryType: DeliveryType;
  paymentMode: PaymentMode;
  isPaid: boolean;
  totalRentalAmount: number;
  totalDepositAmount?: number;
  isDepositPaid: boolean;
  isDepositRefunded: boolean;
  depositRefundDate?: Date;
  isReturned: boolean;
  actualReturnDate?: Date;
  cancelledReason?: string;
}
