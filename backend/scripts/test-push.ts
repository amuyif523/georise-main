import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

async function testSubscription() {
  try {
    // 1. Register a new user
    const uniqueEmail = `responder-${Date.now()}@example.com`;
    console.log(`Registering user: ${uniqueEmail}`);

    // We assume Agency ID 1 exists. If debug script shows otherwise, we'll update.
    const AGENCY_ID = 1;

    const registerRes = await axios
      .post(`${API_URL}/auth/register`, {
        email: uniqueEmail,
        password: 'password123',
        fullName: 'Test Responder',
        role: 'RESPONDER',
        phone: `+2519${Math.floor(Math.random() * 100000000)}`, // Unique phone
        agencyId: AGENCY_ID,
      })
      .catch(async (err) => {
        console.log('Register failed:', err.response?.data || err.message);
        throw err;
      });

    console.log('Registered user ID:', registerRes.data.id || registerRes.data);

    // 2. Login to get token
    console.log('Logging in...');
    const loginRes = await axios
      .post(`${API_URL}/auth/login`, {
        email: uniqueEmail,
        password: 'password123',
      })
      .catch(async (err) => {
        console.log('Login failed:', err.response?.data || err.message);
        throw err;
      });

    const token = loginRes.data.token;
    console.log('Logged in, token obtained.');

    // 3. Subscribe
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-' + Date.now(),
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
    };

    const res = await axios.post(
      `${API_URL}/notifications/subscribe`,
      { subscription },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    console.log('Subscription response:', res.data);
    if (res.data.success) {
      console.log('SUCCESS: Push subscription saved.');
    } else {
      console.error('FAILURE: Push subscription not saved.');
    }
  } catch (error: any) {
    console.error('Test Failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSubscription();
