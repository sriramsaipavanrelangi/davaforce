type DavaForceWordmarkProps = {
  className?: string;
};

export function DavaForceWordmark({ className = "" }: DavaForceWordmarkProps) {
  return (
    <span className={`font-display text-2xl font-bold transition-colors duration-300 ${className}`.trim()}>
      <span className="text-brand">Dava</span>
      <span className="text-[var(--home-text)] transition-colors duration-300">Force</span>
    </span>
  );
}
