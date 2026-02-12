# Responder System Operations Guide

## Overview

The Responder System is a critical component of the Georise platform, facilitating real-time coordination between the Dispatch Center and field units.

## Key Features

### 1. Connection Heartbeat

- **Mechanism**: Responders emit a heartbeat signal with every location update.
- **Silent Failure Detection**: The backend monitors `lastSeenAt`. If a responder is silent for > 5 minutes, their status is automatically set to `OFFLINE`.
- **Visualization**: Dispatchers see updated statuses on the Agency Map in real-time.

### 2. Trajectory Tracking

- **Breadcrumbs**: The Agency Map displays a faint trail of the last 5 reported locations for each responder.
- **Utility**: Helps dispatchers understand movement patterns and direction of travel.

### 3. Spatial Jitter Filter

- **Logic**: Responder App only sends location updates if:
  - Movement > 15 meters OR
  - Time elapsed > 60 seconds.
- **Benefit**: Reduces map marker "dancing" and saves battery/bandwidth.

### 4. Interactive Assignments

- **Flow**:
  1. Dispatcher assigns incident.
  2. Responder receives Push Notification & In-App Alert.
  3. Responder must explicit "Accept" or "Decline".
  4. If Declined, the system auto-recommends the next best candidate.

## Troubleshooting

### Responder Not Showing on Map

- Check if `lastSeenAt` is updating in DB.
- Verify WebSocket connection in Responder App (Green dot).

### Push Notifications Not Delivering

- Inspect `PushSubscription` table for valid endpoint.
- Verify VAPID keys in `.env`.
