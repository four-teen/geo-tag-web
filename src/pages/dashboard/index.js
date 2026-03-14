import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ApartmentOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import { Card, Empty, Progress, Skeleton } from "antd";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetVoterInsights } from "../api/dashboard";
import { extractApiErrorMessage } from "../../utils/api";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const numberFormatter = new Intl.NumberFormat("en-PH");

const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const whole = (value) => numberFormatter.format(Number(value || 0));

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);

  const unauthorized = useCallback((error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      const auth = await Auth(router?.pathname);
      if (!mounted) return;

      if (auth !== router?.pathname) {
        router.push({ pathname: auth });
        return;
      }

      try {
        setLoading(true);
        const res = await GetVoterInsights();
        if (!mounted) return;
        setInsights(res?.data || null);
      } catch (error) {
        if (!mounted) return;
        setInsights(null);
        if (!unauthorized(error)) {
          toast.error(extractApiErrorMessage(error, "Failed to load voter dashboard."));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [router, unauthorized]);

  const snapshot = insights?.snapshot || {};
  const professionSnapshot = Array.isArray(insights?.profession_snapshot) ? insights.profession_snapshot : [];
  const topBarangays = Array.isArray(insights?.top_barangays) ? insights.top_barangays : [];
  const chartData = useMemo(() => (
    insights?.evaluation_chart || { categories: [], series: [] }
  ), [insights]);

  const heroCards = [
    {
      label: "Occupation Coverage",
      value: pct(snapshot.occupation_coverage),
      icon: <IdcardOutlined />,
      progress: Number(snapshot.occupation_coverage || 0),
      tone: "from-amber-300/30 to-orange-300/10",
    },
    {
      label: "Barangay Tagged",
      value: whole(snapshot.assigned_barangay),
      icon: <EnvironmentOutlined />,
      progress: snapshot.total_voters ? (Number(snapshot.assigned_barangay || 0) / Number(snapshot.total_voters || 1)) * 100 : 0,
      tone: "from-sky-300/30 to-cyan-300/10",
    },
    {
      label: "Purok Tagged",
      value: whole(snapshot.assigned_purok),
      icon: <ApartmentOutlined />,
      progress: snapshot.total_voters ? (Number(snapshot.assigned_purok || 0) / Number(snapshot.total_voters || 1)) * 100 : 0,
      tone: "from-emerald-300/30 to-teal-300/10",
    },
  ];

  const chartOptions = useMemo(() => ({
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    },
    colors: ["#0f172a", "#ea580c", "#0891b2", "#16a34a"],
    stroke: {
      curve: "smooth",
      width: [4, 4, 3, 3],
    },
    grid: {
      borderColor: "#dbe4f0",
      strokeDashArray: 5,
    },
    markers: {
      size: 5,
      hover: { size: 7 },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: Array.isArray(chartData?.categories) ? chartData.categories : [],
      labels: {
        style: {
          colors: "#475569",
          fontSize: "12px",
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (value) => whole(Math.round(value)),
        style: {
          colors: "#475569",
          fontSize: "12px",
        },
      },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) => `${whole(value)} voters`,
      },
    },
  }), [chartData]);

  return (
    <Layout>
      <Head>
        <title>Administrator Dashboard</title>
      </Head>

      <main className="p-4 sm:p-6 space-y-6">
        <section className="overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.28),_transparent_32%),linear-gradient(135deg,#0f172a_0%,#1e293b_50%,#0f766e_100%)] text-white shadow-xl">
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)] lg:p-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.35em] text-white/65">Voter Intelligence</p>
                <h1 className="text-3xl font-semibold sm:text-4xl">Administrator Dashboard</h1>
                <p className="text-sm uppercase tracking-[0.22em] text-white/55">
                  Masterlist Source: bow_tbl_recipients
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/55">Total Voters</p>
                  <p className="mt-3 text-4xl font-semibold">{whole(snapshot.total_voters)}</p>
                  <p className="mt-1 text-sm text-white/72">Current count from the voter masterlist</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/55">Unique Professions</p>
                  <p className="mt-3 text-4xl font-semibold">{whole(snapshot.unique_professions)}</p>
                  <p className="mt-1 text-sm text-white/72">Distinct occupation labels already captured</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur sm:col-span-2 xl:col-span-1">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/55">Lead Profession</p>
                  <p className="mt-3 text-4xl font-semibold">{whole(snapshot.leading_profession?.total)}</p>
                  <p className="mt-1 text-sm text-white/72">{snapshot.leading_profession?.label || "No profession data"}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/15 p-5 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/55">Coverage Summary</p>
                    <p className="mt-2 text-3xl font-semibold">{pct(snapshot.occupation_coverage)}</p>
                    <p className="mt-1 text-sm text-white/72">Occupation tagging coverage across all voters</p>
                  </div>
                  <div className="grid gap-3 text-left sm:text-right">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/50">Assigned Barangay</p>
                      <p className="mt-1 text-xl font-semibold">{whole(snapshot.assigned_barangay)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/50">Assigned Purok</p>
                      <p className="mt-1 text-xl font-semibold">{whole(snapshot.assigned_purok)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {heroCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-[28px] border border-white/10 bg-gradient-to-br ${card.tone} p-5 shadow-lg backdrop-blur`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-white/60">{card.label}</p>
                      <p className="mt-2 text-3xl font-semibold">{card.value}</p>
                    </div>
                    <div className="rounded-2xl bg-black/20 p-3 text-xl text-white/90">{card.icon}</div>
                  </div>
                  <div className="mt-4">
                    <Progress
                      percent={Math.max(0, Math.min(100, Number(card.progress || 0)))}
                      showInfo={false}
                      strokeColor="rgba(255,255,255,0.85)"
                      trailColor="rgba(255,255,255,0.12)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="space-y-4">
            <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
            <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
          </div>
        ) : !insights ? (
          <Card className="rounded-[28px]">
            <Empty description="No voter analytics available yet." />
          </Card>
        ) : (
          <>
            <section className="space-y-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Profession Snapshot</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-800">Top recorded occupations from the voter masterlist</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  These cards highlight the strongest profession signals currently stored in <span className="font-medium text-slate-700">bow_tbl_recipients</span>.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {professionSnapshot.map((item, index) => (
                  <Card key={item.label} className="overflow-hidden rounded-[28px] border-0 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Rank {index + 1}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{pct(item.share)}</span>
                      </div>
                      <div>
                        <p className="text-sm uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-3xl font-semibold text-slate-900">{whole(item.total)}</p>
                        <p className="mt-1 text-sm text-slate-500">Recorded voters with this profession label</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <Card className="rounded-[30px] border-0 shadow-sm">
                <div className="space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Evaluation Graph</p>
                      <h3 className="mt-1 text-2xl font-semibold text-slate-800">Smooth multi-line view of voter data quality</h3>
                    </div>
                    <p className="max-w-sm text-sm text-slate-500">
                      Each line compares age-group volume against occupation tagging and location completeness.
                    </p>
                  </div>

                  {Array.isArray(chartData?.series) && chartData.series.length > 0 ? (
                    <ApexChart
                      type="line"
                      height={420}
                      options={chartOptions}
                      series={chartData.series}
                    />
                  ) : (
                    <Empty description="No evaluation chart data available." />
                  )}
                </div>
              </Card>

              <Card className="rounded-[30px] border-0 shadow-sm">
                <div className="space-y-6">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Location Pressure</p>
                      <h3 className="mt-1 text-2xl font-semibold text-slate-800">Barangays carrying the largest voter volume</h3>
                    </div>
                    <p className="max-w-2xl text-sm text-slate-500">
                      This section takes the full analysis width so the heaviest barangay loads are easier to compare.
                    </p>
                  </div>

                  {topBarangays.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {topBarangays.map((item, index) => (
                        <div
                          key={item.label}
                          className="rounded-[24px] border border-slate-100 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#ecfeff_100%)] p-5 shadow-sm"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                Load Rank {index + 1}
                              </p>
                              <h4 className="mt-2 text-2xl font-semibold uppercase tracking-[0.04em] text-slate-900">
                                {item.label}
                              </h4>
                              <p className="mt-1 text-sm text-slate-500">voters currently attached to this barangay bucket</p>
                            </div>
                            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-left text-white sm:min-w-[150px] sm:text-right">
                              <p className="text-xs uppercase tracking-[0.22em] text-white/55">Share</p>
                              <p className="mt-1 text-2xl font-semibold">{pct(item.share)}</p>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-end">
                            <div>
                              <Progress
                                percent={Math.max(0, Math.min(100, Number(item.share || 0)))}
                                showInfo={false}
                                strokeColor={{
                                  "0%": "#0f766e",
                                  "100%": "#0ea5e9",
                                }}
                                trailColor="#dbeafe"
                              />
                              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                                Pressure on total masterlist
                              </p>
                            </div>
                            <div className="sm:text-right">
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Voter Volume</p>
                              <p className="mt-1 text-3xl font-semibold text-slate-900">{whole(item.total)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No location pressure data available." />
                  )}
                </div>
              </Card>
            </section>
          </>
        )}
      </main>

      <ToastContainer />
    </Layout>
  );
}
