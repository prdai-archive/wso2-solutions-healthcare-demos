import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ReviewQueue } from "@/components/review-queue";

export default function ReviewsPage() {
  return (
    <>
      <PageHeader
        title="Review queue"
        description="Triage items tied to escalated heart-failure alerts: abnormal labs, symptom questionnaire responses, refill requests, and notes awaiting signature."
      />
      <Card>
        <CardContent>
          <ReviewQueue />
        </CardContent>
      </Card>
    </>
  );
}
