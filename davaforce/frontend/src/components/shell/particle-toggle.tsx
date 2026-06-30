"use client";

import { Switch } from "@/components/ui/switch";
import { useWorkforceParticlesPreference } from "@/lib/workforce-particles";

export function ParticleToggle() {
  const [enabled, setEnabled] = useWorkforceParticlesPreference();

  return (
    <div className="hidden items-center gap-2 rounded-lg px-1.5 py-1 text-[var(--home-muted)] md:flex">
      <span className="text-xs font-medium">Dots</span>
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        aria-label={enabled ? "Hide dots background" : "Show dots background"}
      />
    </div>
  );
}
