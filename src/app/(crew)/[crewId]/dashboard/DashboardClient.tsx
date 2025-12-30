/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import * as htmlToImage from "html-to-image";

export default function DashboardClient({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

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

      // 스크롤 박스 제한 풀기
      scrollBox.style.overflow = "visible";
      scrollBox.style.overflowX = "visible";
      scrollBox.style.overflowY = "visible";
      scrollBox.style.maxHeight = "none";
      scrollBox.style.height = "auto";

      // 레이아웃 반영
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      // "전체 폭/높이" 측정
      const fullW = scrollBox.scrollWidth + 10;   // 전체 가로
      const fullH = scrollBox.scrollHeight + 10;  // 전체 세로

      // 캡처 대상 DOM을 강제로 전체 폭으로
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
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title}.png`;
      a.click();
    } catch (e: any) {
      alert(e?.message ?? "내보내기에 실패했습니다.");
    } finally {
      // 원복
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 900, color: "black" }}></div>
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

      {/* ✅ 스크롤 래퍼 */}
      <div
        ref={scrollBoxRef}
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "auto",
          background: "white",
        }}
      >
        {/* ✅ 실제 캡처 대상(표 전체) */}
        <div ref={tableRef} style={{ background: "white", color: "black", padding: "10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>2025 참여 현황</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                기준일 : {new Date().toISOString().slice(0, 10)}
              </div>
            </div>
          </div>
          {children}
          <div style={{ fontSize: 12, opacity: 0.75, color: "red", marginTop: "10px" }}>
            ※ 참여 횟수는 단톡방 내 게시된 클라이밍 일정에 2명 이상 참여하였을 때 적용됩니다. (개인 일정 혹은 클라이밍 외 일정 적용X)
          </div>
        </div>
      </div>
    </div>
  );
}
