'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Locale } from '@/lib/i18n/i18n';
import type { AnalyticsDataPoint } from './analytics-contracts';

type ChartLabels = {
  costTitle: string;
  costDescription: string;
  fuelCost: string;
  driverCost: string;
  distanceTitle: string;
  distanceDescription: string;
  distance: string;
  co2Title: string;
  co2Description: string;
  co2Saved: string;
};

type AnalyticsChartsProps = {
  data: AnalyticsDataPoint[];
  locale: Locale;
  labels: ChartLabels;
};

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function ChartCard({
  title,
  description,
  className = '',
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-sm border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${className}`}>
      <h2 className="font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      <div className="mt-5 h-72 min-w-0" role="img" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

export default function AnalyticsCharts({
  data,
  locale,
  labels,
}: AnalyticsChartsProps) {
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const currency = new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  });
  const compactNumber = new Intl.NumberFormat(numberLocale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const decimal = new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 1,
  });
  const chartData = data.map((point) => ({
    ...point,
    date_label: formatDate(point.date, locale),
  }));
  const tooltipStyle = {
    backgroundColor: 'var(--chart-tooltip-bg)',
    borderColor: 'var(--chart-grid)',
    borderRadius: '0.75rem',
    color: 'var(--chart-text)',
    boxShadow: '0 12px 32px rgb(15 23 42 / 12%)',
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard
        className="lg:col-span-2"
        title={labels.costTitle}
        description={labels.costDescription}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsFuel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8a838" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#e8a838" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="analyticsDriver" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.65} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date_label"
              stroke="var(--chart-muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              stroke="var(--chart-muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value: number) => compactNumber.format(value)}
              width={58}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                currency.format(Number(value)),
                String(name),
              ]}
            />
            <Legend wrapperStyle={{ color: 'var(--chart-muted)', fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="fuel_cost_vnd"
              name={labels.fuelCost}
              stackId="cost"
              stroke="#e8a838"
              fill="url(#analyticsFuel)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="driver_cost_vnd"
              name={labels.driverCost}
              stackId="cost"
              stroke="#0ea5e9"
              fill="url(#analyticsDriver)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={labels.distanceTitle} description={labels.distanceDescription}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date_label"
              stroke="var(--chart-muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              stroke="var(--chart-muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value: number) => decimal.format(value)}
              width={48}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [
                `${decimal.format(Number(value))} km`,
                labels.distance,
              ]}
            />
            <Line
              type="monotone"
              dataKey="total_distance_km"
              name={labels.distance}
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#059669', stroke: 'var(--chart-surface)', strokeWidth: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={labels.co2Title} description={labels.co2Description}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsCo2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date_label"
              stroke="var(--chart-muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis
              stroke="var(--chart-muted)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value: number) => decimal.format(value)}
              width={48}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [
                `${decimal.format(Number(value))} kg`,
                labels.co2Saved,
              ]}
            />
            <Bar
              dataKey="estimated_co2_savings_kg"
              name={labels.co2Saved}
              fill="url(#analyticsCo2)"
              radius={[6, 6, 0, 0]}
              maxBarSize={42}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
