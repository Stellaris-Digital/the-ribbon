import { Suspense } from "react";
import { connection } from "next/server";
import { PlaceManager } from "@/components/admin/PlaceManager";
import { getCatalog } from "@/lib/catalog";

export default function PlacesPage() {
  return (
    <Suspense fallback={<p>Loading places…</p>}>
      <PlacesContent />
    </Suspense>
  );
}

async function PlacesContent() {
  await connection();
  const catalog = await getCatalog();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Places</h1>
      <PlaceManager places={catalog.places} />
    </div>
  );
}
