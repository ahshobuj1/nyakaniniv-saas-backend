import nodemailer from "nodemailer";
import { config } from "@/core/config";
import { AppLogger } from "@/core/logging/logger";

import { InfrastructureProvider } from "@/core/InfrastructureProvider";

export interface IEmailProvider {
  sendEmail(to: string, subject: string, html: string): Promise<boolean>;
}

export class EmailProvider implements InfrastructureProvider<IEmailProvider>, IEmailProvider {
  public name = "EmailProvider";
  private transporter!: nodemailer.Transporter;

  public async connect(): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  public getClient(): IEmailProvider {
    return this;
  }

  public async disconnect(): Promise<void> {
    this.transporter.close();
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!config.smtp.user || !config.smtp.pass) {
        AppLogger.warn(`[EmailProvider] SMTP credentials not set. Mock sending email to ${to}: ${subject}`);
        return true;
      }

      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        html,
      });

      AppLogger.info(`[EmailProvider] Successfully sent email to ${to}`);
      return true;
    } catch (error) {
      AppLogger.error(`[EmailProvider] Failed to send email to ${to}`, { error });
      return false;
    }
  }
}
