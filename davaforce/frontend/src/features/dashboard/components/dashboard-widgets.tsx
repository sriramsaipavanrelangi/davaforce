"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Upload, type LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardDemand, DashboardEwa, DashboardSkills, DashboardStaffingFit, DashboardSummary, DashboardSupply } from "@/features/dashboard/dashboard-types";

export const numberFormat = new Intl.NumberFormat("en-US");
const fteFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const chartColors = ["#FF5640", "#5899C4", "#30A661", "#F99C11", "#8684BF", "#CF820E"];
const activeBarStyle = {
  fill: "#FF5640",
  fillOpacity: 1,
  stroke: "rgba(255,255,255,0.35)",
  strokeWidth: 1,
};
export { SectionTabs, KpiCard, DashboardCard, CoverageRadial, SummaryBalanceChart, AvailabilityDonut, BenchTrendChart, RiskMixChart, HorizontalBarChart, DemandPipelineChart, RiskPriorityBoard, FitDistributionChart, CandidateScoreChart, SkillGapChart, SkillSupplyRadarLike, EwaStatusChart, ActionCards, DataTable, StackedText, RiskBadge, FitBadge, EwaBadge, LoadingState, EmptyState, formatFte };

function SectionTabs({ tabs }: { tabs: Array<{ id: string; label: string; content: ReactNode }> }) {
  const firstTabId = tabs[0]?.id ?? "";
  const [activeTab, setActiveTab] = useState(firstTabId);
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    setActiveTab(firstTabId);
  }, [firstTabId]);

  if (!currentTab) return null;

  return (
    <div className="space-y-4">
      <div className="smooth-chat-scroll flex gap-2 overflow-x-auto rounded-2xl border border-[var(--home-border)] bg-[var(--home-panel)] p-2 shadow-2xl shadow-black/10 backdrop-blur">
        {tabs.map((tab) => {
          const isActive = tab.id === currentTab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-brand text-brand-foreground shadow-lg shadow-brand/20"
                  : "text-[var(--home-muted)] hover:bg-[var(--home-soft)] hover:text-[var(--home-text)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>{currentTab.content}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent?: "default" | "brand" | "good" | "warn";
}) {
  const accentClass = {
    default: "border-[var(--home-border)]",
    brand: "border-brand/35",
    good: "border-positive/30",
    warn: "border-warning/35",
  }[accent];

  return (
    <Card className={`rounded-2xl bg-[var(--home-panel)] p-5 shadow-2xl shadow-black/10 backdrop-blur ${accentClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--home-muted)]">{label}</div>
          <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--home-text)]">{value}</div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-[var(--home-muted)]">{detail}</div>
    </Card>
  );
}

function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`rounded-2xl border-[var(--home-border)] bg-[var(--home-panel)] p-5 shadow-2xl shadow-black/10 backdrop-blur ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-[var(--home-text)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--home-muted)]">{subtitle}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" strokeWidth={2.1} />
        </div>
      </div>
      {children}
    </Card>
  );
}

type ChartTooltipItem = {
  name?: string;
  value?: number | string;
  color?: string;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipItem[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[var(--home-border)] bg-[var(--home-panel-strong)] px-3 py-2 text-xs shadow-2xl shadow-black/20">
      {label ? <div className="mb-1 font-semibold text-[var(--home-text)]">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={`${item.name}-${item.value}`} className="flex items-center justify-between gap-5 text-[var(--home-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? chartColors[0] }} />
              {item.name}
            </span>
            <span className="font-medium text-[var(--home-text)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageRadial({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, percent));

  return (
    <div className="grid min-h-[250px] place-items-center">
      <div className="relative h-56 w-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ name: "Coverage", value }]} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={16} fill="#FF5640" background={{ fill: "rgba(25,43,55,0.08)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="font-display text-5xl font-semibold text-[var(--home-text)]">{value}%</div>
          <div className="mt-2 text-xs text-[var(--home-muted)]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function SummaryBalanceChart({ summary }: { summary: DashboardSummary }) {
  const data = [
    { label: "Required", fte: Number(summary.kpis.requiredFte.toFixed(1)), fill: chartColors[0] },
    { label: "Available", fte: Number(summary.kpis.availableFteCurrent.toFixed(1)), fill: chartColors[1] },
    { label: "Bench", fte: summary.kpis.currentBenchPeople, fill: chartColors[3] },
    { label: "High risk", fte: summary.kpis.highRiskSupplyPeople, fill: chartColors[5] },
    { label: "EWA", fte: summary.kpis.pendingEwaRequests, fill: chartColors[4] },
  ];

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(127,127,127,0.16)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <Tooltip cursor={false} content={<ChartTooltip />} />
          <Bar dataKey="fte" name="Value" radius={[10, 10, 0, 0]} fillOpacity={0.88} activeBar={activeBarStyle}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AvailabilityDonut({ rows }: { rows: DashboardSupply["availabilityByCategory"] }) {
  const data = rows.map((row, index) => ({
    name: row.availabilityCategory,
    value: Number(row.availableFte.toFixed(1)),
    people: row.people,
    fill: chartColors[index % chartColors.length],
  }));
  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="grid min-h-[260px] gap-4 md:grid-cols-[220px_1fr]">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={3}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip cursor={false} content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-3xl font-semibold text-[var(--home-text)]">{formatFte(total)}</div>
          <div className="text-xs text-[var(--home-muted)]">available FTE</div>
        </div>
      </div>
      <LegendList rows={data.map((row) => ({ label: row.name, value: `${formatFte(row.value)} FTE`, color: row.fill, detail: `${row.people} people` }))} />
    </div>
  );
}

function BenchTrendChart({ rows }: { rows: DashboardSupply["benchMovement"] }) {
  const data = rows.map((row) => ({
    date: formatShortDate(row.weekStartDate),
    availableFte: Number(row.availableFte.toFixed(1)),
    bench: row.currentBenchHeadcount,
    emerging: row.emergingBenchHeadcount,
    partial: row.partialCapacityHeadcount,
  }));

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(127,127,127,0.16)" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <Tooltip cursor={false} content={<ChartTooltip />} />
          <Area type="monotone" dataKey="availableFte" name="Available FTE" stroke="#5899C4" fill="rgba(88,153,196,0.18)" strokeWidth={2} />
          <Line type="monotone" dataKey="bench" name="Bench" stroke="#FF5640" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="partial" name="Partial" stroke="#F99C11" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function RiskMixChart({ rows }: { rows: DashboardSupply["supplyRiskByCategory"] }) {
  const data = rows.slice(0, 10).map((row) => ({
    name: `${row.availabilityCategory} / ${row.supplyRisk}`,
    fte: Number(row.fte.toFixed(1)),
    people: row.people,
  }));

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 56, bottom: 0 }}>
          <CartesianGrid stroke="rgba(127,127,127,0.14)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 10 }} width={92} />
          <Tooltip cursor={false} content={<ChartTooltip />} />
          <Bar dataKey="fte" name="FTE" fill="#FF5640" fillOpacity={0.88} radius={[0, 9, 9, 0]} activeBar={activeBarStyle} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarChart({ rows }: { rows: Array<{ label: string; value: number; detail?: string }> }) {
  const data = rows.map((row) => ({
    name: row.label,
    value: Number(row.value.toFixed(1)),
    detail: row.detail,
  }));

  return (
    <div className="space-y-3">
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 40, bottom: 0 }}>
            <CartesianGrid stroke="rgba(127,127,127,0.14)" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} width={84} />
            <Tooltip cursor={false} content={<ChartTooltip />} />
            <Bar dataKey="value" name="FTE" fill="#5899C4" fillOpacity={0.88} radius={[0, 10, 10, 0]} activeBar={activeBarStyle} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DemandPipelineChart({ rows }: { rows: DashboardDemand["demandByStage"] }) {
  const data = rows.map((row) => ({
    stage: row.stage,
    requiredFte: Number(row.requiredFte.toFixed(1)),
    roles: row.roles,
    probability: Math.round(row.avgProbability * 100),
  }));

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(127,127,127,0.16)" vertical={false} />
          <XAxis dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <Tooltip cursor={false} content={<ChartTooltip />} />
          <Bar dataKey="requiredFte" name="Required FTE" fill="#FF5640" fillOpacity={0.88} radius={[10, 10, 0, 0]} activeBar={activeBarStyle} />
          <Line type="monotone" dataKey="probability" name="Probability %" stroke="#30A661" strokeWidth={2.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function RiskPriorityBoard({ rows }: { rows: DashboardDemand["deliveryRiskByPriority"] }) {
  const maxFte = Math.max(1, ...rows.map((row) => row.requiredFte));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.slice(0, 10).map((row) => {
        const width = Math.max(6, (row.requiredFte / maxFte) * 100);
        return (
          <div key={`${row.deliveryRisk}-${row.commercialPriority}`} className="rounded-2xl border border-[var(--home-border)] bg-[var(--home-soft)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RiskBadge value={row.deliveryRisk} />
                <span className="rounded-full border border-[var(--home-border)] px-2.5 py-1 text-xs font-medium text-[var(--home-muted)]">
                  {row.commercialPriority} priority
                </span>
              </div>
              <span className="text-xs text-[var(--home-muted)]">{row.opportunities} opportunities</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="font-display text-3xl font-semibold text-[var(--home-text)]">{formatFte(row.requiredFte)}</div>
                <div className="text-xs text-[var(--home-muted)]">required FTE</div>
              </div>
              <div className="min-w-[45%] flex-1">
                <div className="mb-1 flex justify-between text-[11px] text-[var(--home-muted)]">
                  <span>Exposure</span>
                  <span>{Math.round(width)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--home-panel)]">
                  <div className={`h-full rounded-full ${riskFillClass(row.deliveryRisk)}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FitDistributionChart({ rows }: { rows: DashboardStaffingFit["fitDistribution"] }) {
  const data = rows.map((row, index) => ({
    name: row.fitStatus,
    candidates: row.candidates,
    score: Math.round(row.avgScore),
    fill: chartColors[index % chartColors.length],
  }));

  return (
    <div className="grid min-h-[260px] gap-4 md:grid-cols-[220px_1fr]">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="candidates" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={4}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip cursor={false} content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <LegendList rows={data.map((row) => ({ label: row.name, value: `${row.candidates} candidates`, color: row.fill, detail: `${row.score} avg score` }))} />
    </div>
  );
}

function CandidateScoreChart({ rows }: { rows: DashboardStaffingFit["topCandidatePerRole"] }) {
  const data = rows.map((row) => ({
    name: row.personName.split(" ")[0] ?? row.personName,
    score: Math.round(row.overallStaffingScore),
    capability: Math.round(row.capabilityFitScore),
    availability: Math.round(row.availabilityFitScore),
  }));

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(127,127,127,0.16)" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "currentColor", fontSize: 11 }} domain={[0, 100]} />
          <Tooltip cursor={false} content={<ChartTooltip />} />
          <Bar dataKey="capability" name="Capability" stackId="score" fill="#5899C4" fillOpacity={0.88} radius={[0, 0, 0, 0]} activeBar={activeBarStyle} />
          <Bar dataKey="availability" name="Availability" stackId="score" fill="#FF5640" fillOpacity={0.88} radius={[10, 10, 0, 0]} activeBar={activeBarStyle} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SkillGapChart({ rows }: { rows: DashboardSkills["skillGaps"] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {rows.length ? (
        rows.map((row) => (
          <div key={row.skillName} className="rounded-xl border border-brand/25 bg-brand/[0.06] p-4 shadow-sm shadow-brand/5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-base font-semibold text-[var(--home-text)]">{row.skillName}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--home-muted)]">
                  Required skill has no matching workforce evidence.
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 border-brand/35 bg-brand/10 text-brand">
                No supply
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricPill label="Required" value={row.requiredRoles} />
              <MetricPill label="Supply" value={row.people} tone="danger" />
              <MetricPill label="Gap" value={row.gap} tone="danger" />
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-xl border border-[var(--home-border)] bg-[var(--home-soft)] p-6 text-center text-sm text-[var(--home-muted)]">
          No skill gaps found for this dataset.
        </div>
      )}
    </div>
  );
}

function MetricPill({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-lg border border-[var(--home-border)] bg-[var(--home-panel)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--home-muted)]">{label}</div>
      <div className={`mt-1 font-display text-lg font-semibold ${tone === "danger" ? "text-brand" : "text-[var(--home-text)]"}`}>
        {value}
      </div>
    </div>
  );
}

function SkillSupplyRadarLike({ rows }: { rows: DashboardSkills["skillSupply"] }) {
  const max = Math.max(1, ...rows.map((row) => row.people));

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const size = 42 + (row.people / max) * 56;
        return (
          <div key={row.skillName} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--home-border)] bg-[var(--home-soft)] p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--home-text)]">{row.skillName}</div>
              <div className="text-xs text-[var(--home-muted)]">Level {row.avgLevel.toFixed(1)} - {row.avgYears.toFixed(1)} yrs</div>
            </div>
            <div
              className="grid shrink-0 place-items-center rounded-full text-xs font-semibold text-white shadow-lg shadow-black/10"
              style={{ width: size, height: size, backgroundColor: chartColors[index % chartColors.length] }}
            >
              {row.people}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EwaStatusChart({ rows }: { rows: DashboardEwa["ewaByStatus"] }) {
  const data = rows.map((row, index) => ({
    name: row.ewaStatus,
    requests: row.requests,
    fte: Number(row.requestedFte.toFixed(1)),
    fill: chartColors[index % chartColors.length],
  }));

  return (
    <div className="grid min-h-[260px] gap-4 md:grid-cols-[220px_1fr]">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="28%" outerRadius="96%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="requests" cornerRadius={14} background={{ fill: "rgba(127,127,127,0.12)" }} />
            <Tooltip cursor={false} content={<ChartTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <LegendList rows={data.map((row) => ({ label: row.name, value: `${row.requests} requests`, color: row.fill, detail: `${formatFte(row.fte)} FTE` }))} />
    </div>
  );
}

function ActionCards({ rows }: { rows: DashboardEwa["actionRequired"] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`${row.personId}-${row.ewaActionRequired}`} className="rounded-xl border border-[var(--home-border)] bg-[var(--home-soft)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-[var(--home-text)]">{row.personName}</div>
            <RiskBadge value={row.supplyRisk} />
          </div>
          <div className="mt-2 text-xs leading-5 text-[var(--home-muted)]">{row.ewaActionRequired || row.suggestedAction}</div>
        </div>
      ))}
    </div>
  );
}

function LegendList({ rows }: { rows: Array<{ label: string; value: string; color: string; detail?: string }> }) {
  return (
    <div className="flex flex-col justify-center space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate text-sm font-medium text-[var(--home-text)]">{row.label}</span>
            </div>
            {row.detail ? <div className="ml-4 mt-0.5 text-xs text-[var(--home-muted)]">{row.detail}</div> : null}
          </div>
          <span className="shrink-0 text-sm text-[var(--home-muted)]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; value: string; detail: string; amount: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-[var(--home-text)]">{row.label}</span>
            <span className="shrink-0 text-[var(--home-muted)]">{row.value}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--home-soft)]">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-[var(--home-muted)]">{row.detail}</div>
        </div>
      ))}
    </div>
  );
}

function BenchMovement({ rows }: { rows: DashboardSupply["benchMovement"] }) {
  const max = Math.max(1, ...rows.map((row) => row.availableFte));

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => (
        <div key={row.weekStartDate} className="rounded-xl border border-[var(--home-border)] bg-[var(--home-soft)] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--home-text)]">{formatShortDate(row.weekStartDate)}</span>
            <span className="text-[var(--home-muted)]">{formatFte(row.availableFte)} FTE</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--home-panel)]">
            <div className="h-full rounded-full bg-positive" style={{ width: `${Math.max(4, (row.availableFte / max) * 100)}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--home-muted)]">
            <MetricMini label="Bench" value={row.currentBenchHeadcount} />
            <MetricMini label="Emerging" value={row.emergingBenchHeadcount} />
            <MetricMini label="Partial" value={row.partialCapacityHeadcount} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusStack({ rows }: { rows: Array<{ label: string; value: string; detail: string; tone: string }> }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--home-border)] bg-[var(--home-soft)] p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[var(--home-text)]">{row.label}</div>
            <div className="text-xs text-[var(--home-muted)]">{row.detail}</div>
          </div>
          <Badge variant="outline" className={`${toneClass(row.tone)} shrink-0 border`}>
            {row.value}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <div className="rounded-xl border border-[var(--home-border)]">
      <div className="smooth-chat-scroll overflow-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-[var(--home-soft)] text-xs text-[var(--home-muted)]">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2.5 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((row, rowIndex) => (
                <tr key={`${page}-${rowIndex}`} className="border-t border-[var(--home-border)]">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-3 align-top text-[var(--home-text)]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-[var(--home-border)]">
                <td className="px-3 py-8 text-center text-sm text-[var(--home-muted)]" colSpan={headers.length}>
                  No records returned for this section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--home-border)] bg-[var(--home-panel)] px-3 py-2.5 text-xs text-[var(--home-muted)]">
          <span>
            Showing {startIndex + 1}-{Math.min(startIndex + pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-[var(--home-border)] bg-[var(--home-panel)] px-2 text-[var(--home-text)] hover:bg-[var(--home-soft)]"
              disabled={safePage === 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="min-w-16 text-center">
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-[var(--home-border)] bg-[var(--home-panel)] px-2 text-[var(--home-text)] hover:bg-[var(--home-soft)]"
              disabled={safePage === totalPages}
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StackedText({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-w-0">
      <div className="max-w-[18rem] truncate font-medium text-[var(--home-text)]">{title}</div>
      <div className="max-w-[18rem] truncate text-xs text-[var(--home-muted)]">{subtitle}</div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-base font-semibold text-[var(--home-text)]">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function RiskBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={`${toneClass(value)} border whitespace-nowrap`}>
      {value}
    </Badge>
  );
}

function FitBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={`${toneClass(value)} border whitespace-nowrap`}>
      {value}
    </Badge>
  );
}

function EwaBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={`${toneClass(value)} border whitespace-nowrap`}>
      {value}
    </Badge>
  );
}

function LoadingState() {
  return (
    <Card className="flex min-h-[26rem] items-center justify-center rounded-2xl border-[var(--home-border)] bg-[var(--home-panel)] p-8 shadow-2xl shadow-black/10 backdrop-blur">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
        <h2 className="mt-4 font-display text-xl font-semibold text-[var(--home-text)]">Loading dashboard</h2>
        <p className="mt-1 text-sm text-[var(--home-muted)]">Reading the saved dashboard snapshot.</p>
      </div>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="flex min-h-[26rem] items-center justify-center rounded-2xl border-[var(--home-border)] bg-[var(--home-panel)] p-8 shadow-2xl shadow-black/10 backdrop-blur">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Upload className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-[var(--home-text)]">No dashboard data yet</h2>
        <p className="mt-2 text-sm text-[var(--home-muted)]">{message}</p>
        <Button asChild className="mt-5 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90">
          <Link href="/">Upload workforce data</Link>
        </Button>
      </div>
    </Card>
  );
}

function formatFte(value: number) {
  return fteFormat.format(value);
}

function formatShortDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toneClass(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("high") || lower.includes("blocked") || lower.includes("gap")) {
    return "bg-negative/10 text-negative border-negative/30";
  }
  if (lower.includes("medium") || lower.includes("pending") || lower.includes("stretch") || lower.includes("risk")) {
    return "bg-warning/10 text-warning border-warning/30";
  }
  if (lower.includes("recommended") || lower.includes("backup") || lower.includes("approved") || lower.includes("low")) {
    return "bg-positive/10 text-positive border-positive/20";
  }
  return "bg-accent text-accent-foreground border-brand/20";
}

function riskFillClass(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("high") || lower.includes("blocked")) return "bg-negative";
  if (lower.includes("medium") || lower.includes("risk")) return "bg-warning";
  return "bg-positive";
}
