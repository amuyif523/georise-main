import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-base-300 flex flex-col">
      {/* Navbar */}
      <div className="navbar bg-base-100/50 backdrop-blur fixed top-0 z-50 px-4">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl gap-2 font-display font-bold text-primary tracking-wider">
            <Shield className="w-6 h-6" />
            GEORISE
          </a>
        </div>
        <div className="flex-none flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="btn btn-ghost px-4 py-2 min-h-0 h-auto text-sm hidden sm:inline-flex"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            className="btn btn-primary px-4 py-2 min-h-0 h-auto text-sm"
          >
            Register
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="hero min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
        <div className="hero-content text-center z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error/10 text-error border border-error/20 mb-6 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-error" />
              <span className="text-xs font-bold tracking-wider">SYSTEM ACTIVE</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-display mb-6 tracking-tight">
              Rapid Incident <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Response Network
              </span>
            </h1>
            <p className="py-6 text-lg opacity-70 max-w-lg mx-auto leading-relaxed">
              Advanced geospatial coordination platform for emergency response and civic management.
              Submit reports instantly, no account required for emergencies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
              <button
                onClick={() => navigate('/report')}
                className="btn btn-error btn-lg shadow-lg shadow-error/20 group"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                Report Incident
                <ArrowRight className="w-4 h-4 ml-2 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => navigate('/login')} className="btn btn-outline btn-lg">
                Access Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
