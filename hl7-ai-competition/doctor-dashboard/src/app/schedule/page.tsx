import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ScheduleList } from "@/components/schedule-list";

export default function SchedulePage() {
  const today = new Date("2026-06-26T08:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${today} - telehealth and review slots for escalated cases.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s review slots</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleList />
        </CardContent>
      </Card>
    </>
  );
}
