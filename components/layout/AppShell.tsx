import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function AppShell({ title, actions, sidebarContent, children }: { title: string; actions?: ReactNode; sidebarContent?: ReactNode; children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar extraContent={sidebarContent} />
      <div className="app-main">
        <Topbar title={title} actions={actions} />
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
