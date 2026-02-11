// @ts-nocheck
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import * as fs from 'fs';

const API_URL = 'http://localhost:4000/api';
const SOCKET_URL = 'http://localhost:4000';
const LOG_FILE = 'c:/Users/Amanuel/Desktop/georise-main/backend/socket_test_log.txt';

const log = (msg: string) => {
  try {
    fs.appendFileSync(LOG_FILE, `${msg}\n`);
  } catch (e) {
    console.error(msg);
  }
};

async function testSocketUpdates() {
  let dispatcherSocket: Socket | null = null;
  let responderSocket: Socket | null = null;

  try {
    fs.writeFileSync(LOG_FILE, 'STARTING SOCKET TEST\n');

    // 1. Setup Dispatcher
    const dispEmail = `disp-sock-${Date.now()}@example.com`;
    log(`Registering Dispatcher: ${dispEmail}`);
    await axios
      .post(`${API_URL}/auth/register`, {
        email: dispEmail,
        password: 'password123',
        fullName: 'Dispatcher Sock',
        role: 'AGENCY_STAFF',
        agencyId: 1,
      })
      .catch(() => {}); // might exist

    const dispLogin = await axios.post(`${API_URL}/auth/login`, {
      email: dispEmail,
      password: 'password123',
    });
    const dispToken = dispLogin.data.token;
    log('Dispatcher logged in.');

    // 2. Setup Responder
    const respEmail = `resp-sock-${Date.now()}@example.com`;
    log(`Registering Responder: ${respEmail}`);
    await axios
      .post(`${API_URL}/auth/register`, {
        email: respEmail,
        password: 'password123',
        fullName: 'Responder Sock',
        role: 'RESPONDER',
        agencyId: 1,
      })
      .catch(() => {});

    const respLogin = await axios.post(`${API_URL}/auth/login`, {
      email: respEmail,
      password: 'password123',
    });
    const respToken = respLogin.data.token;
    log('Responder logged in.');

    // Get Responder ID
    const meRes = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    const responderId = meRes.data.user.responders[0].id;
    log(`Responder ID: ${responderId}`);

    // 3. Connect Dispatcher Socket
    log('Connecting Dispatcher Socket...');
    dispatcherSocket = io(SOCKET_URL, {
      auth: { token: dispToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      dispatcherSocket!.on('connect', () => {
        log('Dispatcher Socket Connected.');
        resolve();
      });
      dispatcherSocket!.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('Dispatcher connect timeout')), 5000);
    });

    // 4. Connect Responder Socket
    log('Connecting Responder Socket...');
    responderSocket = io(SOCKET_URL, {
      auth: { token: respToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      responderSocket!.on('connect', () => {
        log('Responder Socket Connected.');
        resolve();
      });
      responderSocket!.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('Responder connect timeout')), 5000);
    });

    // 5. Setup Listener on Dispatcher
    const eventPromise = new Promise<void>((resolve, reject) => {
      dispatcherSocket!.on('responder:position', (payload) => {
        log(`RECEIVED responder:position: ${JSON.stringify(payload)}`);
        if (
          payload.responderId === responderId &&
          payload.status === 'ASSIGNED' &&
          payload.lat === 10.0
        ) {
          log('SUCCESS: Verified responder:position broadcast with correct data.');
          resolve();
        } else {
          log('Ignored mismatching event.');
        }
      });
      setTimeout(() => reject(new Error('Timeout waiting for responder:position')), 5000);
    });

    // 6. Emit location update from Responder
    log('Waiting 1s for server setup...');
    await new Promise((r) => setTimeout(r, 1000));
    log('Emitting responder:locationUpdate (lat=10.0, status=ASSIGNED)...');
    responderSocket.emit('responder:locationUpdate', {
      lat: 10.0,
      lng: 40.0,
      status: 'ASSIGNED',
    });

    await eventPromise;
    log('Test Passed.');
    process.exit(0);
  } catch (err: any) {
    log(`FATAL ERROR: ${err.message}`);
    if (err.response) log(JSON.stringify(err.response.data));
    process.exit(1);
  } finally {
    if (dispatcherSocket) dispatcherSocket.disconnect();
    if (responderSocket) responderSocket.disconnect();
  }
}

testSocketUpdates();
