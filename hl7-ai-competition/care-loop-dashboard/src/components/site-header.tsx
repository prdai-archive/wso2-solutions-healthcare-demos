import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { operator } from "@/lib/store";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Care Loop</p>
          <p className="text-xs text-muted-foreground">Ops Dashboard</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
            {operator.initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
