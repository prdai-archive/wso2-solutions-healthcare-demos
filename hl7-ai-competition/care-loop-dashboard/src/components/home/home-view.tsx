"use client";

import type { HomePatientRow, HomeSummary } from "@/app/api/home-summary/route";
import type { OpsPatient } from "@/app/api/patients/route";

import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ArchitectureView } from "@/components/architecture/architecture-view";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 10;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "No activity yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

interface KpiTile {
  label: string;
  value: string;
  sub: string;
}

function buildKpis(summary: HomeSummary, loaded: boolean): KpiTile[] {
  if (!loaded) {
    return [
      { label: "Total patients", value: "…", sub: "" },
      { label: "Open tasks", value: "…", sub: "" },
      { label: "Escalations today", value: "…", sub: "" },
      { label: "Avg ML risk", value: "…", sub: "" },
      { label: "Latest event", value: "…", sub: "" },
    ];
  }
  return [
    { label: "Total patients", value: String(summary.totalPatients), sub: "enrolled in remote monitoring" },
    { label: "Open tasks", value: String(summary.openTasks), sub: "across all patients" },
    { label: "Escalations today", value: String(summary.escalationsToday), sub: "Tasks created/updated today" },
    {
      label: "Avg ML risk",
      value: summary.avgMlRisk === null ? "—" : `${Math.round(summary.avgMlRisk * 100)}%`,
      sub: "latest heart-risk-service prediction",
    },
    {
      label: "Latest event",
      value: summary.latestEvent ? new Date(summary.latestEvent).toLocaleTimeString([], { hour12: false }) : "—",
      sub: "most recent dashboard event",
    },
  ];
}

export function HomeView({
  patients,
  patientsLoaded,
  summary,
  summaryLoaded,
  onSelect,
}: {
  patients: OpsPatient[];
  patientsLoaded: boolean;
  summary: HomeSummary;
  summaryLoaded: boolean;
  onSelect: (patient: OpsPatient) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const rowByPatientId = useMemo(
    () => new Map(summary.patients.map((row) => [row.id, row])),
    [summary.patients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((patient) => patient.name.toLowerCase().includes(q));
  }, [patients, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const kpis = buildKpis(summary, summaryLoaded);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-5 px-4 py-7 md:px-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Patients</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {patientsLoaded ? `${patients.length} enrolled in remote monitoring` : "Loading enrolled patients…"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[13px] border border-border bg-background p-3.5">
            <div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
              {kpi.label}
            </div>
            <div className="mt-1.5 font-mono text-[22px] font-bold tracking-tight">{kpi.value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/70">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold tracking-tight">Patients</span>
            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10.5px] font-bold text-background">
              {filtered.length}
            </span>
          </div>
          <div className="relative w-full max-w-[320px]">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search name…"
              className="pl-8"
            />
          </div>
        </div>

        {!patientsLoaded ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-[12.5px] font-semibold text-muted-foreground">
              {query ? `No patients match "${query}"` : "No patients found on care-loop-fhir-server."}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Latest HR</TableHead>
                <TableHead>ML risk</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((patient) => {
                const row: HomePatientRow | undefined = rowByPatientId.get(patient.id);
                return (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer"
                    onClick={() => onSelect(patient)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground/8 text-[10px] font-bold text-foreground/70">
                          {initials(patient.name)}
                        </span>
                        <span className="truncate text-[13px] font-semibold">{patient.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[12px]">
                      {row?.latestHr !== undefined && row?.latestHr !== null ? `${row.latestHr} bpm` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[12px]">
                      {row?.mlRisk !== undefined && row?.mlRisk !== null ? `${Math.round(row.mlRisk * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[12px]">{row?.openTasks ?? "—"}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {row ? formatRelativeTime(row.lastActivity) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground/50">
                      <ArrowRight className="ml-auto size-3.5" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between border-t border-border/70 px-5 py-2.5">
          <span className="text-[11.5px] text-muted-foreground">
            {filtered.length === 0 ? "0 of 0" : `Page ${currentPage + 1} of ${totalPages}`}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:border-foreground/40 hover:not-disabled:text-foreground"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:border-foreground/40 hover:not-disabled:text-foreground"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <ArchitectureView />
    </div>
  );
}
