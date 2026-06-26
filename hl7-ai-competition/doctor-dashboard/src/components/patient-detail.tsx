"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ClipboardPlus,
  Pill,
  TrendingUp,
} from "lucide-react";
import type { Patient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VitalsCards } from "@/components/vitals-cards";
import { LabFlagBadge } from "@/components/status-badge";

const conditionStyles: Record<string, string> = {
  Active: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Controlled: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  Resolved: "bg-muted text-muted-foreground",
};

function ConditionsCard({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conditions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {patient.conditions.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
          >
            <div className="flex items-center gap-2">
              <CircleDot className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">since {c.since}</span>
              <Badge className={conditionStyles[c.status]}>{c.status}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TasksCard({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Care tasks</CardTitle>
        <CardDescription>Open items for this patient.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {patient.tasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <span className="text-sm">{t.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">Due {t.due}</span>
          </div>
        ))}
        {patient.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MedicationsTable({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Medications</CardTitle>
        <CardDescription>
          {patient.medications.length} active medications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {patient.medications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active medications.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="hidden sm:table-cell">Started</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patient.medications.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Pill className="size-3.5 text-muted-foreground" />
                      {m.name}
                    </span>
                  </TableCell>
                  <TableCell>{m.dose}</TableCell>
                  <TableCell>{m.frequency}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {m.startedOn}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SymptomCard({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardPlus className="size-4 text-muted-foreground" />
          Symptom questionnaire
        </CardTitle>
        <CardDescription>Latest remote check-in responses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {patient.symptomResponses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No responses recorded.</p>
        ) : (
          patient.symptomResponses.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-2.5"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{r.question}</p>
                <p className="text-xs text-muted-foreground">{r.answer}</p>
              </div>
              {r.flagged ? (
                <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  Flagged
                </Badge>
              ) : (
                <Badge className="border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                  OK
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function VitalsTrendCard({ patient }: { patient: Patient }) {
  const trend = patient.vitalsTrend;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const weightDelta = last && first ? last.weightKg - first.weightKg : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-muted-foreground" />
          Vitals trend
        </CardTitle>
        <CardDescription>
          {trend.length}-day home readings.
          {weightDelta !== 0 ? (
            <span
              className={
                weightDelta > 0
                  ? " font-medium text-amber-600 dark:text-amber-400"
                  : " font-medium text-emerald-600 dark:text-emerald-400"
              }
            >
              {" "}
              Weight {weightDelta > 0 ? "+" : ""}
              {weightDelta.toFixed(1)} kg over the window.
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead className="hidden sm:table-cell">BP</TableHead>
              <TableHead>HR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trend.map((point) => (
              <TableRow key={point.date}>
                <TableCell className="text-muted-foreground">
                  {point.date}
                </TableCell>
                <TableCell className="tabular-nums">
                  {point.weightKg.toFixed(1)} kg
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">
                  {point.bp}
                </TableCell>
                <TableCell className="tabular-nums">{point.hr} bpm</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LabsTable({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent labs &amp; observations</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="hidden sm:table-cell">Reference</TableHead>
              <TableHead className="hidden md:table-cell">Collected</TableHead>
              <TableHead>Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patient.labs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="tabular-nums">
                  {l.value} {l.unit}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {l.referenceRange} {l.unit}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {l.collectedOn}
                </TableCell>
                <TableCell>
                  <LabFlagBadge flag={l.flag} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function PatientDetail({ patient }: { patient: Patient }) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="vitals">Vitals</TabsTrigger>
        <TabsTrigger value="medications">Medications</TabsTrigger>
        <TabsTrigger value="labs">Labs</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <VitalsCards vitals={patient.vitals} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SymptomCard patient={patient} />
          <ConditionsCard patient={patient} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <VitalsTrendCard patient={patient} />
          <TasksCard patient={patient} />
        </div>
        <MedicationsTable patient={patient} />
      </TabsContent>

      <TabsContent value="vitals" className="space-y-4">
        <VitalsCards vitals={patient.vitals} />
        <p className="text-sm text-muted-foreground">
          Recorded {new Date(patient.vitals.recordedAt).toLocaleString("en-US")}.
        </p>
        <VitalsTrendCard patient={patient} />
      </TabsContent>

      <TabsContent value="medications">
        <MedicationsTable patient={patient} />
      </TabsContent>

      <TabsContent value="labs">
        <LabsTable patient={patient} />
      </TabsContent>

      <TabsContent value="notes">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clinical notes</CardTitle>
            <CardDescription>
              Most recent encounter summary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <span className="font-medium">Assessment</span>
              </div>
              <p className="text-muted-foreground">
                {patient.age}-year-old patient with {patient.primaryCondition}.
                Reviewed interval labs and vitals. Plan documented in active care
                tasks; medications reconciled this visit.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-1 font-medium">Plan</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {patient.tasks.map((t) => (
                  <li key={t.id}>{t.label}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
