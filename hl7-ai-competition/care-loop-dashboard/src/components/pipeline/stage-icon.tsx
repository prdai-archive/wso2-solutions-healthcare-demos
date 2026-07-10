import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  ClipboardCheck,
  Cpu,
  FileQuestion,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  vitals: Activity,
  ml: Cpu,
  escalation: AlertTriangle,
  quest: FileQuestion,
  sent: Send,
  respond: MessageSquare,
  agentic_draft: Sparkles,
  agentic: BrainCircuit,
  task_desc: FileText,
  fhir: ClipboardCheck,
  clinician: Stethoscope,
};

export function StageIcon({ stageKey, className }: { stageKey: string; className?: string }) {
  const Icon = ICONS[stageKey] ?? Activity;
  return <Icon className={className} />;
}
