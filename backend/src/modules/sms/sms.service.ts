import logger from "../../logger";

export class SmsService {
  // In a real app, use Twilio SDK or similar
  // For now, we simulate by logging
  async sendSMS(to: string, message: string) {
    logger.info({ to, message }, "SMS_SENT_SIMULATION");
    // TODO: Integrate Ethio-Telecom or Twilio here
    return true;
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const smsService = new SmsService();
