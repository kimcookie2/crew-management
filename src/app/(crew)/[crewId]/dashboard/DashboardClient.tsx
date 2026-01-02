/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as htmlToImage from "html-to-image";

export default function DashboardClient({
  title,
  initialBaseDate,
  children,
}: {
  title: string;
  initialBaseDate: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const [baseDate, setBaseDate] = useState(initialBaseDate);

  // ✅ 서버에서 내려준 초기값이 바뀌면 동기화(뒤로가기 등)
  useEffect(() => {
    setBaseDate(initialBaseDate);
  }, [initialBaseDate]);

  function setBaseToUrl(nextBase: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("base", nextBase);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  async function onExport() {
    if (!scrollBoxRef.current || !tableRef.current) return;

    setBusy(true);

    const scrollBox = scrollBoxRef.current;
    const tableEl = tableRef.current;

    const prevBox = {
      overflow: scrollBox.style.overflow,
      overflowX: scrollBox.style.overflowX,
      overflowY: scrollBox.style.overflowY,
      maxHeight: scrollBox.style.maxHeight,
      height: scrollBox.style.height,
      width: scrollBox.style.width,
    };

    const prevTable = {
      width: tableEl.style.width,
      minWidth: tableEl.style.minWidth,
      maxWidth: tableEl.style.maxWidth,
    };

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      scrollBox.style.overflow = "visible";
      scrollBox.style.overflowX = "visible";
      scrollBox.style.overflowY = "visible";
      scrollBox.style.maxHeight = "none";
      scrollBox.style.height = "auto";

      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const fullW = scrollBox.scrollWidth + 10;
      const fullH = scrollBox.scrollHeight + 10;

      tableEl.style.maxWidth = "none";
      tableEl.style.width = `${fullW}px`;
      tableEl.style.minWidth = `${fullW}px`;

      const MAX = 16000;
      const pr = Math.min(2, MAX / fullW, MAX / fullH);

      const dataUrl = await htmlToImage.toPng(tableEl, {
        cacheBust: true,
        pixelRatio: pr,
        backgroundColor: "white",
        width: fullW,
        height: fullH,
        style: { transform: "scale(1)", transformOrigin: "top left" },
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title}.png`;
      a.click();
    } catch (e: any) {
      alert(e?.message ?? "내보내기에 실패했습니다.");
    } finally {
      scrollBox.style.overflow = prevBox.overflow;
      scrollBox.style.overflowX = prevBox.overflowX;
      scrollBox.style.overflowY = prevBox.overflowY;
      scrollBox.style.maxHeight = prevBox.maxHeight;
      scrollBox.style.height = prevBox.height;
      scrollBox.style.width = prevBox.width;

      tableEl.style.width = prevTable.width;
      tableEl.style.minWidth = prevTable.minWidth;
      tableEl.style.maxWidth = prevTable.maxWidth;

      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "5px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", height: "100%"}}>
          <label style={{ fontWeight: 800 }}>기준일</label>
          <input
            type="date"
            value={baseDate}
            onChange={(e) => {
              const v = e.target.value;
              setBaseDate(v);
              setBaseToUrl(v); // ✅ 바꾸자마자 서버 재조회
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "white",
              color: "black",
            }}
          />
          {isPending && <span style={{ fontSize: 12, opacity: 0.7 }}>갱신중...</span>}
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onExport}
          disabled={busy}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "white",
            cursor: "pointer",
            fontWeight: 900,
            color: "black",
          }}
        >
          {busy ? "내보내는 중..." : "내보내기"}
        </button>
      </div>

      <div
        ref={scrollBoxRef}
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "auto",
          background: "white",
          opacity: isPending ? 0.6 : 1,          // ✅ 갱신 중 살짝 dim
          pointerEvents: isPending ? "none" : "auto",
          transition: "opacity 120ms ease",
        }}
      >
        <div ref={tableRef} style={{ background: "white", color: "black", padding: "0px" }}>
          {children}
          <div style={{ fontSize: 12, opacity: 1, color: "red", marginTop: busy ? "30px" : "10px" }}>
            ※ 참여 횟수는 단톡방 내 게시된 클라이밍 일정에 2명 이상 참여하였을 때 적용됩니다. (개인 일정 혹은 클라이밍 외 일정 적용X)
          </div>
        </div>
      </div>
    </div>
  );
}
