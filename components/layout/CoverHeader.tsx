import React from "react";
import { cn } from "@/lib/utils";

export function CoverHeader({ title, subtitle, className }: { title?: string; subtitle?: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full h-48 overflow-hidden rounded-3xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-slate-950/90" />
      <div className="relative z-10 h-full flex flex-col justify-end p-6 text-white">
        {title ? <h1 className="text-2xl font-semibold mb-1">{title}</h1> : null}
        {subtitle ? <p className="text-sm text-white/80">{subtitle}</p> : null}
      </div>
    </div>
  );
}
