import axios from 'axios';

const API_URL = 'http://localhost:4000/api';
const TOTAL_REPORTS = 10000;
const CONCURRENCY = 100;

async function runTest() {
  console.log(`🚀 Starting Chaos Test: ${TOTAL_REPORTS} reports with concurrency ${CONCURRENCY}`);

  let token = '';
  try {
    // Try to login - ensure this user exists in your seed
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'citizen@example.com',
      password: 'Password123!',
    });
    token = loginRes.data.token;
  } catch (err) {
    console.error(
      'Failed to login for test. Make sure backend is running and seed data is present.',
    );
    return;
  }

  const categories = ['FIRE', 'MEDICAL', 'POLICE', 'CRIME'];
  const reports = Array.from({ length: TOTAL_REPORTS }).map((_, i) => ({
    title: `Chaos Incident #${i}`,
    description: `Automated load test report generated at ${new Date().toISOString()}`,
    latitude: 9.03 + (Math.random() - 0.5) * 0.1,
    longitude: 38.74 + (Math.random() - 0.5) * 0.1,
    category: categories[Math.floor(Math.random() * categories.length)],
  }));

  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  const worker = async () => {
    while (reports.length > 0) {
      const report = reports.pop();
      if (!report) break;
      try {
        await axios.post(`${API_URL}/incidents`, report, {
          headers: { Authorization: `Bearer ${token}` },
        });
        completed++;
        if (completed % 500 === 0) {
          console.log(`✅ Progress: ${completed}/${TOTAL_REPORTS}`);
        }
      } catch (err) {
        failed++;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker()));

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n🏁 Chaos Test Finished:`);
  console.log(`- Total Time: ${duration.toFixed(2)}s`);
  console.log(`- Successful Reports: ${completed}`);
  console.log(`- Failed Reports: ${failed}`);
  console.log(`- Throughput: ${(completed / duration).toFixed(2)} reports/sec`);
}

runTest();
