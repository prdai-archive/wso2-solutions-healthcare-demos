"use client";

import { CalendarCheck, ClipboardList, UserCheck, Users } from "lucide-react";

import { AppointmentsList } from "@/components/appointments-list";
import { EhrTasks } from "@/components/ehr-tasks";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TaskQueue } from "@/components/task-queue";
import { Separator } from "@/components/ui/separator";
import { WaitingRoom } from "@/components/waiting-room";
import { useData } from "@/lib/store";

export default function DashboardPage() {
  const { data } = useData();

  const header = (
    <PageHeader
      title="Good morning, Maya"
      description="Care team tasks requested from the EHR are below. Open one to see the full task."
    />
  );

  const openAlerts = data.tasks.filter((t) => t.status !== "Closed").length;
  const flagged = data.patients.filter((p) => p.status === "Flagged").length;
  const assigned = data.tasks.filter((t) => t.status === "Assigned").length;

  return (
    <>
      {header}

      <EhrTasks />

      <div className="flex items-center gap-3 pt-2">
        <Separator className="flex-1" />
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Other workflows (in progress)
        </span>
        <Separator className="flex-1" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open alerts"
          value={openAlerts}
          icon={ClipboardList}
          sublabel="awaiting triage or in review"
        />
        <StatCard
          label="Flagged patients"
          value={flagged}
          icon={Users}
          sublabel="trending toward an event"
        />
        <StatCard
          label="Assigned to clinicians"
          value={assigned}
          icon={UserCheck}
          sublabel="routed for review"
        />
        <StatCard
          label="Reviews today"
          value={data.appointments.length}
          icon={CalendarCheck}
          sublabel={`${data.doctors.length} clinicians on call`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TaskQueue tasks={data.tasks} />
        </div>
        <div className="flex flex-col gap-4">
          <WaitingRoom />
          <AppointmentsList />
        </div>
      </div>
    </>
  );
}
