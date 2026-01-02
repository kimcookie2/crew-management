"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function CrewNav({ crewId }: { crewId: string }) {
  const sb = supabaseBrowser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc("get_my_crew_role", { p_crew_id: crewId });
      if (!error) setIsAdmin(data === "admin");
    })();
  }, [crewId]);

  const items = useMemo(() => {
    const base = [
      { href: `/${crewId}/events`, label: "모임 달력" },
      { href: `/${crewId}/dashboard`, label: "활동현황" },
      { href: `/${crewId}/stats`, label: "활동통계" },
    ];

    if (isAdmin) {
      base.push({ href: `/${crewId}/events/new`, label: "모임등록" });
      base.push({ href: `/${crewId}/admin`, label: "크루관리" }); 
    }

    base.push({ href: `/app`, label: "크루목록" });
    return base;
  }, [crewId, isAdmin]);

  function isActive(href: string) {
    if (href.includes(`/${crewId}/events`)) {
      return pathname.startsWith(`/${crewId}/events`);
    }
    return pathname === href;
  }

  return (
    <>
      {/* Top bar */}
      <header style={topBar}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={iconBtn}
        >
          ☰
        </button>
        <div style={{ fontWeight: 800 }}>아득바득</div>
        <div style={{ width: 36 }} />
      </header>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={overlay}
          aria-hidden="true"
        />
      )}

      {/* Side drawer */}
      <aside style={{ ...drawer, transform: open ? "translateX(0)" : "translateX(-105%)" }}>
        <div style={drawerHead}>
          <div style={{ fontWeight: 800 }}>메뉴</div>
          <button onClick={() => setOpen(false)} style={closeBtn} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav style={{ display: "grid", gap: 8, padding: 12 }}>
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                style={{
                  ...navItem,
                  background: active ? "white" : "white",
                  fontWeight: active ? 800 : 600,
                }}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

const topBar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  height: 52,
  padding: "0 12px",
  borderBottom: "1px solid #e2e8f0",
  background: "white",
  color: "black",
};

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: "34px",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 30,
};

const drawer: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  height: "100vh",
  width: 260,
  background: "white",
  borderRight: "1px solid #e2e8f0",
  zIndex: 40,
  transition: "transform 180ms ease-out",
  color: "black",
};

const drawerHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: 12,
  borderBottom: "1px solid #e2e8f0",
};

const closeBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
};

const navItem: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "black",
};
