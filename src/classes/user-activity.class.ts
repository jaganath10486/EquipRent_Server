import { UserActivityCountInterface } from "@interfaces/user-activity-count.interface";
import { assignorDefaultValue } from "@utils/data.util";

export class UserActivityCountClass {
  public totalLikes: number;
  public userId: string;
  constructor(data: UserActivityCountInterface) {
    this.totalLikes = assignorDefaultValue(data.totalLikes, 0);
    this.userId = assignorDefaultValue(data.userId, "");
  }
}
