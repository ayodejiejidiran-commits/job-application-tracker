"use client";

import { useRouter } from "next/navigation";

export function RefreshListingsButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="logout-btn"
      onClick={() => router.refresh()}
      title="Reload current job listings and statuses"
    >
      Refresh Listings
    </button>
  );
}
