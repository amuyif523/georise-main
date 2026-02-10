import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

async function testAssignmentPush() {
  try {
    console.log('Starting Test...');

    // 1. Setup Data - Staff
    console.log('Registering Staff...');
    const staffEmail = `staff-assign-${Date.now()}@example.com`;
    await axios.post(`${API_URL}/auth/register`, {
      email: staffEmail,
      password: 'password123',
      fullName: 'Staff Assigner',
      role: 'AGENCY_STAFF',
      agencyId: 1,
    });

    // Login Staff
    console.log('Logging in Staff...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: staffEmail,
      password: 'password123',
    });
    const token = loginRes.data.token;
    console.log('Staff Logged in.');

    // 2. Setup Data - Responder
    console.log('Registering Responder...');
    const responderEmail = `responder-push-${Date.now()}@example.com`;
    await axios.post(`${API_URL}/auth/register`, {
      email: responderEmail,
      password: 'password123',
      fullName: 'Push Responder',
      role: 'RESPONDER',
      agencyId: 1,
    });

    // Login Responder
    console.log('Logging in Responder...');
    const respLogin = await axios.post(`${API_URL}/auth/login`, {
      email: responderEmail,
      password: 'password123',
    });
    const respToken = respLogin.data.token;

    // Fetch Profile to get ID
    console.log('Fetching Responder Profile...');
    const meRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    const responders = meRes.data.user.responders || [];
    if (responders.length === 0) {
      // This should pass now with auth.service fix
      throw new Error('Responder profile not found for user');
    }
    const unitId = responders[0].id;
    console.log(`Responder ID (unitId): ${unitId}`);

    // Subscribe (Mock)
    console.log('Subscribing Responder to Push...');
    try {
      await axios.post(
        `${API_URL}/notifications/subscribe`,
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          keys: { p256dh: 'test-key', auth: 'test-auth' },
        },
        { headers: { Authorization: `Bearer ${respToken}` } },
      );
      console.log('Subscribed.');
    } catch (e: any) {
      console.warn('Subscription failed (expected without valid keys?):', e.message);
    }

    // 3. Create Incident (Staff)
    console.log('Creating Incident...');
    // Should succeed now with exemption
    const incRes = await axios.post(
      `${API_URL}/incidents`,
      {
        title: 'Push Test Incident',
        description: 'Testing push',
        latitude: 9.0,
        longitude: 38.0,
        category: 'ACCIDENT',
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const incidentId = incRes.data.incident.id;
    console.log(`Incident Created: ${incidentId}`);

    // 4. Assign
    console.log('Assigning responder via API...');
    const assignRes = await axios.post(
      `${API_URL}/dispatch/assign`,
      {
        incidentId: incidentId,
        agencyId: 1,
        unitId: unitId,
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    console.log('Assignment response status:', assignRes.status);
    if (assignRes.status === 200) {
      console.log('SUCCESS: Assignment API called.');
    }
  } catch (err: any) {
    console.error('Test Failed:', err.message);
    if (err.response) {
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testAssignmentPush();
