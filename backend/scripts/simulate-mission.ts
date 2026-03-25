import 'dotenv/config';

import { io, type Socket } from 'socket.io-client';
import * as turf from '@turf/turf';
import { ResponderStatus } from '@prisma/client';
import prisma from '../src/prisma';
import { authService } from '../src/modules/auth/auth.service';

const WS_URL = process.env.WS_URL || 'http://localhost:4000';
const STEP_COUNT = 20;
const STEP_INTERVAL_MS = 3000;
const ARRIVAL_THRESHOLD_METERS = 20;

type SimulationPoint = {
  lat: number;
  lng: number;
};

const usage = () => {
  console.error('Usage: npm run simulate -- <responderEmail> <incidentId>');
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatMeters = (meters: number) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)}km`;
  }
  return `${Math.round(meters)}m`;
};

const interpolatePath = (start: SimulationPoint, end: SimulationPoint, steps: number) => {
  const points: SimulationPoint[] = [];

  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
    });
  }

  return points;
};

const distanceMeters = (from: SimulationPoint, to: SimulationPoint) =>
  turf.distance(turf.point([from.lng, from.lat]), turf.point([to.lng, to.lat]), {
    units: 'kilometers',
  }) * 1000;

const connectResponderSocket = async (token: string) => {
  const socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Socket connection timed out for ${WS_URL}`));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeoutId);
      resolve();
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });

  return socket;
};

const updateResponderPosition = async (
  responderId: number,
  point: SimulationPoint,
  status: ResponderStatus,
  socket: Socket,
) => {
  const now = Date.now();
  const responder = await prisma.responder.findUnique({
    where: { id: responderId },
    select: { breadcrumbs: true },
  });

  const breadcrumbs = Array.isArray(responder?.breadcrumbs) ? [...responder.breadcrumbs] : [];
  breadcrumbs.push([point.lng, point.lat, now]);

  await prisma.responder.update({
    where: { id: responderId },
    data: {
      latitude: point.lat,
      longitude: point.lng,
      status,
      lastSeenAt: new Date(now),
      breadcrumbs: breadcrumbs.slice(-500),
    },
  });

  socket.emit('responder:locationUpdate', {
    lat: point.lat,
    lng: point.lng,
    status,
  });
};

const main = async () => {
  const [responderEmail, incidentIdArg] = process.argv.slice(2);
  if (!responderEmail || !incidentIdArg) {
    usage();
    process.exit(1);
  }

  const incidentId = Number(incidentIdArg);
  if (!Number.isInteger(incidentId) || incidentId <= 0) {
    console.error('incidentId must be a positive integer.');
    process.exit(1);
  }

  const responder = await prisma.responder.findFirst({
    where: {
      user: {
        email: responderEmail,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          role: true,
          tokenVersion: true,
          mustChangePassword: true,
          agencyStaff: {
            select: {
              agencyId: true,
            },
          },
        },
      },
    },
  });

  if (!responder || !responder.user) {
    throw new Error(`No responder-linked user found for ${responderEmail}`);
  }

  if (responder.latitude == null || responder.longitude == null) {
    throw new Error(`Responder ${responder.name} has no current coordinates in the database`);
  }

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      title: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!incident) {
    throw new Error(`Incident ${incidentId} was not found`);
  }

  if (incident.latitude == null || incident.longitude == null) {
    throw new Error(`Incident ${incidentId} has no coordinates`);
  }

  const start = { lat: responder.latitude, lng: responder.longitude };
  const destination = { lat: incident.latitude, lng: incident.longitude };
  const points = interpolatePath(start, destination, STEP_COUNT);
  const token = authService.createAccessToken(
    responder.user.id,
    responder.user.role,
    responder.user.tokenVersion ?? 0,
    responder.user.agencyStaff?.agencyId ?? responder.agencyId,
    responder.user.mustChangePassword,
  );

  let socket: Socket | null = null;

  try {
    socket = await connectResponderSocket(token);
    console.log(
      `[SIM] Starting mission simulation for ${responder.name} toward incident #${incident.id} (${incident.title}).`,
    );

    for (const point of points) {
      const remainingMeters = distanceMeters(point, destination);
      const status =
        remainingMeters <= ARRIVAL_THRESHOLD_METERS ? ResponderStatus.ON_SCENE : ResponderStatus.EN_ROUTE;

      await updateResponderPosition(responder.id, point, status, socket);
      console.log(
        `[SIM] ${responder.name} is ${formatMeters(remainingMeters)} from ${incident.title}...`,
      );

      if (remainingMeters <= ARRIVAL_THRESHOLD_METERS) {
        console.log('[SIM] Responder has reached the destination.');
        return;
      }

      await sleep(STEP_INTERVAL_MS);
    }

    console.log('[SIM] Path exhausted before crossing the arrival threshold.');
  } finally {
    socket?.disconnect();
    await prisma.$disconnect();
  }
};

main().catch(async (err) => {
  console.error('[SIM] Mission simulation failed:', err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
