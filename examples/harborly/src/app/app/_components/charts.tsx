"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate, parseDate, toDateOnly } from "@/lib/format";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

const AXIS_TICK = { fill: "var(--color-muted-foreground)", fontSize: 12 };

type TooltipProps = Pick<TooltipContentProps<number, string>, "active" | "payload" | "label"> & {
  unit: string;
  formatLabel?: (label: string | number | undefined) => ReactNode;
};

function ChartTooltip({ active, payload, label, unit, formatLabel }: TooltipProps) {
  const rows = (payload ?? []).filter((entry) => typeof entry.value === "number");
  if (!active || rows.length === 0) return null;
  return (
    <div className="min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg shadow-slate-950/10">
      <p className="mb-1.5 font-medium">{formatLabel ? formatLabel(label) : label}</p>
      <ul className="space-y-1">
        {rows.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color ?? entry.stroke ?? entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums">
              {entry.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartFrame({ className, children }: { className?: string; children: ReactElement }) {
  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 256 }}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export interface VelocityDatum {
  label: string;
  completed: number;
  committed: number;
}

/** Dashboard: completed points per week, as bars; the latest week is highlighted. */
export function VelocityBarChart({ data, className }: { data: VelocityDatum[]; className?: string }) {
  const reducedMotion = useReducedMotion();
  const latest = data.length - 1;
  return (
    <ChartFrame className={className}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={AXIS_TICK} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.7 }}
          content={(props) => <ChartTooltip {...props} unit=" pts" />}
          isAnimationActive={!reducedMotion}
        />
        <Bar
          dataKey="completed"
          name="Completed"
          fill="var(--color-chart-1)"
          radius={[5, 5, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!reducedMotion}
        >
          {data.map((entry, index) => (
            <Cell key={entry.label} fillOpacity={index === latest ? 1 : 0.32} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Reports: completed vs. committed points over 12 weeks. */
export function VelocityAreaChart({ data, className }: { data: VelocityDatum[]; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <ChartFrame className={className}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="velocity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={AXIS_TICK} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={(props) => <ChartTooltip {...props} unit=" pts" />}
          isAnimationActive={!reducedMotion}
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#velocity-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={!reducedMotion}
        />
        <Line
          type="monotone"
          dataKey="committed"
          name="Committed"
          stroke="var(--color-muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
          isAnimationActive={!reducedMotion}
        />
      </AreaChart>
    </ChartFrame>
  );
}

export interface CycleTimeDatum {
  stage: string;
  days: number;
}

/** Reports: average days spent per stage. */
export function CycleTimeChart({ data, className }: { data: CycleTimeDatum[]; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <ChartFrame className={className}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="32%">
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="stage" tickLine={false} axisLine={false} tickMargin={10} tick={AXIS_TICK} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tick={AXIS_TICK} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.7 }}
          content={(props) => <ChartTooltip {...props} unit=" days" />}
          isAnimationActive={!reducedMotion}
        />
        <Bar
          dataKey="days"
          name="Avg. days"
          fill="var(--color-chart-2)"
          radius={[5, 5, 0, 0]}
          maxBarSize={56}
          isAnimationActive={!reducedMotion}
        />
      </BarChart>
    </ChartFrame>
  );
}

export interface BurnupDatum {
  /** YYYY-MM-DD */
  date: string;
  completed: number | null;
  planned: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const formatTime = (time: string | number | undefined) =>
  typeof time === "number" ? formatShortDate(toDateOnly(new Date(time))) : "";

/** Project page: actual progress against a straight-line plan to the due date, on a true time axis. */
export function BurnupChart({ data, className }: { data: BurnupDatum[]; className?: string }) {
  const reducedMotion = useReducedMotion();
  const points = data.map((point) => ({ ...point, time: parseDate(point.date).getTime() }));
  // Weekly ticks; a due date that falls a few days after the last weekly tick replaces it.
  const ticks = points.map((point) => point.time);
  const [last, beforeLast] = [ticks.at(-1), ticks.at(-2)];
  if (last !== undefined && beforeLast !== undefined && last - beforeLast < 4 * DAY_MS) ticks.splice(-2, 1);

  return (
    <ChartFrame className={className}>
      <AreaChart data={points} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="burnup-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tickFormatter={formatTime}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={AXIS_TICK}
          minTickGap={16}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(value: number) => `${value}%`}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tick={AXIS_TICK}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={(props) => <ChartTooltip {...props} unit="%" formatLabel={formatTime} />}
          isAnimationActive={!reducedMotion}
        />
        <Line
          type="linear"
          dataKey="planned"
          name="Planned"
          stroke="var(--color-muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
          connectNulls
          isAnimationActive={!reducedMotion}
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#burnup-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={!reducedMotion}
        />
      </AreaChart>
    </ChartFrame>
  );
}
