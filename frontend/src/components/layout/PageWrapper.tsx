import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { motion } from "framer-motion";

export default function PageWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#0A0F1A] text-slate-100">
      <div className={`${open ? "fixed inset-y-0 left-0 z-50" : ""}`}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <Topbar title={title} onToggleMenu={() => setOpen((p) => !p)} />
        <motion.div
          className="p-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
