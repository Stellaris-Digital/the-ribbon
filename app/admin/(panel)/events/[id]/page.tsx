import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { getCatalog } from "@/lib/catalog";

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading the event…</p>}>
      <EditEventContent params={params} />
    </Suspense>
  );
}

async function EditEventContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const [{ id }, catalog] = await Promise.all([params, getCatalog()]);
  const event = catalog.events.find((item) => item.id === id);
  if (!event) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit event</h1>
      <EventForm catalog={catalog} event={event} />
    </div>
  );
}
