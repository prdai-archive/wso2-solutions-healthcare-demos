"use client";

import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PatientAvatar } from "@/components/patient-avatar";
import { SeverityBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export default function MessagesPage() {
  const { reviewsByKind, getPatient } = useData();
  const messages = reviewsByKind("message");

  return (
    <>
      <PageHeader
        title="Messages"
        description="Secure messages from patients in your escalated heart-failure panel."
      />
      <Card>
        <CardContent className="space-y-2.5">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No messages"
              description="Secure messages from escalated heart-failure patients show up here."
            />
          ) : (
            messages.map((msg) => {
              const patient = getPatient(msg.patientId);
              if (!patient) return null;
              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <PatientAvatar
                    name={patient.name}
                    color={patient.avatarColor}
                    className="size-9"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">
                        {patient.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {patient.mrn}
                      </span>
                      <SeverityBadge severity={msg.severity} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {msg.summary}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button size="sm">Reply</Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/patients/${patient.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </>
  );
}
