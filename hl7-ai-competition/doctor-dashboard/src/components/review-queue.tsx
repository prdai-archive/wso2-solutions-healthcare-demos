"use client";

import {
  ClipboardPlus,
  FlaskConical,
  Inbox,
  Pill,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import type { ReviewItem, ReviewKind } from "@/lib/types";
import { useData } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityBadge } from "@/components/status-badge";
import { PatientAvatar } from "@/components/patient-avatar";
import { EmptyState } from "@/components/empty-state";

const tabs: {
  value: ReviewKind;
  label: string;
  icon: typeof FlaskConical;
  action: string;
}[] = [
  { value: "lab", label: "Labs", icon: FlaskConical, action: "Review" },
  {
    value: "questionnaire",
    label: "Questionnaires",
    icon: ClipboardPlus,
    action: "Review",
  },
  { value: "refill", label: "Refills", icon: Pill, action: "Approve" },
  { value: "note", label: "Notes to sign", icon: Stethoscope, action: "Sign" },
];

function ReviewRow({
  item,
  action,
  patientName,
  patientId,
  patientMrn,
  avatarColor,
}: {
  item: ReviewItem;
  action: string;
  patientName: string;
  patientId: string;
  patientMrn: string;
  avatarColor: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <PatientAvatar
        name={patientName}
        color={avatarColor}
        className="size-9"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/patients/${patientId}`}
            className="text-sm font-medium hover:underline"
          >
            {patientName}
          </Link>
          <span className="text-xs text-muted-foreground">{patientMrn}</span>
          <SeverityBadge severity={item.severity} />
        </div>
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.summary}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Button size="sm">{action}</Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/patients/${patientId}`}>Open</Link>
        </Button>
      </div>
    </div>
  );
}

export function ReviewQueue({ defaultTab = "lab" }: { defaultTab?: ReviewKind }) {
  const { reviews, reviewsByKind, getPatient } = useData();

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Review queue is empty"
        description="Abnormal labs, symptom questionnaire responses, refill requests, and notes to sign for escalated cases land here."
      />
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        {tabs.map((tab) => {
          const count = reviewsByKind(tab.value).length;
          return (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              <tab.icon className="size-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              <span className="text-muted-foreground">({count})</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {tabs.map((tab) => {
        const items = reviewsByKind(tab.value);
        return (
          <TabsContent key={tab.value} value={tab.value} className="space-y-2.5">
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing in this queue right now.
              </p>
            ) : (
              items.map((item) => {
                const patient = getPatient(item.patientId);
                if (!patient) return null;
                return (
                  <ReviewRow
                    key={item.id}
                    item={item}
                    action={tab.action}
                    patientName={patient.name}
                    patientId={patient.id}
                    patientMrn={patient.mrn}
                    avatarColor={patient.avatarColor}
                  />
                );
              })
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
