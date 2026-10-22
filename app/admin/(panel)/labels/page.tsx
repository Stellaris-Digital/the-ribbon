import { Suspense } from "react";
import { connection } from "next/server";
import { LabelManager } from "@/components/admin/LabelManager";
import { getCatalog } from "@/lib/catalog";

export default function LabelsPage() {
  return (
    <Suspense fallback={<p>Loading labels…</p>}>
      <LabelsContent />
    </Suspense>
  );
}

async function LabelsContent() {
  await connection();
  const catalog = await getCatalog();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Labels</h1>
      <LabelManager labels={catalog.labels} />
    </div>
  );
}
