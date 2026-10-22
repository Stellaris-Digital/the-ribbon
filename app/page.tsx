import { Suspense } from "react";
import { connection } from "next/server";
import { TimelineApp } from "@/components/timeline/TimelineApp";
import { getCatalog } from "@/lib/catalog";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#f3efe6]" />}>
      <TimelinePage searchParams={searchParams} />
    </Suspense>
  );
}

async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [params, catalog] = await Promise.all([searchParams, getCatalog()]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  }
  return <TimelineApp catalog={catalog} initialQuery={query.toString()} />;
}
