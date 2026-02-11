import axios from 'axios';

const API_URL = 'http://localhost:4000/api';
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms || 100));

async function testAtomicAssignment() {
  try {
    console.log('Starting Atomic Assignment Test...');

    // 1. Setup Staff
    const staffEmail = `staff-atomic-${Date.now()}@example.com`;
    await axios.post(`${API_URL}/auth/register`, {
      email: staffEmail,
      password: 'password123',
      fullName: 'Atomic Staff',
      role: 'AGENCY_STAFF',
      agencyId: 1,
    });
    await delay(1000);

    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: staffEmail,
      password: 'password123',
    });
    const token = loginRes.data.token;
    console.log('Staff Logged in.');
    await delay(1000);

    // 2. Setup Responder
    const responderEmail = `responder-atomic-${Date.now()}@example.com`;
    await axios.post(`${API_URL}/auth/register`, {
      email: responderEmail,
      password: 'password123',
      fullName: 'Atomic Responder',
      role: 'RESPONDER',
      agencyId: 1,
    });
    await delay(1000);

    const respLogin = await axios.post(`${API_URL}/auth/login`, {
      email: responderEmail,
      password: 'password123',
    });
    const respToken = respLogin.data.token;
    await delay(1000);

    // Get Responder ID
    const meRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    const responders = meRes.data.user.responders || [];
    if (responders.length === 0) throw new Error('Responder not found');
    const unitId = responders[0].id;
    console.log(`Responder ID: ${unitId}`);
    await delay(1000);

    // 2.5 Set Responder Status to AVAILABLE
    console.log(`Setting Responder ${unitId} to AVAILABLE...`);
    await axios.patch(
      `${API_URL}/responders/${unitId}`,
      { status: 'AVAILABLE' },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    await delay(1000);

    // 3. Create Two Incidents
    console.log('Creating Incident 1...');
    const inc1 = await axios.post(
      `${API_URL}/incidents`,
      {
        title: 'Incident 1',
        description: 'Test Incident Description 1',
        latitude: 9.0,
        longitude: 38.0,
        category: 'ACCIDENT',
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const id1 = inc1.data.incident.id;
    await delay(1000);

    console.log('Creating Incident 2...');
    const inc2 = await axios.post(
      `${API_URL}/incidents`,
      {
        title: 'Incident 2',
        description: 'Test Incident Description 2',
        latitude: 9.01,
        longitude: 38.01,
        category: 'FIRE',
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const id2 = inc2.data.incident.id;
    await delay(1000);

    // 4. Assign to Incident 1 (Should Succeed)
    console.log(`Assigning Responder ${unitId} to Incident ${id1}...`);
    await axios.post(
      `${API_URL}/dispatch/assign`,
      { incidentId: id1, agencyId: 1, unitId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    console.log('SUCCESS: First assignment completed.');
    await delay(1000);

    // 5. Assign to Incident 2 (Should Fail)
    console.log(`Attempting to assign Responder ${unitId} to Incident ${id2} (Should Fail)...`);
    try {
      await axios.post(
        `${API_URL}/dispatch/assign`,
        { incidentId: id2, agencyId: 1, unitId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      console.error('FAILURE: Second assignment succeeded but should have failed!');
      process.exit(1);
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        console.log('SUCCESS: Second assignment failed with 400 as expected.');
        console.log('Error Message:', err.response.data.message);
      } else {
        console.error('FAILURE: Unexpected error:', err.message);
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error('Test Failed:', err.message);
    if (err.response) {
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

testAtomicAssignment();
