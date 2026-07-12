import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "text-primary bg-primary/10",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accent,
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold leading-none tracking-tight">
            {value}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
