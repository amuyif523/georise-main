# GIS Module Summary

- PostGIS geography(Point,4326) for Incident.location; optional polygon boundary for Agency.boundary.
- Indexes: GIST on location (from earlier sprint), btree on createdAt/status (added).
- Queries:
  - ST_DWithin for nearby search.
  - ST_ClusterKMeans for hotspots.
  - Heatmap points via ST_X/ST_Y(location) and severity as weight.
  - Boundary update: ST_GeomFromGeoJSON + ST_SetSRID.
- Frontend: Leaflet + clustering + heat layer; admin boundary drawing via leaflet-draw.
