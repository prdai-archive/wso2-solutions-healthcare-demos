"use client";

import { Users } from "lucide-react";
import { useData } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PatientsTable } from "@/components/patients-table";
import { EmptyState } from "@/components/empty-state";

export default function PatientsPage() {
  const { patients } = useData();

  return (
    <>
      <PageHeader
        title="Escalated cases"
        description="Heart-failure cases escalated to you from the front desk. Open a chart for vitals trend, questionnaire responses, and history."
      />
      <Card>
        <CardContent>
          {patients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No escalated cases"
              description="Flagged heart-failure alerts assigned to you from the front desk appear in this worklist."
            />
          ) : (
            <PatientsTable patients={patients} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
