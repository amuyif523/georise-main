import axios from 'axios';
import * as fs from 'fs';

const API_URL = 'http://localhost:4000/api';
// simple delay
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const LOG_FILE = 'c:/Users/Amanuel/Desktop/georise-main/backend/precheck_status_DEBUG.txt';

async function verifyRecommendationFiltering() {
  try {
    try {
      fs.writeFileSync(LOG_FILE, 'STARTING\n');
      fs.appendFileSync(LOG_FILE, 'APPEND WORKS\n');
    } catch (e: any) {
      console.error('FS WRITE ERROR:', e.message);
    }

    // Health Check
    try {
      fs.appendFileSync(LOG_FILE, `Checking health at ${API_URL.replace('/api', '')}...\n`);
      await axios.get(API_URL.replace('/api', ''));
      fs.appendFileSync(LOG_FILE, 'Health Check: OK\n');
    } catch (e: any) {
      fs.appendFileSync(LOG_FILE, `Health Check Failed: ${e.message}\n`);
      // Continue anyway to try API
    }

    // 1. Setup Staff (Dispatcher)
    fs.appendFileSync(LOG_FILE, 'Setup Staff...\n');
    const staffEmail = `dispatcher-filter-${Date.now()}@example.com`;

    fs.appendFileSync(LOG_FILE, `Registering Staff: ${staffEmail}\n`);
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: staffEmail,
        password: 'password123',
        fullName: 'Dispatcher Filter',
        role: 'AGENCY_STAFF',
        agencyId: 1,
      });
      fs.appendFileSync(LOG_FILE, 'Staff Registered.\n');
    } catch (e: any) {
      fs.appendFileSync(LOG_FILE, `Register failed (maybe exists): ${e.message}\n`);
    }

    fs.appendFileSync(LOG_FILE, 'Logging in Staff...\n');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: staffEmail,
      password: 'password123',
    });
    const token = loginRes.data.token;
    fs.appendFileSync(LOG_FILE, 'Dispatcher logged in.\n');

    // 2. Create Responder A (AVAILABLE)
    fs.appendFileSync(LOG_FILE, 'Creating Responder A...\n');
    const respAEmail = `resp-a-${Date.now()}@example.com`;

    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: respAEmail,
        password: 'password123',
        fullName: 'Responder A (Avail)',
        role: 'RESPONDER',
        agencyId: 1,
      });
      fs.appendFileSync(LOG_FILE, 'Responder A Registered.\n');
    } catch (e: any) {
      fs.appendFileSync(LOG_FILE, `Resp A reg err: ${e.message}\n`);
    }

    fs.appendFileSync(LOG_FILE, 'Logging in Responder A...\n');
    const respALogin = await axios.post(`${API_URL}/auth/login`, {
      email: respAEmail,
      password: 'password123',
    });
    fs.appendFileSync(LOG_FILE, 'Responder A Logged In.\n');

    // Set to AVAILABLE
    fs.appendFileSync(LOG_FILE, 'Fetching Responder A Profile...\n');
    const meA = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${respALogin.data.token}` },
    });
    const userA = meA.data.user;

    fs.appendFileSync(LOG_FILE, `DEBUG: UserA=${JSON.stringify(userA, null, 2)}\n`);

    const idA = userA.responders && userA.responders[0] ? userA.responders[0].id : null;
    if (!idA) throw new Error('Responder A ID not found on user profile');

    await axios.patch(
      `${API_URL}/responders/${idA}`,
      { status: 'AVAILABLE', latitude: 9.0, longitude: 38.0 },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    fs.appendFileSync(LOG_FILE, `Responder A [ID: ${idA}] is AVAILABLE.\n`);

    // Pre-check
    try {
      const checkA = await axios.get(`${API_URL}/responders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = checkA.data.responders;
      const ra = list.find((r: any) => r.id === idA);

      if (!ra) {
        fs.appendFileSync(LOG_FILE, 'PRE-CHECK FAIL: Responder A not found in list\n');
      } else {
        fs.appendFileSync(
          LOG_FILE,
          `PRE-CHECK: Responder A matched. Status=${ra.status}, Agency=${ra.agencyId}, Lat=${ra.latitude}\n`,
        );
      }
    } catch (e: any) {
      fs.appendFileSync(LOG_FILE, `PRE-CHECK ERROR: ${e.message}\n`);
    }

    // 3. Create Responder B (BUSY)
    const respBEmail = `resp-b-${Date.now()}@example.com`;
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: respBEmail,
        password: 'password123',
        fullName: 'Responder B (Busy)',
        role: 'RESPONDER',
        agencyId: 1,
      });
    } catch (e: any) {
      fs.appendFileSync(LOG_FILE, `Resp B reg err: ${e.message}\n`);
    }

    const respBLogin = await axios.post(`${API_URL}/auth/login`, {
      email: respBEmail,
      password: 'password123',
    });
    const meB = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${respBLogin.data.token}` },
    });
    const userB = meB.data.user;
    const idB = userB.responders && userB.responders[0] ? userB.responders[0].id : null;

    // Set to ASSIGNED/BUSY
    await axios.patch(
      `${API_URL}/responders/${idB}`,
      { status: 'ASSIGNED', latitude: 9.0, longitude: 38.0 },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    fs.appendFileSync(LOG_FILE, `Responder B [ID: ${idB}] is ASSIGNED.\n`);

    // 4. Create Incident
    const inc = await axios.post(
      `${API_URL}/incidents`,
      {
        title: 'Filter Test',
        description: 'Testing recommendation filter',
        latitude: 9.0,
        longitude: 38.0,
        category: 'ACCIDENT',
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const incidentId = inc.data.incident.id;
    fs.appendFileSync(LOG_FILE, `Incident ${incidentId} created.\n`);

    await delay(1000); // Allow async indexing

    // 5. Get Recommendations
    fs.appendFileSync(LOG_FILE, `Getting recommendations for Incident ${incidentId}...\n`);
    const recRes = await axios.get(`${API_URL}/dispatch/recommend/${incidentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const candidates = recRes.data; // Array of DispatchCandidate
    fs.appendFileSync(LOG_FILE, `Received ${candidates.length} candidates.\n`);

    const foundA = candidates.find((c: any) => c.unitId === idA);
    const foundB = candidates.find((c: any) => c.unitId === idB);

    if (foundA) {
      fs.appendFileSync(LOG_FILE, 'SUCCESS: Responder A (Available) found in recommendations.\n');
    } else {
      fs.appendFileSync(LOG_FILE, `FAILURE: Responder A (Available) [ID: ${idA}] NOT found.\n`);
      // fs.appendFileSync(LOG_FILE, `Candidates: ${JSON.stringify(candidates.map((c: any) => ({agency: c.agencyId, unit: c.unitId})), null, 2)}\n`);
      process.exit(1);
    }

    if (!foundB) {
      fs.appendFileSync(LOG_FILE, 'SUCCESS: Responder B (Assigned) correctly excluded.\n');
    } else {
      fs.appendFileSync(
        LOG_FILE,
        'FAILURE: Responder B (Assigned) WAS found in recommendations!\n',
      );
      process.exit(1);
    }

    fs.appendFileSync(LOG_FILE, 'Verification Passed.\n');
  } catch (err: any) {
    try {
      fs.appendFileSync(LOG_FILE, `FATAL ERROR: ${err.message}\n`);
      if (err.response) {
        fs.appendFileSync(
          LOG_FILE,
          `Status: ${err.response.status}\nData: ${JSON.stringify(err.response.data, null, 2)}\n`,
        );
      }
    } catch (e) {}
    process.exit(1);
  }
}

verifyRecommendationFiltering();
