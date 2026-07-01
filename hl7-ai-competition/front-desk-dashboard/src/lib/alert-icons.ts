import type { LucideIcon } from "lucide-react";
import type { AlertType } from "@/lib/types";

import {
  Activity,
  Droplets,
  Gauge,
  HeartPulse,
  Scale,
  Wind,
} from "lucide-react";

export const alertTypeIcon: Record<AlertType, LucideIcon> = {
  "Weight gain": Scale,
  "Rising biomarkers": Activity,
  "Worsening dyspnea": Wind,
  "Low SpO2": Droplets,
  Arrhythmia: HeartPulse,
  "Blood pressure": Gauge,
};
