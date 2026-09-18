import { EquipmentBookingStatus } from "./equipment.enum";

export enum BookingActor {
  RENTER = "renter",
  OWNER = "owner",
  SYSTEM = "system",
}

/**
 * The booking status enum has existed since the first commit with seven states
 * and nothing that moved between them, so every booking ever made sat at
 * `pending` forever. These are the legal moves, and who is allowed to make them.
 */
export const BOOKING_TRANSITIONS: Record<
  EquipmentBookingStatus,
  { to: EquipmentBookingStatus; by: BookingActor[] }[]
> = {
  [EquipmentBookingStatus.PENDING]: [
    { to: EquipmentBookingStatus.CONFIRMED, by: [BookingActor.OWNER] },
    {
      to: EquipmentBookingStatus.CANCELLED,
      by: [BookingActor.RENTER, BookingActor.OWNER],
    },
  ],
  [EquipmentBookingStatus.CONFIRMED]: [
    { to: EquipmentBookingStatus.PICKEDUP, by: [BookingActor.OWNER] },
    { to: EquipmentBookingStatus.DELIVERED, by: [BookingActor.OWNER] },
    {
      to: EquipmentBookingStatus.CANCELLED,
      by: [BookingActor.RENTER, BookingActor.OWNER],
    },
  ],
  [EquipmentBookingStatus.PICKEDUP]: [
    { to: EquipmentBookingStatus.RETURNED, by: [BookingActor.OWNER] },
    { to: EquipmentBookingStatus.OVERDUE, by: [BookingActor.SYSTEM] },
  ],
  [EquipmentBookingStatus.DELIVERED]: [
    { to: EquipmentBookingStatus.RETURNED, by: [BookingActor.OWNER] },
    { to: EquipmentBookingStatus.OVERDUE, by: [BookingActor.SYSTEM] },
  ],
  [EquipmentBookingStatus.OVERDUE]: [
    { to: EquipmentBookingStatus.RETURNED, by: [BookingActor.OWNER] },
  ],
  [EquipmentBookingStatus.RETURNED]: [],
  [EquipmentBookingStatus.CANCELLED]: [],
};

export const isTransitionAllowed = (
  from: EquipmentBookingStatus,
  to: EquipmentBookingStatus,
  actor: BookingActor
) =>
  (BOOKING_TRANSITIONS[from] || []).some(
    (transition) => transition.to === to && transition.by.includes(actor)
  );

export const allowedNextStates = (
  from: EquipmentBookingStatus,
  actor: BookingActor
) =>
  (BOOKING_TRANSITIONS[from] || [])
    .filter((transition) => transition.by.includes(actor))
    .map((transition) => transition.to);

/** Terminal states no longer hold stock and cannot be acted on. */
export const isTerminal = (status: EquipmentBookingStatus) =>
  status === EquipmentBookingStatus.RETURNED ||
  status === EquipmentBookingStatus.CANCELLED;
