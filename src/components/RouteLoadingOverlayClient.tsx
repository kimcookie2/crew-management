"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteLoadingOverlayClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 450);
    return () => window.clearTimeout(t);
  }, [pathname, searchParams]);

  if (!show) return null;

  return (
    <div style={backdrop}>
      <div style={panel}>
        <div style={spinner} />
        <div style={{ fontWeight: 900, marginTop: 10 }}>불러오는 중…</div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.25)",
  zIndex: 9999,
  display: "grid",
  placeItems: "center",
};

const panel: React.CSSProperties = {
  background: "white",
  color: "black",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: "18px 18px",
  minWidth: 180,
  display: "grid",
  placeItems: "center",
  boxShadow: "0 10px 28px rgba(0,0,0,0.15)",
};

const spinner: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "4px solid #e5e7eb",
  borderTopColor: "#111827",
  animation: "spin 0.9s linear infinite",
};
