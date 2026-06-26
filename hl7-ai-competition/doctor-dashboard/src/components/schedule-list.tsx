"use client";

import { ArrowRight, CalendarClock, Clock } from "lucide-react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { PatientAvatar } from "@/components/patient-avatar";
import { EmptyState } from "@/components/empty-state";

export function ScheduleList({ limit }: { limit?: number }) {
  const { appointments, getPatient } = useData();
  const items = limit ? appointments.slice(0, limit) : appointments;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No review slots scheduled"
        description="Telehealth and review slots for escalated heart-failure cases appear here."
      />
    );
  }

  return (
    <ol className="divide-y">
      {items.map((appt) => {
        const patient = getPatient(appt.patientId);
        if (!patient) return null;
        return (
          <li
            key={appt.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex w-14 shrink-0 flex-col items-center">
              <span className="text-sm font-semibold tabular-nums">
                {appt.time}
              </span>
              <span className="flex items-center gap-0.5 text-[0.7rem] text-muted-foreground">
                <Clock className="size-3" />
                {appt.durationMin}m
              </span>
            </div>
            <PatientAvatar
              name={patient.name}
              color={patient.avatarColor}
              className="size-9"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/patients/${patient.id}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {patient.name}
                </Link>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {patient.mrn}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {appt.reason}
              </p>
            </div>
            <Badge variant="outline" className="hidden lg:inline-flex">
              {appt.visitType}
            </Badge>
            <AppointmentStatusBadge status={appt.status} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon-sm">
                  <Link href={`/patients/${patient.id}`}>
                    <ArrowRight />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open chart</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
