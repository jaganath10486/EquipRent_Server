const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const day = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const shell = (heading: string, body: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 4px">EquipRent</p>
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  ${body}
  <p style="font-size:12px;color:#888;margin-top:28px;border-top:1px solid #eee;padding-top:12px">
    You are receiving this because you have an active rental on EquipRent.
  </p>
</div>`;

const lineItem = (item: any) => `
  <tr>
    <td style="padding:6px 0;color:#444">${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</td>
    <td style="padding:6px 0;text-align:right;color:#444">${day(item.startDate)} – ${day(item.endDate)}</td>
  </tr>`;

export const bookingConfirmedEmail = (booking: any) => ({
  subject: `Booking confirmed — ${booking.items[0]?.name ?? "your rental"}`,
  html: shell(
    "Your booking is in",
    `<table style="width:100%;border-collapse:collapse;font-size:14px">
       ${booking.items.map(lineItem).join("")}
     </table>
     <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;border-top:1px solid #eee">
       <tr><td style="padding:6px 0">Rent</td><td style="padding:6px 0;text-align:right">${money(booking.totalRentalAmount)}</td></tr>
       <tr><td style="padding:6px 0">Refundable deposit</td><td style="padding:6px 0;text-align:right">${money(booking.totalDepositAmount)}</td></tr>
       <tr><td style="padding:8px 0;font-weight:600;border-top:1px solid #eee">Due at pickup</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #eee">${money(booking.totalAmountPaid)}</td></tr>
     </table>
     <p style="font-size:14px;color:#444;margin-top:16px">
       The deposit is held, not spent — it comes back to you once the equipment is returned in good condition.
     </p>`
  ),
});

export const pickupReminderEmail = (booking: any, item: any) => ({
  subject: `Pickup tomorrow — ${item.name}`,
  html: shell(
    "Your rental starts tomorrow",
    `<p style="font-size:14px;color:#444">
       <strong>${item.name}</strong> is reserved for you from ${day(item.startDate)} to ${day(item.endDate)}.
     </p>
     <p style="font-size:14px;color:#444">Bring ${money(booking.totalAmountPaid)} — that is ${money(booking.totalRentalAmount)} rent plus a ${money(booking.totalDepositAmount)} refundable deposit.</p>`
  ),
});

export const returnDueEmail = (booking: any, item: any) => ({
  subject: `Due back tomorrow — ${item.name}`,
  html: shell(
    "Time to return your rental",
    `<p style="font-size:14px;color:#444">
       <strong>${item.name}</strong> is due back on ${day(item.endDate)}.
     </p>
     <p style="font-size:14px;color:#444">
       Returning on time releases your ${money(booking.totalDepositAmount)} deposit. Late returns accrue
       ${money(item.dailyRent * (item.quantity || 1))} per day against it.
     </p>`
  ),
});

export const overdueEmail = (booking: any, item: any, daysLate: number) => ({
  subject: `Overdue — ${item.name} was due ${day(item.endDate)}`,
  html: shell(
    `Your rental is ${daysLate} day${daysLate === 1 ? "" : "s"} overdue`,
    `<p style="font-size:14px;color:#444">
       <strong>${item.name}</strong> was due back on ${day(item.endDate)}.
     </p>
     <p style="font-size:14px;color:#444">
       ${money(item.dailyRent * (item.quantity || 1) * daysLate)} has accrued so far against your
       ${money(booking.totalDepositAmount)} deposit. Return it to stop the charge and release the balance.
     </p>`
  ),
});

export const depositRefundedEmail = (booking: any) => ({
  subject: `Deposit released — ${money(booking.totalDepositAmount)}`,
  html: shell(
    "Your deposit is on its way back",
    `<p style="font-size:14px;color:#444">
       ${money(booking.totalDepositAmount)} has been released following the return of
       ${booking.items.map((i: any) => i.name).join(", ")}.
     </p>`
  ),
});

export const savedItemFreeEmail = (
  equipmentName: string,
  equipmentId: string,
  window: { startDate: string; endDate: string }
) => ({
  subject: `${equipmentName} is free ${day(window.startDate)}`,
  html: shell(
    "Something you saved just opened up",
    `<p style="font-size:14px;color:#444">
       <strong>${equipmentName}</strong> — which you saved earlier — is available from
       ${day(window.startDate)} to ${day(window.endDate)}.
     </p>
     <p style="font-size:13px;color:#888">Equipment reference: ${equipmentId}</p>`
  ),
});
