import type { LucideIcon } from "lucide-react";

interface DashboardSubsectionHeaderProps {
  icon: LucideIcon;
  title: string;
}

export function DashboardSubsectionHeader({ icon: Icon, title }: DashboardSubsectionHeaderProps) {
  return (
    <header className="grid gap-2.5">
      <div className="inline-flex items-center gap-2.5">
        <span
          className="inline-flex h-5 w-5 items-center justify-center text-[#4f616e]"
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <h3 className="m-0 text-lg font-bold text-[#4f616e] md:text-[18px]">{title}</h3>
      </div>
      <div className="h-px bg-black/10" />
    </header>
  );
}
