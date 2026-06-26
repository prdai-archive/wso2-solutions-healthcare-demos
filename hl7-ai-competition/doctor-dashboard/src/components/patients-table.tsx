"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Patient, RiskLevel } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PatientAvatar } from "@/components/patient-avatar";
import { RiskBadge } from "@/components/status-badge";

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const riskRank: Record<RiskLevel, number> = { High: 3, Moderate: 2, Low: 1 };

export function PatientsTable({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [sort, setSort] = useState("risk");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = patients.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.primaryCondition.toLowerCase().includes(q) ||
        p.escalation.flagReason.toLowerCase().includes(q);
      const matchesRisk = risk === "all" || p.escalation.riskLevel === risk;
      return matchesQuery && matchesRisk;
    });
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "escalated")
        return b.escalation.escalatedAt.localeCompare(a.escalation.escalatedAt);
      // Default: risk score, highest first.
      return b.escalation.riskScore - a.escalation.riskScore;
    });
  }, [patients, query, risk, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, MRN, flag reason..."
            className="pl-8.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Moderate">Moderate</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="risk">Sort: Risk score</SelectItem>
              <SelectItem value="escalated">Sort: Escalated</SelectItem>
              <SelectItem value="name">Sort: Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} cases
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="hidden lg:table-cell">Flag reason</TableHead>
              <TableHead className="hidden md:table-cell">Escalated by</TableHead>
              <TableHead className="hidden sm:table-cell">Escalated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/patients/${p.id}`}
                    className="flex items-center gap-2.5"
                  >
                    <PatientAvatar
                      name={p.name}
                      color={p.avatarColor}
                      className="size-8"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.mrn} - {p.age}/{p.sex}
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <RiskBadge
                    level={p.escalation.riskLevel}
                    score={p.escalation.riskScore}
                  />
                </TableCell>
                <TableCell className="hidden max-w-xs lg:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {p.escalation.flagReason}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {p.escalation.escalatedBy}
                </TableCell>
                <TableCell className="hidden text-sm whitespace-nowrap text-muted-foreground sm:table-cell">
                  {formatDate(p.escalation.escalatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
