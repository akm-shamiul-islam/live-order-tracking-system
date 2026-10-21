import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { getRuntimeSettings } from '../config/runtime-settings.js';

@Injectable()
export class RecoveryMailer {
  private readonly settings = getRuntimeSettings();
  private readonly transport = this.settings.PASSWORD_RESET_ENABLED
    ? nodemailer.createTransport({
        host: this.settings.SMTP_HOST,
        port: this.settings.SMTP_PORT,
        secure: this.settings.SMTP_SECURE,
        requireTLS: this.settings.SMTP_REQUIRE_TLS,
        auth: this.settings.SMTP_USER
          ? { user: this.settings.SMTP_USER, pass: this.settings.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: this.settings.SMTP_CONNECTION_TIMEOUT_MS,
        socketTimeout: this.settings.SMTP_SOCKET_TIMEOUT_MS,
        disableFileAccess: true,
        disableUrlAccess: true,
      })
    : undefined;

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transport) throw new Error('Password recovery mail is not configured');
    await this.transport.sendMail({ from: this.settings.SMTP_FROM, to, subject, text });
  }
}
