"use client";

import type { OpsPatient } from "@/app/api/patients/route";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { PatientRoster } from "@/components/patient-roster";
import { PipelineView } from "@/components/pipeline-view";
import { RequestLogPanel } from "@/components/request-log-panel";

export default function DashboardPage() {
  const [selected, setSelected] = useState<OpsPatient | undefined>(undefined);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Care Loop — Pipeline"
        description="Live view of the demo pipeline per patient — vitals, ML risk scoring, questionnaire delivery, agentic assessment, and front-desk triage handoff."
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <div className="min-h-[240px] lg:min-h-0">
          <PatientRoster selectedId={selected?.id} onSelect={setSelected} />
        </div>

        <div className="min-h-0">
          {selected ? (
            <PipelineView patient={selected} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Select a patient to watch their pipeline.
            </div>
          )}
        </div>
      </div>

      <RequestLogPanel />
    </div>
  );
}
