# Sequence Flows (Outline)

Citizen report

1. Citizen → Frontend wizard → POST /api/incidents (JWT)
2. Backend stores incident, sets geography, calls AI /classify
3. AI service returns category/severity → backend updates Incident + IncidentAIOutput
4. Agency map/analytics fetch updated data

Agency dispatch

1. Agency staff → map → PATCH /api/incidents/:id/assign/respond/resolve
2. Backend updates status + audit log
3. Frontend polls/refreshes map/list

Admin approval

1. Admin → pending agencies → PATCH /api/admin/agencies/:id/approve
2. Admin can PATCH boundary with GeoJSON → saved as polygon geography
3. Audit log recorded
