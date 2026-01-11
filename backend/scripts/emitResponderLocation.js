#!/usr/bin/env node
/**
 * Simple helper to stream responder location updates over Socket.IO for demos/tests.
 *
 * Usage:
 *   RESPONDER_TOKEN=<jwt> node scripts/emitResponderLocation.js <lat1> <lng1> [<lat2> <lng2> ...]
 *
 * Env vars:
 *   WS_URL            websocket base (default http://localhost:4000)
 *   RESPONDER_TOKEN   JWT for a responder-linked user (required)
 *   INTERVAL_MS       delay between points (default 2000ms)
 *
 * Example:
 *   RESPONDER_TOKEN=eyJ... node scripts/emitResponderLocation.js 8.99 38.79 8.991 38.791 8.992 38.792
 */

import { io } from 'socket.io-client';

const WS_URL = process.env.WS_URL || 'http://localhost:4000';
const TOKEN = process.env.RESPONDER_TOKEN;
const INTERVAL = Number(process.env.INTERVAL_MS || 2000);

if (!TOKEN) {
  console.error('RESPONDER_TOKEN is required (JWT for a responder user).');
  process.exit(1);
}

const args = process.argv.slice(2).map(Number);
if (args.length < 2 || args.length % 2 !== 0) {
  console.error('Provide coordinates as pairs: <lat1> <lng1> [<lat2> <lng2> ...]');
  process.exit(1);
}

const points = [];
for (let i = 0; i < args.length; i += 2) {
  points.push({ lat: args[i], lng: args[i + 1] });
}

console.log(`Connecting to ${WS_URL} as responder, streaming ${points.length} points...`);
const socket = io(WS_URL, { auth: { token: TOKEN }, transports: ['websocket'] });

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
  let idx = 0;
  const timer = setInterval(() => {
    const point = points[idx];
    socket.emit('responder:locationUpdate', point);
    console.log(`Sent #${idx + 1}:`, point);
    idx += 1;
    if (idx >= points.length) {
      clearInterval(timer);
      console.log('Done streaming points; disconnecting in 1s...');
      setTimeout(() => socket.disconnect(), 1000);
    }
  }, INTERVAL);
});

socket.on('connect_error', (err) => {
  console.error('Socket error:', err.message);
  process.exit(1);
});
