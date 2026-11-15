import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Download, Printer, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';

export function AnalyticsPage() {
  const { showToast } = useToast();
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/analytics?days=${days}`);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportReport = async () => {
    try {
      const report = await apiFetch(`/api/analytics/report?days=${days}`);
      const rows = [
        ['AEVORA SMART CARE REPORT', `Generated: ${report.generatedAt}`],
        ['Care Recipient', report.profile?.full_name || '', 'Doctor', report.profile?.primary_doctor_name || ''],
        ['Care Continuity Score', `${report.continuity?.score}/100`, 'Data Coverage', `${report.continuity?.dataCoveragePercent}%`],
        [],
        ['Date', 'Time', 'Medication', 'Dosage', 'Status', 'Confirmed By', 'Notes'],
        ...(report.doses || []).map((d: any) => [
          d.scheduled_for_date,
          d.scheduled_time,
          d.medication_name,
          d.dosage,
          d.status,
          d.confirmed_by_name || '',
          (d.notes || '').replace(/"/g, '""'),
        ]),
      ];
      const csv = rows.map((r) => r.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aevora-care-report-${days}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Smart Care Report exported', { description: `${days}-day CSV ready for doctor visits.` });
    } catch (err: any) {
      showToast('Export failed', { description: err.message, variant: 'error' });
    }
  };

  return (
    <DashboardLayout title="Care Analytics & Continuity" subtitle="Real database-derived adherence trends, Care Continuity Score, and visit-ready reports">
      <div className="space-y-8">
        {error && <div className="p-4 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-sm text-[#B42318]">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#142B3B]/10 rounded-xl">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  days === d ? 'bg-[#142B3B] text-white' : 'text-[#3E515E] hover:bg-[#F8F7F2]'
                }`}
              >
                Last {d} Days
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#167C80] text-white text-xs font-semibold hover:bg-[#126568]"
            >
              <Download className="w-3.5 h-3.5" /> Export Care Report (CSV)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#142B3B]/15 bg-white text-[#142B3B] text-xs font-semibold hover:border-[#167C80]"
            >
              <Printer className="w-3.5 h-3.5" /> Print Summary
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="h-72 bg-white rounded-2xl border border-[#142B3B]/10 animate-pulse" />
        ) : (
          <>
            {/* Care Continuity Score Hero Card */}
            {data.continuity && (
              <section className="aevora-card bg-white border border-[#142B3B]/10 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#142B3B]/10 pb-4 lg:pb-0 lg:pr-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#167C80] uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" /> Care Continuity Score
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="font-display text-5xl font-bold text-[#142B3B] tabular-nums">{data.continuity.score}</span>
                    <span className="text-lg text-[#74818B] font-mono-tabular">/ 100</span>
                  </div>
                  <div className="text-xs text-[#74818B] mt-2 font-mono-tabular">
                    Data Coverage: <strong className="text-[#142B3B]">{data.continuity.dataCoveragePercent}%</strong> across {days} days
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10">
                      <div className="text-[11px] font-semibold text-[#74818B]">Medication Adherence ({data.continuity.weights.medication}%)</div>
                      <div className="font-display text-2xl font-bold text-[#167C80] mt-1 tabular-nums">{data.continuity.components.medicationAdherence}%</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10">
                      <div className="text-[11px] font-semibold text-[#74818B]">Appointments ({data.continuity.weights.appointments}%)</div>
                      <div className="font-display text-2xl font-bold text-[#142B3B] mt-1 tabular-nums">{data.continuity.components.appointmentCoordination}%</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8F7F2] border border-[#142B3B]/10">
                      <div className="text-[11px] font-semibold text-[#74818B]">Care Tasks ({data.continuity.weights.tasks}%)</div>
                      <div className="font-display text-2xl font-bold text-[#142B3B] mt-1 tabular-nums">{data.continuity.components.taskCompletion}%</div>
                    </div>
                  </div>
                  <p className="text-xs text-[#74818B]">{data.continuity.disclaimer}</p>
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-5">
                <div className="text-xs text-[#74818B]">Period Adherence</div>
                <div className="font-display text-3xl font-bold text-[#167C80] mt-1 tabular-nums">{data.summary.overallAdherence}%</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-5">
                <div className="text-xs text-[#74818B]">Doses Confirmed Taken</div>
                <div className="font-display text-3xl font-bold text-[#142B3B] mt-1 tabular-nums">{data.summary.taken}</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-5">
                <div className="text-xs text-[#74818B]">Missed Doses</div>
                <div className="font-display text-3xl font-bold text-[#B42318] mt-1 tabular-nums">{data.summary.missed}</div>
              </div>
              <div className="bg-white border border-[#142B3B]/10 rounded-2xl p-5">
                <div className="text-xs text-[#74818B]">Skipped Doses</div>
                <div className="font-display text-3xl font-bold text-[#142B3B] mt-1 tabular-nums">{data.summary.skipped}</div>
              </div>
            </section>

            {/* Adherence Trend Chart */}
            <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#142B3B]">Daily Medication Adherence Trend (%)</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.adherenceTrend}>
                    <defs>
                      <linearGradient id="adherenceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#167C80" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#167C80" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E6" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#74818B' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#74818B' }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="adherenceRate" name="Adherence %" stroke="#167C80" strokeWidth={2.5} fill="url(#adherenceFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Completion by Time of Day */}
              <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B3B]">Completion by Schedule Category</h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E6" />
                      <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#74818B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#74818B' }} />
                      <Tooltip />
                      <Bar dataKey="taken" name="Taken" fill="#167C80" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="missed" name="Missed" fill="#B42318" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Caregiver Activity */}
              <section className="bg-white border border-[#142B3B]/10 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#142B3B]">Caregiver & Member Confirmations</h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.caregiverActivity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E6" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#74818B' }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: '#142B3B' }} />
                      <Tooltip />
                      <Bar dataKey="actions" name="Logged Actions" fill="#142B3B" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
