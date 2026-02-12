import axios from 'axios';

const API_URL = 'http://127.0.0.1:4000/api';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  try {
    console.log('--- Starting Interactive Dispatch Flow Test ---');

    console.log('1. Logging in as Admin/Dispatcher...');
    const adminRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com', // Assuming seeded admin
      password: 'password123',
    });
    const adminToken = adminRes.data.token;
    console.log('   Admin logged in.');

    // 2. Create Incident
    console.log('2. Creating Incident...');
    const incidentRes = await axios.post(
      `${API_URL}/incidents`,
      {
        title: 'Test Incident for Acknowledge',
        description: 'Testing the acknowledge/decline workflow',
        latitude: 9.0,
        longitude: 38.7,
        category: 'Test',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    // Handle potentially different response structures
    const incidentId = incidentRes.data.incident
      ? incidentRes.data.incident.id
      : incidentRes.data.id;

    if (!incidentId) {
      console.error(
        'Failed to get incident ID. Response:',
        JSON.stringify(incidentRes.data, null, 2),
      );
      throw new Error('Incident ID is undefined');
    }
    console.log(`   Incident created: ID ${incidentId}`);

    // 3. Create Responder
    console.log('3. Setting up Responder...');
    const uniqueId = Date.now();
    const responderEmail = `responder_${uniqueId}@test.com`;
    const responderPassword = 'password123';
    const responderName = `Test Responder ${uniqueId}`;

    // Register responder user
    await axios
      .post(`${API_URL}/auth/register`, {
        email: responderEmail,
        password: responderPassword,
        fullName: responderName,
        role: 'AGENCY_STAFF', // Using AGENCY_STAFF with responder role
        phone: `+2519${uniqueId.toString().slice(-8)}`,
        agencyId: 1, // Assume Agency 1 exists
        staffRole: 'RESPONDER',
      })
      .catch((err) => {
        console.log(
          'Register check (might exist): ' + (err.response?.data?.message || err.message),
        );
      });

    // Login as new responder
    console.log('   Logging in as Responder...');
    const respLogin = await axios.post(`${API_URL}/auth/login`, {
      email: responderEmail,
      password: responderPassword,
    });
    const responderToken = respLogin.data.token;
    console.log(`   Responder logged in.`);

    // Identify Responder Profile ID
    console.log('   Identifying Responder Profile ID...');
    const meRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${responderToken}` },
    });

    let responderId: number | undefined;
    const user = meRes.data.user;

    // Try to find responder ID from user object path
    if (user.responders && user.responders.length > 0) {
      responderId = user.responders[0].id;
    } else if (user.agencyStaff && user.agencyStaff.responderId) {
      responderId = user.agencyStaff.responderId;
    }

    // If still not found, search via Admin API or Create one
    if (!responderId) {
      console.log('   Profile not found in auth/me. Checking via search...');
      // Use admin token to search
      const allResponders = await axios.get(`${API_URL}/responders?agencyId=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const list = allResponders.data.responders || allResponders.data;
      const myProfile = list.find((r: any) => r.userId === user.id);

      if (myProfile) {
        responderId = myProfile.id;
      } else {
        console.log('   Profile still not found. Creating new Responder Profile...');
        // Create profile manually via ADMIN token (since sometimes auto-creation on register might be skipped in some configs)
        const newResp = await axios.post(
          `${API_URL}/responders`,
          {
            name: responderName,
            type: 'POLICE', // Default
            status: 'AVAILABLE',
            agencyId: 1,
            userId: user.id,
            latitude: 9.0,
            longitude: 38.7,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        responderId = newResp.data.id;
      }
    }

    if (!responderId) {
      throw new Error('Could not determine/create Responder Profile ID.');
    }
    console.log(`   Identified Responder ID: ${responderId}`);

    // Set status and location to be sure
    await axios
      .patch(
        `${API_URL}/responders/${responderId}`,
        {
          status: 'AVAILABLE',
          latitude: 9.0,
          longitude: 38.7,
        },
        { headers: { Authorization: `Bearer ${responderToken}` } },
      )
      .catch((e) => console.log('   Status update warning: ' + e.message));

    // 4. Assign Incident to ME
    console.log('4. Assigning Incident...');
    await axios.post(
      `${API_URL}/dispatch/assign`,
      {
        incidentId,
        agencyId: 1,
        unitId: responderId,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    console.log('   Assigned.');

    // 5. Verify Acknowledgment (Should be null initially)
    let check = await axios.get(`${API_URL}/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (check.data.incident) check.data = check.data.incident; // Handle wrapped response

    if (check.data.acknowledgedAt) throw new Error('acknowledgedAt should be null initially!');
    console.log('   Verified: acknowledgedAt is null.');

    // 6. Acknowledge as Responder
    console.log('6. Acknowledging assignment...');
    await axios.post(
      `${API_URL}/dispatch/acknowledge`,
      {
        incidentId,
      },
      { headers: { Authorization: `Bearer ${responderToken}` } },
    );
    console.log('   Acknowledged successfully.');

    // 7. Verify Timestamp
    check = await axios.get(`${API_URL}/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (check.data.incident) check.data = check.data.incident;

    if (!check.data.acknowledgedAt) throw new Error('acknowledgedAt NOT set!');
    console.log(`   Verified: acknowledgedAt is ${check.data.acknowledgedAt}`);

    console.log('--- Test Complete: SUCCESS ---');
  } catch (err: any) {
    console.error('Test Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
