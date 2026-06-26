"use client";

import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  // compact omits the outer Card so it can sit inside an existing card.
  compact?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-12" : "py-16",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <Card>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
