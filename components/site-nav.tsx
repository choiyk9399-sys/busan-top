import Link from "next/link";
import { Cpu, FlaskConical } from "lucide-react";

export function SiteNav({ active }: { active: "wafer" | "papers" }) {
  const linkClass = (isActive: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <Link href="/" className={linkClass(active === "wafer")}>
        <Cpu className="size-4" />
        웨이퍼 제조사 동향
      </Link>
      <Link href="/papers" className={linkClass(active === "papers")}>
        <FlaskConical className="size-4" />
        실리콘 논문
      </Link>
    </nav>
  );
}
