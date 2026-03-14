import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ApartmentOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Card, Empty, Progress, Skeleton } from "antd";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../../layouts";
import { Auth } from "../../api/auth";
import { GetVoterInsights } from "../../api/dashboard";
import { extractApiErrorMessage } from "../../../utils/api";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const numberFormatter = new Intl.NumberFormat("en-PH");

const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const whole = (value) => numberFormatter.format(Number(value || 0));

export default function StaffDashboard() {
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
          toast.error(extractApiErrorMessage(error, "Failed to load staff dashboard."));
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
  const topProfessions = Array.isArray(insights?.top_professions) ? insights.top_professions.slice(0, 4) : [];
  const topBarangays = Array.isArray(insights?.top_barangays) ? insights.top_barangays.slice(0, 6) : [];
  const chartData = useMemo(() => (
    insights?.evaluation_chart || { categories: [], series: [] }
  ), [insights]);

  const compactCards = [
    {
      label: "Total Voters",
      value: whole(snapshot.total_voters),
      note: "Masterlist rows",
      icon: <TeamOutlined />,
    },
    {
      label: "Occupation Coverage",
      value: pct(snapshot.occupation_coverage),
      note: "Tagged profession entries",
      icon: <IdcardOutlined />,
    },
    {
      label: "Barangay Tagged",
      value: whole(snapshot.assigned_barangay),
      note: "Assigned voters",
      icon: <EnvironmentOutlined />,
    },
    {
      label: "Purok Tagged",
      value: whole(snapshot.assigned_purok),
      note: "Assigned voters",
      icon: <ApartmentOutlined />,
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
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
    },
    markers: {
      size: 4,
      hover: { size: 6 },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: Array.isArray(chartData?.categories) ? chartData.categories : [],
      labels: {
        style: {
          colors: "#64748b",
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
          colors: "#64748b",
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
        <title>Staff Dashboard</title>
      </Head>

      <main className="p-4 sm:p-6 space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Staff Overview</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Staff Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Minimal view of the voter masterlist focused on coverage, evaluation trends, and the highest-pressure barangays.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Lead Profession</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{snapshot.leading_profession?.label || "No profession data"}</p>
              <p className="mt-1 text-sm text-slate-500">{whole(snapshot.leading_profession?.total)} voters</p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="space-y-4">
            <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
            <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
          </div>
        ) : !insights ? (
          <Card className="rounded-[28px]">
            <Empty description="No voter analytics available yet." />
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {compactCards.map((card) => (
                <Card key={card.label} className="rounded-[24px] border-0 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                      <p className="mt-1 text-sm text-slate-500">{card.note}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-3 text-lg text-slate-700">{card.icon}</div>
                  </div>
                </Card>
              ))}
            </section>

            <section>
              <Card className="rounded-[30px] border-0 shadow-sm">
                <div className="space-y-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Evaluation Graph</p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-800">Smooth multi-line view of voter quality</h2>
                    </div>
                    <p className="max-w-sm text-sm text-slate-500">
                      A compact trend view comparing total voters with occupation and location completeness.
                    </p>
                  </div>

                  {Array.isArray(chartData?.series) && chartData.series.length > 0 ? (
                    <ApexChart
                      type="line"
                      height={380}
                      options={chartOptions}
                      series={chartData.series}
                    />
                  ) : (
                    <Empty description="No evaluation chart data available." />
                  )}
                </div>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
              <Card className="rounded-[30px] border-0 shadow-sm">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Profession Snapshot</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-800">Most common occupations</h3>
                  </div>

                  {topProfessions.length > 0 ? (
                    <div className="space-y-4">
                      {topProfessions.map((item, index) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Rank {index + 1}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800">{item.label}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-800">{whole(item.total)}</p>
                              <p className="text-xs text-slate-400">{pct(item.share)}</p>
                            </div>
                          </div>
                          <Progress
                            percent={Math.max(0, Math.min(100, Number(item.share || 0)))}
                            showInfo={false}
                            strokeColor="#0f766e"
                            trailColor="#e2e8f0"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No profession snapshot available." />
                  )}
                </div>
              </Card>

              <Card className="rounded-[30px] border-0 shadow-sm">
                <div className="space-y-5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Location Pressure</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-800">Highest-volume barangays</h3>
                    </div>
                    <p className="max-w-md text-sm text-slate-500">
                      Minimalist ranking of the barangays carrying the heaviest voter load right now.
                    </p>
                  </div>

                  {topBarangays.length > 0 ? (
                    <div className="space-y-4">
                      {topBarangays.map((item, index) => (
                        <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Rank {index + 1}</p>
                              <p className="mt-1 text-base font-semibold uppercase tracking-[0.04em] text-slate-900">
                                {item.label}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-semibold text-slate-900">{whole(item.total)}</p>
                              <p className="text-xs text-slate-400">{pct(item.share)}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Progress
                              percent={Math.max(0, Math.min(100, Number(item.share || 0)))}
                              showInfo={false}
                              strokeColor={{
                                "0%": "#0f766e",
                                "100%": "#0ea5e9",
                              }}
                              trailColor="#dbeafe"
                            />
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
