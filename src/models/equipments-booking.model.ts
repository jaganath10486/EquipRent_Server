import { Schema, SchemaTypes, model } from "mongoose";
import { Collections } from "@src/enums/collections.enum";
import {
  DeliveryType,
  EquipmentBookingStatus,
  PaymentMode,
} from "@src/enums/equipment.enum";
import { EquipmentBooking } from "@interfaces/equipment-booking.interface";

const EquipmentBookingSchema = new Schema(
  {
    userId: {
      type: SchemaTypes.ObjectId,
      ref: Collections.USER,
      required: true,
    },
    items: [
      {
        _id : false,
        equipmentId: {
          type: SchemaTypes.ObjectId,
          ref: Collections.EQUIPMENT,
          required: true,
        },
        quantity: {
          type: SchemaTypes.Number,
          required: true,
          min: 1,
        },
        name: {
          type: SchemaTypes.String,
          required: true,
        },
        description: {
          type: SchemaTypes.String,
          required: true,
        },
        startDate: {
          type: SchemaTypes.Date,
          required: true,
        },
        endDate: {
          type: SchemaTypes.Date,
          required: true,
        },
        dailyRent: {
          type: SchemaTypes.Number,
          required: true,
        },
        depositAmount: {
          type: SchemaTypes.Number,
          required: false,
          default: 0,
        },
      },
    ],

    status: {
      type: SchemaTypes.String,
      enum: EquipmentBookingStatus,
      default: EquipmentBookingStatus.PENDING,
    },

    deliveryType: {
      type: SchemaTypes.String,
      enum: DeliveryType,
      default: DeliveryType.PICKUP,
    },

    // Payment info
    paymentMode: {
      type: SchemaTypes.String,
      enum: PaymentMode,
      default: PaymentMode.CASH,
    },

    isPaid: {
      type: SchemaTypes.Boolean,
      default: false,
    },

    // paymentId: {
    //   type: SchemaTypes.ObjectId,
    //   ref: Collections.PAYMENT, // future reference, not used now
    //   required: false,
    // },

    totalRentalAmount: {
      type: SchemaTypes.Number,
      required: true,
    },

    totalDepositAmount: {
      type: SchemaTypes.Number,
      required: false,
      default: 0,
    },

    isDepositPaid: {
      type: SchemaTypes.Boolean,
      default: false,
    },

    isDepositRefunded: {
      type: SchemaTypes.Boolean,
      default: false,
    },

    depositRefundDate: {
      type: SchemaTypes.Date,
      required: false,
    },

    // Return details
    isReturned: {
      type: SchemaTypes.Boolean,
      default: false,
    },

    actualReturnDate: {
      type: SchemaTypes.Date,
      required: false,
    },

    cancelledReason: {
      type: SchemaTypes.String,
      required: false,
    },

    // Optional: store pickup warehouse for clarity
    // pickupLocation: {
    //   address: { type: SchemaTypes.String, required: false },
    //   locationId: {
    //     type: SchemaTypes.ObjectId,
    //     ref: Collections.LOCATION,
    //     required: false,
    //   },
    // },

    // Optional: delivery support in future
    // deliveryDetails: {
    //   isDelivery: { type: SchemaTypes.Boolean, default: false },
    //   deliveryAgentId: {
    //     type: SchemaTypes.ObjectId,
    //     ref: Collections.USER,
    //     required: false,
    //   },
    //   deliveryStatus: {
    //     type: SchemaTypes.String,
    //     enum: ["pending", "assigned", "in_transit", "delivered", "failed"],
    //     default: "pending",
    //   },
    //   deliveryTime: { type: SchemaTypes.Date, required: false },
    // },
  },
  {
    timestamps: true,
  }
);
const EquipmentBookingModel = () => {
  return model<EquipmentBooking & Document>(
    Collections.EQUIPMENTBOOKINGS,
    EquipmentBookingSchema
  );
};

export { EquipmentBookingModel, EquipmentBookingSchema };
