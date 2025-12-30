import { Suspense } from "react";
import RouteLoadingOverlayClient from "./RouteLoadingOverlayClient";

export default function RouteLoadingOverlay() {
  // searchParams가 준비되기 전(또는 프리렌더)에는 fallback 렌더
  return (
    <Suspense fallback={null}>
      <RouteLoadingOverlayClient />
    </Suspense>
  );
}
