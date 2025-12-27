import { smtpTransporter } from "../config/mail/smtp.mailer";

class EmailService {
  async sendTestEmail(to: string): Promise<void> {
    await smtpTransporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to,
      subject: "Password reset",
      html: `
        <html>
          <body>
            <h1>Hello World 👋</h1>
            <p>This is a test password reset email.</p>
          </body>
        </html>
      `,
    });
  }
}

export default new EmailService();