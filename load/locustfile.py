import os
import random

from locust import HttpUser, between, task


class ApiUser(HttpUser):
    wait_time = between(1, 3)

    admin_token = None
    agency_token = None
    incident_id = None

    def on_start(self):
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        agency_email = os.getenv("AGENCY_EMAIL")
        agency_password = os.getenv("AGENCY_PASSWORD")

        if admin_email and admin_password:
            res = self.client.post(
                "/api/auth/login",
                json={"email": admin_email, "password": admin_password},
            )
            if res.status_code == 200:
                self.admin_token = res.json().get("token")

        if agency_email and agency_password:
            res = self.client.post(
                "/api/auth/login",
                json={"email": agency_email, "password": agency_password},
            )
            if res.status_code == 200:
                self.agency_token = res.json().get("token")

    @task(3)
    def health(self):
        self.client.get("/health")
        self.client.get("/api/system/health")

    @task(2)
    def admin_metrics(self):
        if not self.admin_token:
            return
        self.client.get(
            "/api/admin/metrics",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )

    @task(3)
    def agency_incidents(self):
        if not self.agency_token:
            return
        res = self.client.get(
            "/api/incidents?page=1&limit=5",
            headers={"Authorization": f"Bearer {self.agency_token}"},
        )
        if res.status_code == 200:
            incidents = res.json().get("incidents") or []
            if incidents:
                self.incident_id = random.choice(incidents).get("id")

    @task(1)
    def agency_timeline(self):
        if not self.agency_token or not self.incident_id:
            return
        self.client.get(
            f"/api/incidents/{self.incident_id}/timeline",
            headers={"Authorization": f"Bearer {self.agency_token}"},
        )
