"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resume", label: "Resume" },
  { href: "/criteria", label: "Criteria" },
  { href: "/jobs/new", label: "Add Job" }
];

export function Sidebar({ extraContent }: { extraContent?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">JT Tracker</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={`sidebar-link ${pathname?.startsWith(item.href) ? "active" : ""}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      {extraContent ? <div className="sidebar-filters-wrap">{extraContent}</div> : null}
    </aside>
  );
}
