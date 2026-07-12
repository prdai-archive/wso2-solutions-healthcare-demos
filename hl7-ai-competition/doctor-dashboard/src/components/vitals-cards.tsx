import {
  Activity,
  Gauge,
  HeartPulse,
  Scale,
  Thermometer,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Vitals } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

export function VitalsCards({ vitals }: { vitals: Vitals }) {
  const items: { label: string; value: string; unit: string; icon: LucideIcon }[] =
    [
      { label: "Blood pressure", value: vitals.bp, unit: "mmHg", icon: Gauge },
      { label: "Heart rate", value: String(vitals.hr), unit: "bpm", icon: HeartPulse },
      { label: "Temperature", value: vitals.temp.toFixed(1), unit: "C", icon: Thermometer },
      { label: "SpO2", value: String(vitals.spo2), unit: "%", icon: Wind },
      { label: "Weight", value: vitals.weightKg.toFixed(1), unit: "kg", icon: Scale },
      { label: "BMI", value: vitals.bmi.toFixed(1), unit: "kg/m2", icon: Activity },
    ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="space-y-1.5 px-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <item.icon className="size-3.5" />
              <span className="text-xs">{item.label}</span>
            </div>
            <p className="text-xl font-semibold tracking-tight">
              {item.value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {item.unit}
              </span>
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
