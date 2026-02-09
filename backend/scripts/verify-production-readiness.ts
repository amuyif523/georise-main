import 'dotenv/config';
import {
    SMS_PROVIDER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    ROUTING_PROVIDER,
    GOOGLE_ROUTES_API_KEY
} from '../src/config/env';
import { smsService } from '../src/modules/sms/sms.service';
import { routingService } from '../src/modules/gis/routing.service';
import logger from '../src/logger';

async function verify() {
    logger.info('Starting Production Readiness Verification...');
    let failed = false;

    // 1. Verify SMS Configuration
    logger.info(`Checking SMS Provider: ${SMS_PROVIDER}`);
    if (SMS_PROVIDER === 'twilio') {
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
            logger.error('❌ Twilio configuration missing (SID, Token, or From Number)');
            failed = true;
        } else {
            logger.info('✅ Twilio configuration present');
            // Optional: Try to instantiate client (this is private in service but we can infer)
        }
    } else {
        logger.warn(`⚠️ SMS Provider is '${SMS_PROVIDER}' (Not Twilio). Ensure this is intended for production.`);
    }

    // 2. Verify Routing Configuration
    logger.info(`Checking Routing Provider: ${ROUTING_PROVIDER}`);
    if (ROUTING_PROVIDER === 'google') {
        if (!GOOGLE_ROUTES_API_KEY) {
            logger.error('❌ Google Routes API Key missing');
            failed = true;
        } else {
            logger.info('✅ Google Routes API Key present');
        }
    } else if (ROUTING_PROVIDER === 'osrm') {
        logger.info('✅ OSRM Selected (Default public server or internal)');
    }

    // 3. Verify Services
    try {
        if (smsService) logger.info('✅ SmsService instantiated');
        if (routingService) logger.info('✅ RoutingService instantiated');
    } catch (err) {
        logger.error({ err }, '❌ Service instantiation failed');
        failed = true;
    }

    if (failed) {
        logger.error('❌ Verification FAILED.');
        process.exit(1);
    } else {
        logger.info('✅ Verification PASSED. Ready for transition.');
        process.exit(0);
    }
}

verify();
