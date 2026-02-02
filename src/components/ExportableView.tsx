/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import * as htmlToImage from "html-to-image";

export default function ExportableView({
  title,
  children,
  footerText,
}: {
  title: string;
  children: React.ReactNode;
  footerText?: string;
}) {
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    if (!scrollBoxRef.current || !captureRef.current) return;
    setBusy(true);

    const scrollBox = scrollBoxRef.current;
    const el = captureRef.current;

    const prevBox = {
      overflow: scrollBox.style.overflow,
      overflowX: scrollBox.style.overflowX,
      overflowY: scrollBox.style.overflowY,
      maxHeight: scrollBox.style.maxHeight,
      height: scrollBox.style.height,
      width: scrollBox.style.width,
    };
    const prevEl = {
      width: el.style.width,
      minWidth: el.style.minWidth,
      maxWidth: el.style.maxWidth,
    };

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      // ✅ 스크롤 제한 풀기
      scrollBox.style.overflow = "visible";
      scrollBox.style.overflowX = "visible";
      scrollBox.style.overflowY = "visible";
      scrollBox.style.maxHeight = "none";
      scrollBox.style.height = "auto";

      // 레이아웃 반영
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const fullW = scrollBox.scrollWidth + 10;
      const fullH = scrollBox.scrollHeight + 10;

      // ✅ 캡처 DOM을 전체 폭으로 고정
      el.style.maxWidth = "none";
      el.style.width = `${fullW}px`;
      el.style.minWidth = `${fullW}px`;

      const MAX = 16000;
      const pr = Math.min(2, MAX / fullW, MAX / fullH);

      const dataUrl = await htmlToImage.toPng(el, {
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
      // ✅ 원복
      scrollBox.style.overflow = prevBox.overflow;
      scrollBox.style.overflowX = prevBox.overflowX;
      scrollBox.style.overflowY = prevBox.overflowY;
      scrollBox.style.maxHeight = prevBox.maxHeight;
      scrollBox.style.height = prevBox.height;
      scrollBox.style.width = prevBox.width;

      el.style.width = prevEl.width;
      el.style.minWidth = prevEl.minWidth;
      el.style.maxWidth = prevEl.maxWidth;

      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        }}
      >
        <div ref={captureRef} style={{ background: "white", color: "black", padding: 10 }}>
          {children}
          {footerText && (
            <div style={{ fontSize: 12, marginTop: 10, color: "black", opacity: 0.9 }}>
              {footerText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
