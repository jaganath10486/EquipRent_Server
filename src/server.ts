import "tsconfig-paths/register";
import App from "@src/app";
import { equipmentBookingRemainder } from "@src/services/cron/equipment-booking-remainder";

const app = new App();

app.initiallizeServer();

// The reminder engine was written but never constructed here, so no booking
// ever produced a pickup reminder, a return notice, or an overdue flag.
equipmentBookingRemainder.schedule();
