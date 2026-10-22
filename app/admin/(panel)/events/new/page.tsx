import { Suspense } from "react";
import { connection } from "next/server";
import { EventForm } from "@/components/admin/EventForm";
import { getCatalog } from "@/lib/catalog";

export default function NewEventPage() {
  return (
    <Suspense fallback={<p>Loading the form…</p>}>
      <NewEventContent />
    </Suspense>
  );
}

async function NewEventContent() {
  await connection();
  const catalog = await getCatalog();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New event</h1>
      <EventForm catalog={catalog} />
    </div>
  );
}
