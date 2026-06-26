"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ShieldAlert,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PatientAvatar } from "@/components/patient-avatar";
import { PatientDetail } from "@/components/patient-detail";
import { RiskBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const { getPatient } = useData();
  const patient = getPatient(params.id);

  if (!patient) {
    return (
      <>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/patients">Escalated cases</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardContent>
            <EmptyState
              icon={UserX}
              title="Case not found"
              description="No escalated case matches this id. It may have been resolved, or no case data is connected yet."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const escalatedAt = new Date(
    patient.escalation.escalatedAt,
  ).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/patients">Escalated cases</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{patient.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <PatientAvatar
            name={patient.name}
            color={patient.avatarColor}
            className="size-14"
          />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {patient.name}
              </h1>
              <Badge variant="outline" className="font-mono">
                {patient.mrn}
              </Badge>
              <RiskBadge
                level={patient.escalation.riskLevel}
                score={patient.escalation.riskScore}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {patient.age} years, {patient.sex === "F" ? "Female" : "Male"}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span>{patient.primaryCondition}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {patient.allergies.length > 0 ? (
                patient.allergies.map((a) => (
                  <Badge
                    key={a}
                    className="border-transparent bg-destructive/12 text-destructive dark:bg-destructive/25"
                  >
                    <ShieldAlert className="size-3" />
                    {a}
                  </Badge>
                ))
              ) : (
                <Badge className="border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  No known allergies
                </Badge>
              )}
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="sm:ml-auto">
            <Link href="/patients">
              <ArrowLeft />
              Back to worklist
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold">
              Escalated from front desk
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {patient.escalation.flagReason}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {escalatedAt}
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span>By {patient.escalation.escalatedBy}</span>
          </div>
        </CardContent>
      </Card>

      <PatientDetail patient={patient} />
    </>
  );
}
