export interface EmailInterface {
  from?: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}
