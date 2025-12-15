import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../lib/socket";
import api from "../lib/api";

const NotificationManager: React.FC = () => {
  const { user } = useAuth();

  // Track location
  useEffect(() => {
    if (!user) return;

    const sendLocation = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      // Debounce or throttle could be good here, but for now we rely on watchPosition's behavior
      api.post("/users/location", { lat: latitude, lng: longitude }).catch(console.error);
    };

    if ("geolocation" in navigator) {
      // Send immediately
      navigator.geolocation.getCurrentPosition(sendLocation, console.error);
      
      // Watch for changes
      const watchId = navigator.geolocation.watchPosition(sendLocation, console.error, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000
      });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user]);

  // Listen for alerts
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    interface AlertData {
      title: string;
      message: string;
    }

    const handleAlert = (data: AlertData) => {
      console.log("Received alert:", data);
      
      // Browser Notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(data.title, { 
            body: data.message,
            icon: "/icons/alert.png" // Assuming icon exists or browser default
        });
      } else {
        // Fallback to alert
        alert(`⚠️ ${data.title}\n${data.message}`);
      }
    };

    socket.on("alert:proximity", handleAlert);
    return () => {
      socket.off("alert:proximity", handleAlert);
    };
  }, [user]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return null;
};

export default NotificationManager;
