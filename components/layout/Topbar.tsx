import { ReactNode } from "react";

export function Topbar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="topbar-title">{title}</div>
      </div>
      <div className="topbar-actions">{actions}</div>
    </header>
  );
}
