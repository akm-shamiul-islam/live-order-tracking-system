import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { getRuntimeSettings } from '../config/runtime-settings.js';
import type { AuthOtpPurpose, Language } from '@kitchentodoor/shared';

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

@Injectable()
export class RecoveryMailer {
  private readonly settings = getRuntimeSettings();
  private readonly configured = Boolean(
    this.settings.SMTP_HOST &&
    this.settings.SMTP_FROM &&
    this.settings.SMTP_USER &&
    this.settings.SMTP_PASSWORD,
  );
  private readonly transport = this.configured
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

  isConfigured(): boolean {
    return this.configured;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transport) throw new Error('Password recovery mail is not configured');
    await this.transport.sendMail({
      from: { name: this.settings.SMTP_FROM_NAME, address: this.settings.SMTP_FROM! },
      to,
      subject,
      text,
      html: this.render('Account security update', text),
    });
  }

  async sendOtp(
    to: string,
    purpose: AuthOtpPurpose,
    code: string,
    ttlSeconds: number,
    language: Language = 'en',
  ): Promise<void> {
    if (!this.transport) throw new Error('Authenticated SMTP is not configured');
    const copy = this.otpCopy(purpose, language, Math.ceil(ttlSeconds / 60));
    const text = `${copy.description}\n\n${copy.codeLabel}: ${code}\n\n${copy.expiry}\n${copy.safety}`;
    await this.transport.sendMail({
      from: { name: this.settings.SMTP_FROM_NAME, address: this.settings.SMTP_FROM! },
      to,
      subject: copy.subject,
      text,
      html: this.render(copy.title, copy.description, code, copy),
    });
  }

  private otpCopy(purpose: AuthOtpPurpose, language: Language, expiryMinutes: number) {
    if (language === 'ja') {
      const descriptions: Record<AuthOtpPurpose, string> = {
        email_verification:
          'KitchenToDoor アカウントを有効にするには、このコードでメールアドレスを確認してください。',
        new_device_login: 'このデバイスからサインインするには、このコードを入力してください。',
        password_reset: 'パスワードを再設定するには、このコードを入力してください。',
      };
      const purposeTitles: Record<AuthOtpPurpose, string> = {
        email_verification: 'メールアドレスを確認',
        new_device_login: '新しいデバイスからのサインイン',
        password_reset: 'パスワード再設定',
      };
      return {
        lang: 'ja' as const,
        subject: `KitchenToDoor｜${purposeTitles[purpose]}`,
        title: '確認コード',
        description: descriptions[purpose],
        codeLabel: '確認コード',
        expiry: `このコードは${expiryMinutes}分後に無効になります。1回のみ使用できます。`,
        safety:
          'この操作に心当たりがない場合は、このメールを無視してください。コードを他の人と共有しないでください。',
      };
    }
    const descriptions: Record<AuthOtpPurpose, string> = {
      email_verification:
        'Enter this code to verify your email address and activate your KitchenToDoor account.',
      new_device_login: 'Enter this code to sign in to KitchenToDoor from this new device.',
      password_reset: 'Enter this code to continue resetting your KitchenToDoor password.',
    };
    const titles: Record<AuthOtpPurpose, string> = {
      email_verification: 'Verify your email address',
      new_device_login: 'Confirm this new sign-in',
      password_reset: 'Reset your password',
    };
    return {
      lang: 'en' as const,
      subject: `KitchenToDoor | ${titles[purpose]}`,
      title: 'Your verification code',
      description: descriptions[purpose],
      codeLabel: 'Verification code',
      expiry: `This code expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'} and can only be used once.`,
      safety:
        'If you did not request this, you can ignore this email. Never share this code with anyone.',
    };
  }

  private render(
    title: string,
    description: string,
    code?: string,
    copy?: ReturnType<RecoveryMailer['otpCopy']>,
  ): string {
    const codeBlock =
      code && copy
        ? `<div style="margin:28px 0;padding:18px 20px;border:1px solid #315b69;border-radius:14px;background:#111d30;text-align:center"><div style="color:#99a9bd;font-size:12px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">${escapeHtml(copy.codeLabel)}</div><div style="margin-top:8px;color:#65e6d2;font-size:34px;font-weight:800;letter-spacing:9px">${escapeHtml(code)}</div></div><p style="color:#cbd5e1;font-size:14px;line-height:1.6">${escapeHtml(copy.expiry)}</p><p style="color:#94a3b8;font-size:13px;line-height:1.6">${escapeHtml(copy.safety)}</p>`
        : `<p style="white-space:pre-line;color:#cbd5e1;font-size:14px;line-height:1.7">${escapeHtml(description)}</p>`;
    return `<!doctype html><html lang="${copy?.lang ?? 'en'}"><body style="margin:0;padding:32px 12px;background:#070b18;font-family:Arial,Helvetica,sans-serif;color:#f8fafc"><div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #263449;border-radius:20px;background:#101827"><div style="padding-bottom:20px;border-bottom:1px solid #263449"><div style="color:#65e6d2;font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase">KitchenToDoor</div><div style="margin-top:7px;color:#94a3b8;font-size:13px">Fresh from the kitchen, tracked to your door.</div></div><h1 style="margin:26px 0 12px;color:#f8fafc;font-size:24px;line-height:1.3">${escapeHtml(title)}</h1><p style="color:#cbd5e1;font-size:15px;line-height:1.65">${escapeHtml(description)}</p>${codeBlock}<div style="margin-top:28px;padding-top:18px;border-top:1px solid #263449;color:#7e8da3;font-size:12px;line-height:1.6">KitchenToDoor Account Security</div></div></body></html>`;
  }
}
