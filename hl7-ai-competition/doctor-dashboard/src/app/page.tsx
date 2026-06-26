"use client";

import {
  ClipboardPlus,
  FileSignature,
  FlaskConical,
  HeartPulse,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ScheduleList } from "@/components/schedule-list";
import { ReviewQueue } from "@/components/review-queue";

export default function DashboardPage() {
  const { doctor, stats, reviews } = useData();
  const today = new Date("2026-06-26T08:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const highRisk = reviews.filter(
    (r) => r.severity === "Critical" || r.severity === "Urgent",
  ).length;

  return (
    <>
      <PageHeader
        title={`Good morning, ${doctor.name}`}
        description={`${today} - heart-failure cases escalated to you from the front desk.`}
      >
        <Button asChild variant="outline">
          <Link href="/schedule">View schedule</Link>
        </Button>
        <Button asChild>
          <Link href="/reviews">Open review queue</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Escalated cases"
          value={stats.escalatedCases}
          icon={HeartPulse}
          hint={`${highRisk} high-acuity alerts`}
        />
        <StatCard
          label="Abnormal labs"
          value={stats.abnormalLabs}
          icon={FlaskConical}
          hint="BNP, K+, renal"
          accent="text-amber-600 bg-amber-500/12 dark:text-amber-400"
        />
        <StatCard
          label="Notes to sign"
          value={stats.unsignedNotes}
          icon={FileSignature}
          hint="Awaiting signature"
          accent="text-violet-600 bg-violet-500/12 dark:text-violet-400"
        />
        <StatCard
          label="Patient messages"
          value={stats.patientMessages}
          icon={MessageSquare}
          hint="From patients"
          accent="text-blue-600 bg-blue-500/12 dark:text-blue-400"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardPlus className="size-4 text-muted-foreground" />
              Today&apos;s review slots
            </CardTitle>
            <CardDescription>
              Telehealth and review slots for escalated patients on {today}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleList />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Review queue</CardTitle>
            <CardDescription>
              Labs, questionnaires, refills, and notes to sign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewQueue />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
