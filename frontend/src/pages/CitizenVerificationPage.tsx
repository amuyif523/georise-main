import React, { useState } from "react";
import AppLayout from "../layouts/AppLayout";
import api from "../lib/api";

const CitizenVerificationPage: React.FC = () => {
  const [step, setStep] = useState<"FORM" | "OTP" | "DONE">("FORM");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpDemo, setOtpDemo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestVerification = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.post("/verification/request", { nationalId, phone });
      setOtpDemo(res.data.otpCodeDemo);
      setStep("OTP");
      setMessage("OTP generated. For demo purposes it's shown below.");
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to submit verification.");
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await api.post("/verification/confirm-otp", { otpCode: otp });
      setStep("DONE");
      setMessage("OTP confirmed. Await admin approval.");
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to confirm OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div>
          <p className="text-sm text-cyan-200">Citizen verification</p>
          <h1 className="text-2xl font-bold text-white">Verify your account</h1>
          <p className="text-slate-400 text-sm">
            Verified citizens gain trust and faster dispatch. Demo OTP is shown for testing.
          </p>
        </div>
        {message && <div className="alert alert-info text-sm">{message}</div>}

        {step === "FORM" && (
          <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-slate-200">National ID</span>
              </label>
              <input
                className="input input-bordered bg-slate-900 text-white"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-slate-200">Phone</span>
              </label>
              <input
                className="input input-bordered bg-slate-900 text-white"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <button className={`btn btn-primary ${loading ? "loading" : ""}`} onClick={requestVerification}>
              Request verification
            </button>
          </div>
        )}

        {step === "OTP" && (
          <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
            {otpDemo && (
              <div className="text-xs text-amber-300">
                Demo OTP (for academic test): <strong>{otpDemo}</strong>
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text text-slate-200">Enter OTP</span>
              </label>
              <input
                className="input input-bordered bg-slate-900 text-white"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <button className={`btn btn-primary ${loading ? "loading" : ""}`} onClick={confirmOtp}>
              Confirm OTP
            </button>
          </div>
        )}

        {step === "DONE" && (
          <div className="p-4 rounded-xl border border-green-500/40 bg-green-600/10 text-green-100">
            Verification request complete. Admin will review and approve soon.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CitizenVerificationPage;
