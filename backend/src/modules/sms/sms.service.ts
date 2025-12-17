import twilio from 'twilio';
import logger from '../../logger';
import {
  SMS_PROVIDER,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from '../../config/env';

export class SmsService {
  async sendSMS(to: string, message: string) {
    if (SMS_PROVIDER === 'twilio') {
      const client = this.getTwilioClient();
      if (!client) return false;
      return this.sendWithRetry(async () => {
        await client.messages.create({
          to,
          from: TWILIO_FROM_NUMBER,
          body: message,
        });
      });
    }

    logger.info({ to, message }, 'SMS_SENT_SIMULATION');
    return true;
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getTwilioClient() {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      logger.error(
        {
          hasSid: !!TWILIO_ACCOUNT_SID,
          hasToken: !!TWILIO_AUTH_TOKEN,
          hasFrom: !!TWILIO_FROM_NUMBER,
        },
        'Twilio config missing',
      );
      return null;
    }
    return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  private async sendWithRetry(task: () => Promise<void>) {
    const maxAttempts = 3;
    let delayMs = 250;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await task();
        return true;
      } catch (err) {
        logger.warn({ err, attempt }, 'SMS send attempt failed');
        if (attempt === maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }

    return false;
  }
}

export const smsService = new SmsService();
