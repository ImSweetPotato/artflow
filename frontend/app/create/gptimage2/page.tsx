import { Suspense } from "react";

import GptImage2ClientPage from "./ClientPage";

export const dynamic = "force-dynamic";

export default function GptImage2Page() {
  return (
    <Suspense>
      <GptImage2ClientPage />
    </Suspense>
  );
}
