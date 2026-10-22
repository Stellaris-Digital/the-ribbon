import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Catalog</h1>
      <p className="max-w-2xl text-stone-700">
        Events, labels, and places are edited here. The public timeline reads this catalog. Ribbon arrangements stay in the
        viewer&apos;s link and are not saved.
      </p>
      <ul className="list-disc pl-5 text-sm">
        <li>
          <Link href="/admin/events">Events</Link>
        </li>
        <li>
          <Link href="/admin/labels">Labels</Link>
        </li>
        <li>
          <Link href="/admin/places">Places</Link>
        </li>
      </ul>
    </div>
  );
}
