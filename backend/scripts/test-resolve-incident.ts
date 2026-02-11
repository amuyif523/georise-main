// @ts-nocheck
import axios from 'axios';

const API_URL = 'http://127.0.0.1:4000/api';
// Use seeded credentials directly
const AGENCY_USER = { email: 'police@georise.com', password: 'password123' };

const log = (msg) => console.log(`[TEST] ${msg}`);
const error = (msg) => {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
};

async function testResolve() {
  try {
    log('1. Authenticating Agency Staff (Police)...');
    try {
      const authRes = await axios.post(`${API_URL}/auth/login`, AGENCY_USER);
      const token = authRes.data.token;
      var headers = { Authorization: `Bearer ${token}` }; // var to be accessible outside
      log('Authentication successful.');
    } catch (authErr) {
      console.error('Auth Failed:', authErr);
      if (authErr.response) console.error('Response:', authErr.response.data);
      throw new Error(`Authentication failed: ${authErr.message}`);
    }

    // 2. Get a responder (should see own agency's responders)
    log('2. Fetching Responders...');
    const respRes = await axios.get(`${API_URL}/responders`, { headers });
    let responders = respRes.data.responders;

    if (!responders || !responders.length) {
      log('No responders found. Creating a temporary test responder...');
      // Get Agency ID from /auth/me or assume from user context if possible, but let's fetch 'me'
      const meRes = await axios.get(`${API_URL}/auth/me`, { headers });
      const agencyId = meRes.data.user.agencyStaff?.agencyId;

      if (!agencyId) error('Could not determine agency ID for dispatcher.');

      const newResp = await axios.post(
        `${API_URL}/responders`,
        {
          name: 'Auto-Test Unit ' + Date.now(),
          type: 'POLICE',
          agencyId: agencyId,
          status: 'AVAILABLE',
        },
        { headers },
      );
      responders = [newResp.data];
    }

    let responder = responders[0];
    log(`Using Responder: ${responder.name} (ID: ${responder.id}) Status: ${responder.status}`);

    // Ensure responder is AVAILABLE
    if (responder.status !== 'AVAILABLE') {
      log('Resetting responder to AVAILABLE...');
      await axios.patch(
        `${API_URL}/responders/${responder.id}`,
        { status: 'AVAILABLE' },
        { headers },
      );
    }

    // 3. Create Incident
    log('3. Creating Incident...');
    const incRes = await axios.post(
      `${API_URL}/incidents`,
      {
        title: 'Test Resolve Incident ' + Date.now(),
        description: 'This is a test incident description for verification purposes.',
        latitude: 9.03,
        longitude: 38.74,
        priority: 'HIGH',
      },
      { headers },
    );

    const incidentId = incRes.data.incident.id;
    log(`Incident Created: ${incidentId}`);

    // 4. Assign Responder
    log(`4. Assigning Responder ${responder.id} (Agency: ${responder.agencyId})...`);
    await axios.post(
      `${API_URL}/dispatch/assign`,
      {
        incidentId,
        agencyId: responder.agencyId,
        unitId: responder.id,
      },
      { headers },
    );

    // Verify Status is ASSIGNED
    // We need to fetch again to see updated status
    const checkResp = await axios.get(`${API_URL}/responders?search=${responder.name}`, {
      headers,
    });
    const updatedResp = checkResp.data.responders.find((r) => r.id === responder.id);
    log(`Responder Status after assignment: ${updatedResp?.status}`);

    // 5. Resolve Incident
    log('5. Resolving Incident...');
    await axios.patch(`${API_URL}/incidents/${incidentId}/resolve`, {}, { headers });
    log('Incident Resolved via API.');

    // 6. Verify Final State
    const verifyResp = await axios.get(`${API_URL}/responders?search=${responder.name}`, {
      headers,
    });
    const finalResp = verifyResp.data.responders.find((r) => r.id === responder.id);
    log(`Responder Status after resolve: ${finalResp?.status}`);

    if (finalResp?.status === 'AVAILABLE') {
      log('SUCCESS: Responder released to AVAILABLE.');
      process.exit(0);
    } else {
      error(`FAILED: Responder status is ${finalResp?.status}`);
    }
  } catch (e) {
    if (e.response) {
      console.error(
        `[ERROR] Request failed with status ${e.response.status} ${e.response.statusText}`,
      );
      console.error('Response Headers:', JSON.stringify(e.response.headers, null, 2));
      console.error(
        'Response Data:',
        typeof e.response.data === 'object'
          ? JSON.stringify(e.response.data, null, 2)
          : e.response.data,
      );
    } else {
      console.error(`[ERROR] ${e.message}`);
    }
    process.exit(1);
  }
}

testResolve();
