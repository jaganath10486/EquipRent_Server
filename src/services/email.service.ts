import {
  RESEND_EMAIL_API_KEY,
  RESEND_EMAIL_API_ENABLED,
  EMAIL_ADDRESS,
  NODEEMAIL_PASS,
  NODEMAILER_EMAIL_ENABLED,
} from "@configs/environment";
import HttpExceptionError from "@src/exception/httpexception";
import nodemailer, { Transporter } from "nodemailer";
import { toBoolean } from "@utils/data.util";
import { Resend } from "resend";
export class EmailService {
  private static instance: EmailService;
  private client!: Resend;
  private nodeMailerTransport!: Transporter;

  constructor() {
    // this.initiallizeResendEmail();
    this.initiallizeNodeMailer();
  }

  public static getInstance = (): EmailService => {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  };

  private initiallizeResendEmail = () => {
    this.client = new Resend(RESEND_EMAIL_API_KEY);
  };

  private initiallizeNodeMailer = () => {
    this.nodeMailerTransport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_ADDRESS,
        pass: NODEEMAIL_PASS?.split('-').join(' '),
      },
    });
  };

  public sendEmail = async ({
    from = EMAIL_ADDRESS,
    to,
    subject,
    html,
    text,
  }: {
    from?: string;
    to: string[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<any> => {
    if (toBoolean(RESEND_EMAIL_API_ENABLED)) {
      const { data, error } = await this.client.emails.send({
        from: from,
        to: to,
        subject: subject,
        html: html ?? "",
        text: text ?? "",
      });

      if (error) {
        throw new HttpExceptionError(500, "Failed to send the email.");
      }
      return data;
    } else if (toBoolean(NODEMAILER_EMAIL_ENABLED)) {
      try {
        const email = await this.nodeMailerTransport.sendMail({
          from: from,
          to: to,
          subject: subject,
          text: text,
          html: html,
        });

        return email;
      } catch (err) {
        throw err;
      }
    } else {
      return null;
    }
  };
}
