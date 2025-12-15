1) Citizen Features
1.1 Onboarding & Identity

Account creation

Phone number + OTP (primary, Ethiopia-friendly)

Optional email

Name, gender optional, age bracket optional

Home area (kebele / subcity optional)

Verification tiers (anti-abuse)

Tier 0: unverified (limited submissions/day)

Tier 1: phone verified (default)

Tier 2: ID verified (optional, for high trust)

Tier 3: trusted reporter (earned via reputation)

Consent + privacy

Consent screen for location use

Clear statement of how data is shared with agencies (only for dispatch)

Profile

Personal details

Emergency contacts

Medical info (optional): blood type, allergies, conditions (privacy controls)

1.2 Incident Reporting

Report types

Fire, Medical, Crime, Traffic Accident, Disaster, Infrastructure hazard, Other

Subcategories per type (e.g., Fire→building/vehicle/forest; Medical→injury/heart/birth)

Report input modes

Quick report (30 seconds): type + location + short text

Detailed report: add media, number of victims, weapon mention checkbox (careful UX), hazards

Location capture

Auto GPS with accuracy indicator

Manual pin drop + search landmark

“I’m not at the scene” toggle (reporting for someone else)

Location confidence score (GPS accuracy + user edits)

Media uploads

Photos (compressed)

Short video (optional, size-limited)

Audio note (optional)

Upload progress + retry (low network)

Safety UX

“Call emergency” quick action buttons

“Do not approach” warning banners for fire/crime

AI assist (citizen-facing)

Suggest incident category while typing

Ask 1–3 follow-up questions to increase dispatch quality (“Is anyone bleeding?”, “Is fire spreading?”)

Show severity preview in plain language (“High urgency”)

Submission confirmation

Reference ID

“What happens next” timeline

Expected next update (ETA estimate if available)

Offline/low network behavior

Cache draft locally

“Queued upload” mode

SMS fallback spec (optional stretch): minimal report via SMS shortcode

1.3 Tracking & Notifications

My Reports

List with status chips: Submitted → Under Review → Verified → Dispatched → Resolved/Rejected

Filters: date, category, status

Report detail view: map + timeline + messages

Status timeline

Who changed status (system/agency)

Timestamps

Notes visible to citizen (sanitized)

Push notifications / SMS

Status changes

“Responder en route” (if enabled)

Safety alert near your location (geo-fenced)

Citizen messaging

“Add more info” channel for agencies to ask clarifying questions

Citizen can send extra photos/text after submission

Rate limit to prevent spam

1.4 Alerts & Community Safety

Proximity alerts

Nearby fire, riots, road closures, flood zones

Adjustable radius (1km/3km/5km)

Safety feed

Verified public incidents only (privacy protected)

Aggregated heatmap view (no exact home addresses)

Emergency guidance

Basic instructions based on incident type (first aid tips, fire evacuation guidance)

1.5 Reputation & Abuse Prevention (Citizen)

Reputation scoring

Verified helpful reports increase score

False reports decrease score

Rate limits

New accounts limited reports/day

Progressive trust unlocks more

Report flagging

Citizen can flag public alerts as inaccurate

Blocklist

Admin/system can suspend or shadow-ban abusive users

2) Agency Staff Features (Police/Fire/EMS/Disaster)
2.1 Agency Portal Core

Login

Role-specific login path (Agency Staff)

MFA optional (OTP)

Role types within agency

Dispatcher

Field Responder

Supervisor

Analyst (read-only)

Shift management

Start/end shift

Availability status: Available/Busy/Off-duty

Auto assignment respects shifts

2.2 Incident Intake & Verification

Incident queue views

New (unverified)

Awaiting verification

Verified

Assigned

In progress

Resolved

Rejected/False

Verification tools

View citizen trust tier + past reliability

Media preview + metadata (time, location accuracy)

Duplicate detection suggestions (AI + spatial clustering)

“Request more info” button (message citizen)

“Call citizen” (optional, if policy allows)

Decision outcomes

Verify

Reject (false report / insufficient info)

Merge with existing incident

Escalate to supervisor

2.3 Dispatch & Resource Assignment

Assignment

Assign to unit/team (ambulance, patrol, fire truck)

Attach resources list (vehicles, staff count)

Priority override (manual)

Smart routing (GIS)

Recommend closest available unit by road distance (later: traffic-aware)

Recommend staging points

SLA timers

Response time targets per category/severity

Escalation if SLA breached

2.4 Live Map Operations

Unified GIS map

Incident pins color-coded by severity + status

Layers: hospitals, police stations, fire stations, risk zones

Jurisdiction boundaries per agency

Filtering

Time window

Severity range

Incident type

Subcity/kebele

Verified only toggle

Clustering + heatmaps

Cluster at zoomed-out levels

Heatmap for last 24h/7d/30d

Incident detail drawer

Timeline, chat, resources assigned, notes, citizen media

2.5 Multi-Agency Coordination

Cross-agency incident

One incident can involve multiple agencies (fire+police+ems)

Shared incident log with role-based visibility

Inter-agency messaging

Threaded updates per incident

@mention roles (Supervisor)

Handoffs

Transfer ownership to another agency

Escalate to city disaster unit

Unified status language

Standard workflow states shared across agencies

2.6 Field Responder Tools (Mobile-first)

Responder app mode (or responsive portal)

Assigned incidents list

Navigation link

One-tap status updates:

En route

Arrived

Needs backup

Resolved

Add notes + photos (evidence/progress)

Responder safety

Panic button (internal)

“Need backup” broadcast within agency

2.7 Analytics for Agencies

Performance dashboards

Response time distribution

SLA adherence

Top incident types

Peak hours

Operational insights

Hotspots by type

Repeat locations

Resource utilization (unit busy time)

Export

CSV export by timeframe + filters (admin-controlled)

3) Municipality / Government Features
3.1 City Command Dashboard

Citywide overview

Total incidents today, verified, unresolved

Heatmap + trend lines

Policy view

Agency readiness (on shift count)

High-risk zones active alerts

Crisis mode

Disaster mode toggle (earthquake/flood/riot)

Broadcast public alerts

Override dispatch rules

3.2 Urban Planning & Risk Analytics

Infrastructure hazard tracking

Road damage, fallen poles, open manholes

Categorize as “non-emergency” tasks but still map

Spatial analysis

Buffer zones around schools/hospitals

Incident density vs population proxies

Reports

Monthly PDF/CSV outputs

Ward/subcity comparisons

4) System Admin Features
4.1 Administration Console

User management

Citizens: view trust, suspend, reset, verify tier change

Agency users: add/disable, assign roles, shift permissions

Agency management

Create agencies: Police, Fire, EMS, Traffic, Disaster

Assign jurisdictions (GeoJSON polygons)

Configure operating hours, SLA rules

Incident taxonomy

Category/subcategory management

Severity mapping per category

Audit logs

Every state change logged (who/when/what)

Exportable for governance

4.2 Policy & Safety Configuration

Privacy rules

What citizen data agencies can see

Public feed redaction rules (blur location)

Anti-abuse

Rate limit configs by tier

Suspicious pattern detection thresholds

Notification settings

SMS provider integration settings

Templates management

4.3 Platform Health & Ops

System monitoring

Service uptime

AI service latency

DB health

Backups

Daily backup schedule

Restore testing checklist

Incident retention policy

Auto-delete sensitive media after X days (policy-based)

5) AI & Intelligence Features
5.1 Incident Classification (NLP)

Input

Citizen text + optional tags + metadata

Output

Category label(s)

Confidence score

Recommended follow-up questions

Human-in-the-loop

Agency can override category

Overrides stored for retraining

5.2 Severity Scoring

Signals

Keyword patterns (“bleeding”, “gun”, “explosion”)

Citizen trust tier

Location context (near schools, fuel stations)

Time-of-day risk weighting (optional)

Outputs

Severity 1–5

“Urgency reason” explanation for dispatchers

5.3 Duplicate & Fraud Detection

Duplicate grouping

Same place/time cluster detection

Merge suggestion UI

Fraud signals

High frequency same device

Location spoof patterns

Repeated rejected reports

5.4 GIS Intelligence

Hotspot clustering

K-means or DBSCAN on incidents

Heatmaps

Time-window heatmap tiles

Jurisdiction logic

Determine correct agency based on polygon containment

Suggested dispatch

Closest unit selection (later: traffic-aware)

6) Core Platform Features (Cross-Cutting)
6.1 Workflow Engine

Incident states

Submitted

Under Review

Verified

Dispatched

En route

On scene

Resolved

Rejected

Merged

State rules

Who can change what

Required fields for state transitions

Auto-actions on transitions (notifications)

6.2 Notifications System

Event-based triggers

Status change

New nearby alert

SLA breach escalation

Channels

Push (web/mobile)

SMS fallback

Email optional

Template engine

Multi-language support (English/Amharic later)

6.3 Data Privacy & Compliance

Redaction

Citizen phone hidden from non-authorized staff

Public feed location fuzzing

Access boundaries

Agency sees only its jurisdiction unless escalated

Auditability

Every data access logged (admin-visible)

6.4 Performance & Reliability

Caching

Map tiles caching

Recent incident caching

Low bandwidth

Aggressive media compression

Lazy load heavy modules

Fail-safe modes

AI service down → fallback to manual category selection

7) UI Feature Requirements (Aligned with your dark-cyber UI)
7.1 Universal UI Components

Role-based nav

Status chips (color-coded)

Map drawer panel

Timeline component

Notification toast system

Cyber-grid backgrounds + subtle glow accents

Accessibility: high contrast + scalable text

7.2 Dashboards (Per Role)

Citizen: Report button + My Reports + Alerts feed

Agency: Queue + Map + Incident drawer + SLA timers

Admin: Tables + audit logs + system health

8) “Stretch / V2” Features (Optional but powerful)

Live unit tracking (GPS responders)

Traffic-aware routing via external APIs or local models

CCTV/sensor ingestion (future)

Voice hotline integration

Multilingual (Amharic full support)

Anonymous reporting mode with restrictions

Public transparency dashboard (aggregated only)