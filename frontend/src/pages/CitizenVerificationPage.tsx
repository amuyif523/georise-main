import React, { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import api from "../lib/api";

const CitizenVerificationPage: React.FC = () => {
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"FORM" | "OTP" | "DONE">("FORM");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [step]);

  const requestVerification = async () => {
    setLoading(true);
    try {
      const res = await api.post("/verification/request", { nationalId, phone });
      setMessage(`OTP generated (demo): ${res.data.otpCodeDemo ?? "Check SMS"}`);
      setStep("OTP");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || "Failed to submit verification");
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    setLoading(true);
    try {
      await api.post("/verification/confirm-otp", { otpCode: otp });
      setMessage("OTP confirmed. Awaiting admin approval.");
      setStep("DONE");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 citizen-card">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Verification</h2>
          <p className="text-sm text-slate-500 mb-4">
            Provide your national ID and phone number. This helps agencies trust and prioritize your reports.
          </p>
          {message && <div className="alert alert-info text-sm mb-3">{message}</div>}
          {step === "FORM" && (
            <div className="space-y-3">
              <label className="form-control">
                <span className="label-text text-slate-700">National ID</span>
                <input
                  className="input input-bordered"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-slate-700">Phone</span>
                <input
                  className="input input-bordered"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <button className={`btn btn-primary ${loading ? "loading" : ""}`} onClick={requestVerification}>
                Submit verification
              </button>
            </div>
          )}
          {step === "OTP" && (
            <div className="space-y-3">
              <label className="form-control">
                <span className="label-text text-slate-700">Enter OTP</span>
                <input className="input input-bordered" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </label>
              <button className={`btn btn-primary ${loading ? "loading" : ""}`} onClick={confirmOtp}>
                Confirm OTP
              </button>
            </div>
          )}
          {step === "DONE" && <p className="text-sm text-slate-700">Your verification is pending admin approval.</p>}
        </div>
        <div className="citizen-card">
          <h3 className="text-sm font-semibold mb-2 text-slate-900">Why verify?</h3>
          <ul className="text-xs text-slate-600 space-y-2">
            <li>• Verified users may get faster routing and fewer review steps.</li>
            <li>• Helps agencies trust location and contact info.</li>
            <li>• Your data is shared only with the agency handling your case.</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
};

export default CitizenVerificationPage;
