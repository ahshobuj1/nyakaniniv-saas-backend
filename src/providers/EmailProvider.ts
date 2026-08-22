import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { config } from "@/core/config";
import { AppLogger } from "@/core/logging/logger";

import { InfrastructureProvider } from "@/core/InfrastructureProvider";

export interface IEmailProvider {
  sendEmail(to: string, subject: string, html: string, attachments?: { filename: string, content?: Buffer, path?: string, contentType?: string, cid?: string }[]): Promise<boolean>;
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

  async sendEmail(to: string, subject: string, html: string, attachments?: { filename: string, content?: Buffer, path?: string, contentType?: string, cid?: string }[]): Promise<boolean> {
    try {
      if (!config.smtp.user || !config.smtp.pass) {
        AppLogger.warn(`[EmailProvider] SMTP credentials not set. Mock sending email to ${to}: ${subject}`);
        return true;
      }

      const emailAttachments: any[] = attachments ? [...attachments] : [];

      // Automatically attach upbeat-logo if referenced in HTML
      if (html.includes('cid:upbeat-logo')) {
        const hasLogoAttachment = emailAttachments.some(a => a.cid === 'upbeat-logo');
        if (!hasLogoAttachment) {
          const logoPath = path.resolve(process.cwd(), "public/logo.png");
          if (fs.existsSync(logoPath)) {
            emailAttachments.push({
              filename: 'logo.png',
              path: logoPath,
              cid: 'upbeat-logo',
            });
          }
        }
      }

      await this.transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        html,
        attachments: emailAttachments,
      });

      AppLogger.info(`[EmailProvider] Successfully sent email to ${to}`);
      return true;
    } catch (error) {
      AppLogger.error(`[EmailProvider] Failed to send email to ${to}`, { error });
      return false;
    }
  }
}
