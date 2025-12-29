import { Suspense } from "react";
import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "black" }}>로딩중...</div>}>
      <JoinClient />
    </Suspense>
  );
}
