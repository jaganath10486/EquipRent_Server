import { rentalDayCount } from "@src/services/availability.service";

export interface PricedLine {
  rentalDays: number;
  quantity: number;
  dailyRent: number;
  /** One-time, per unit, refundable. */
  depositPerUnit: number;
  rentAmount: number;
  depositAmount: number;
}

/**
 * The single place a rental price is decided.
 *
 * Two things used to go wrong here. The server multiplied the deposit by the
 * number of rental days while the client showed it as a flat fee, so a 3-day
 * booking was quoted at 9,500 and recorded at 19,500. And a per-day deposit is
 * the wrong model anyway: a security deposit is a one-time amount held against
 * damage, not a charge that accrues, so a month-long rental was demanding a
 * deposit several times the value of the item.
 *
 * Deposit is therefore one-time per unit, and this function is the only thing
 * that computes it — the client calls the quote endpoint rather than repeating
 * the arithmetic.
 */
export const priceLine = (params: {
  dailyRent: number;
  depositPerUnit?: number;
  quantity: number;
  startDate: Date | string;
  endDate: Date | string;
}): PricedLine => {
  const rentalDays = rentalDayCount(params.startDate, params.endDate);
  const quantity = Math.max(1, Math.floor(params.quantity));
  const dailyRent = Math.max(0, params.dailyRent || 0);
  const depositPerUnit = Math.max(0, params.depositPerUnit || 0);

  return {
    rentalDays,
    quantity,
    dailyRent,
    depositPerUnit,
    rentAmount: dailyRent * rentalDays * quantity,
    depositAmount: depositPerUnit * quantity,
  };
};

export const sumLines = (lines: PricedLine[]) => {
  const totalRentalAmount = lines.reduce((sum, l) => sum + l.rentAmount, 0);
  const totalDepositAmount = lines.reduce((sum, l) => sum + l.depositAmount, 0);
  return {
    totalRentalAmount,
    totalDepositAmount,
    /** What changes hands at pickup: rent plus the refundable deposit. */
    totalAmountPaid: totalRentalAmount + totalDepositAmount,
  };
};
