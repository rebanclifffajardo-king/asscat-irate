"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, CATEGORICAL, GRID, SINGLE, TEXT, fmt, ordinalColors, type ValueFormat } from "./theme";

type Datum = Record<string, string | number | null>;

const axisProps = { tick: { fill: AXIS, fontSize: 12 }, tickLine: false, axisLine: { stroke: GRID } } as const;

function TooltipBox({ active, payload, label, format, labelFormatter }: {
  active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: Datum }[]; label?: string | number;
  format: ValueFormat; labelFormatter?: (d: Datum) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg" style={{ color: TEXT }}>
      <p className="mb-1 font-semibold">{labelFormatter && d ? labelFormatter(d) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span className="text-gray-600">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{fmt(p.value, format)}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series bar chart (vertical columns or horizontal bars). */
export function SimpleBarChart({ data, xKey, yKey, name, format = "rating", horizontal = false, max, height = 260, colorBy, labelFormatter }: {
  data: Datum[]; xKey: string; yKey: string; name: string; format?: ValueFormat; horizontal?: boolean; max?: number;
  height?: number; colorBy?: (d: Datum, i: number) => string; labelFormatter?: (d: Datum) => string;
}) {
  const h = horizontal ? Math.max(height, data.length * 34 + 40) : height;
  const domain: [number, number | "auto"] = [0, max ?? "auto"];
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 16, bottom: 4, left: horizontal ? 8 : -8 }} barCategoryGap="25%">
          <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" domain={domain} {...axisProps} tickFormatter={(v) => (format === "percent" ? `${v}%` : String(v))} />
              <YAxis type="category" dataKey={xKey} width={96} {...axisProps} interval={0} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axisProps} interval={data.length > 12 ? "preserveStartEnd" : 0} minTickGap={8} height={36} />
              <YAxis domain={domain} {...axisProps} width={44} tickFormatter={(v) => (format === "percent" ? `${v}%` : String(v))} allowDecimals={format !== "count"} />
            </>
          )}
          <Tooltip cursor={{ fill: "rgba(17,24,39,0.04)" }} content={<TooltipBox format={format} labelFormatter={labelFormatter} />} />
          <Bar dataKey={yKey} name={name} fill={SINGLE} maxBarSize={24} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
            {colorBy && data.map((d, i) => <Cell key={i} fill={colorBy(d, i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Line chart; one series → brand green with area wash, several → categorical order + legend. */
export function TrendChart({ data, xKey, series, format = "rating", height = 260, domain }: {
  data: Datum[]; xKey: string; series: { key: string; label: string }[]; format?: ValueFormat; height?: number;
  domain?: [number | string, number | string];
}) {
  const single = series.length === 1;
  const color = (i: number) => (single ? SINGLE : CATEGORICAL[i % CATEGORICAL.length]);
  const common = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey={xKey} {...axisProps} height={36} />
      <YAxis {...axisProps} width={44} domain={domain ?? ["auto", "auto"]} allowDecimals={format !== "count"} tickFormatter={(v) => (format === "rating" ? Number(v).toFixed(1) : String(v))} />
      <Tooltip cursor={{ stroke: AXIS, strokeWidth: 1 }} content={<TooltipBox format={format} />} />
      {!single && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: TEXT }} />}
    </>
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {single ? (
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            {common}
            <Area type="monotone" dataKey={series[0].key} name={series[0].label} stroke={SINGLE} strokeWidth={2} fill={SINGLE} fillOpacity={0.1}
              dot={{ r: 4, fill: SINGLE, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            {common}
            {series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color(i)} strokeWidth={2}
                dot={{ r: 4, fill: color(i), stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Rating distribution 1..N using the ordinal green ramp. */
export function DistributionChart({ data, labels, height = 240 }: { data: { rating: number; count: number }[]; labels: string[]; height?: number }) {
  const n = labels.length;
  const colors = ordinalColors(n);
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const rows = labels.map((label, i) => {
    const c = data.find((d) => d.rating === i + 1)?.count ?? 0;
    return { name: `${i + 1} – ${label}`, short: String(i + 1), count: c, pct: Math.round((c / total) * 1000) / 10 };
  });
  return (
    <SimpleBarChart
      data={rows}
      xKey="short"
      yKey="count"
      name="Responses"
      format="count"
      height={height}
      colorBy={(_, i) => colors[i]}
      labelFormatter={(d) => `${d.name} (${d.pct}%)`}
    />
  );
}
