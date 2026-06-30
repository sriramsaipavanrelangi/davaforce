import { useEffect, useState } from "react";

export const WORKFORCE_PARTICLES_STORAGE_KEY = "workforceShowParticles";
export const WORKFORCE_PARTICLES_CHANGED_EVENT = "workforce-particles-changed";

export const readWorkforceParticlesEnabled = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WORKFORCE_PARTICLES_STORAGE_KEY) === "true";
};

export const writeWorkforceParticlesEnabled = (enabled: boolean) => {
  window.localStorage.setItem(WORKFORCE_PARTICLES_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(WORKFORCE_PARTICLES_CHANGED_EVENT, { detail: enabled }));
};

export function useWorkforceParticlesPreference() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readWorkforceParticlesEnabled());

    const handleChange = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "boolean") {
        setEnabled(event.detail);
        return;
      }

      setEnabled(readWorkforceParticlesEnabled());
    };

    window.addEventListener(WORKFORCE_PARTICLES_CHANGED_EVENT, handleChange);
    window.addEventListener("storage", handleChange);

    return () => {
      window.removeEventListener(WORKFORCE_PARTICLES_CHANGED_EVENT, handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  return [enabled, writeWorkforceParticlesEnabled] as const;
}
