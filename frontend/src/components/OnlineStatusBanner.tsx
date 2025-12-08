import React from "react";

const OnlineStatusBanner: React.FC = () => {
  const [online, setOnline] = React.useState<boolean>(navigator.onLine);

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div className="w-full bg-warning text-black text-center text-xs py-2">
      Offline mode: actions will queue until connection returns.
    </div>
  );
};

export default OnlineStatusBanner;
