import fs from "fs";
import path from "path";
import { smtpTransporter } from "../config/mail/smtp.mailer";

class EmailService {
  async sendForgotPasswordEmail(
    to: string,
    resetLink: string
  ): Promise<void> {
    const html = this.renderTemplate("forgot-password.html", {
      resetLink,
    });

    await smtpTransporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to,
      subject: "Reset your password",
      html,
    });
  }

  async sendOtpLoginEmail(
    to: string,
    code: string
  ): Promise<void> {
    const html = this.renderTemplate("otp-login.html", {
      'CODE': code,
    });
    await smtpTransporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to,
      subject: "Your login code",
      html,
    });
  }


  private renderTemplate(
    templateName: string,
    variables: Record<string, string>
  ): string {
    const templatePath = path.join(
      __dirname,
      "templates",
      templateName
    );

    let html = fs.readFileSync(templatePath, "utf-8");

    for (const [key, value] of Object.entries(variables)) {
      html = html.replace(
        new RegExp(`{{${key}}}`, "g"),
        value
      );
    }

    return html;
  }
}

export default new EmailService();
