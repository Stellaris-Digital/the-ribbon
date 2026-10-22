import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { compareEndpoints, formatEventDate } from "@/lib/dates";
import { getCatalog } from "@/lib/catalog";

export default function EventsPage() {
  return (
    <Suspense fallback={<p>Loading events…</p>}>
      <EventsContent />
    </Suspense>
  );
}

async function EventsContent() {
  await connection();
  const catalog = await getCatalog();
  const events = [...catalog.events].sort((a, b) => compareEndpoints(a.start, b.start));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link className="rounded-full bg-[#241c15] px-4 py-2 text-sm text-[#f7f1e4]" href="/admin/events/new">
          New event
        </Link>
      </div>
      <ul className="divide-y divide-[#e6dcc8] rounded-lg border border-[#e6dcc8] bg-[#fffdf8]">
        {events.length === 0 ? <li className="p-4 text-sm text-stone-600">No events yet.</li> : null}
        {events.map((event) => (
          <li key={event.id} className="flex items-baseline justify-between gap-4 p-4">
            <div>
              <Link className="font-medium" href={`/admin/events/${event.id}`}>
                {event.title}
              </Link>
              <p className="text-sm text-stone-600">{formatEventDate(event)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
