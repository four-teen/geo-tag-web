import Head from "next/head";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ApartmentOutlined,
  BarChartOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  SearchOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Empty, Progress, Skeleton } from "antd";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetVoterInsights } from "../api/dashboard";
import { extractApiErrorMessage } from "../../utils/api";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const numberFormatter = new Intl.NumberFormat("en-PH");
const PUROK_PAGE_SIZE = 24;

const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const whole = (value) => numberFormatter.format(Math.max(0, Number(value || 0)));
const coverage = (value, total) => (
  Number(total || 0) > 0 ? (Number(value || 0) / Number(total)) * 100 : 0
);
const clamp = (value) => Math.max(0, Math.min(100, Number(value || 0)));

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [barangaySearch, setBarangaySearch] = useState("");
  const [purokFilter, setPurokFilter] = useState("all");
  const [purokPage, setPurokPage] = useState(1);

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
        const res = await GetVoterInsights({ compact: true });
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
  const barangayDistribution = useMemo(() => (
    Array.isArray(insights?.barangay_distribution) ? insights.barangay_distribution : []
  ), [insights]);
  const barangaySummary = insights?.barangay_summary || {};
  const filteredBarangays = useMemo(() => {
    const query = barangaySearch.trim().toLocaleLowerCase();
    if (!query) return barangayDistribution;

    return barangayDistribution.filter((item) => (
      String(item.label || "").toLocaleLowerCase().includes(query)
    ));
  }, [barangayDistribution, barangaySearch]);
  const purokDistribution = useMemo(() => (
    Array.isArray(insights?.purok_distribution) ? insights.purok_distribution : []
  ), [insights]);
  const purokSummary = insights?.purok_summary || {};
  const chartData = useMemo(() => (
    insights?.evaluation_chart || { categories: [], series: [] }
  ), [insights]);
  const filteredPuroks = useMemo(() => {
    if (purokFilter === "import") {
      return purokDistribution.filter((item) => item.is_import_created);
    }

    if (purokFilter === "existing") {
      return purokDistribution.filter((item) => !item.is_import_created);
    }

    return purokDistribution;
  }, [purokDistribution, purokFilter]);
  const purokPageCount = Math.max(1, Math.ceil(filteredPuroks.length / PUROK_PAGE_SIZE));
  const visiblePuroks = useMemo(() => {
    const start = (purokPage - 1) * PUROK_PAGE_SIZE;
    return filteredPuroks.slice(start, start + PUROK_PAGE_SIZE);
  }, [filteredPuroks, purokPage]);
  const purokChartData = useMemo(() => ({
    categories: visiblePuroks.map((item) => item.label),
    series: [
      {
        name: "Existing purok",
        data: visiblePuroks.map((item) => (item.is_import_created ? 0 : Number(item.total || 0))),
      },
      {
        name: "Created by voter import",
        data: visiblePuroks.map((item) => (item.is_import_created ? Number(item.total || 0) : 0)),
      },
    ],
  }), [visiblePuroks]);

  const totalVoters = Number(snapshot.total_voters || 0);
  const assignedBarangay = Number(snapshot.assigned_barangay || 0);
  const assignedPurok = Number(snapshot.assigned_purok || 0);
  const occupationCoverage = clamp(snapshot.occupation_coverage);
  const barangayCoverage = coverage(assignedBarangay, totalVoters);
  const purokCoverage = coverage(assignedPurok, totalVoters);
  const withoutBarangay = Math.max(0, totalVoters - assignedBarangay);
  const withoutPurok = Math.max(0, assignedBarangay - assignedPurok);
  const withoutOccupation = Math.max(0, Math.round(totalVoters * ((100 - occupationCoverage) / 100)));
  const uniquePuroks = Number(purokSummary.unique_puroks || purokDistribution.length);
  const existingPuroks = Number(purokSummary.existing_puroks || 0);
  const importCreatedPuroks = Number(purokSummary.import_created_puroks || 0);
  const totalBarangays = Number(barangaySummary.total_barangays ?? barangayDistribution.length);
  const barangaysWithVoters = Number(barangaySummary.barangays_with_voters ?? 0);
  const barangaysWithoutVoters = Number(barangaySummary.barangays_without_voters ?? 0);
  const purokChartHeight = Math.max(360, visiblePuroks.length * 34);

  const kpis = [
    {
      label: "Total voters",
      value: whole(totalVoters),
      description: "Registered in the voter masterlist",
      icon: <TeamOutlined />,
      iconClass: "bg-blue-50 text-blue-700",
      detail: "Masterlist",
    },
    {
      label: "Barangay tagged",
      value: whole(assignedBarangay),
      description: `${pct(barangayCoverage)} of all voter records`,
      icon: <EnvironmentOutlined />,
      iconClass: "bg-teal-50 text-teal-700",
      detail: pct(barangayCoverage),
    },
    {
      label: "Purok tagged",
      value: whole(assignedPurok),
      description: `${pct(purokCoverage)} of all voter records`,
      icon: <ApartmentOutlined />,
      iconClass: "bg-emerald-50 text-emerald-700",
      detail: pct(purokCoverage),
    },
    {
      label: "Occupation recorded",
      value: pct(occupationCoverage),
      description: `${whole(withoutOccupation)} records still incomplete`,
      icon: <IdcardOutlined />,
      iconClass: "bg-amber-50 text-amber-700",
      detail: "Data quality",
    },
  ];

  const reviewItems = [
    {
      label: "No barangay assignment",
      value: withoutBarangay,
      description: "Records that still need a primary location",
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Barangay set, purok missing",
      value: withoutPurok,
      description: "Records needing a more precise location",
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Occupation not recorded",
      value: withoutOccupation,
      description: "Records requiring demographic completion",
      tone: "bg-slate-100 text-slate-700",
    },
  ];

  const chartOptions = useMemo(() => ({
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
      redrawOnParentResize: false,
      redrawOnWindowResize: false,
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    colors: ["#0f766e", "#2563eb", "#d97706", "#7c3aed"],
    stroke: {
      curve: "smooth",
      width: [3, 3, 3, 3],
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
      fontSize: "13px",
      labels: { colors: "#475569" },
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

  const purokChartOptions = useMemo(() => ({
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
      redrawOnParentResize: false,
      redrawOnWindowResize: false,
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    colors: ["#0f766e", "#d97706"],
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "68%",
        borderRadius: 4,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (value) => (Number(value) > 0 ? whole(value) : ""),
      style: {
        fontSize: "11px",
        fontWeight: 700,
        colors: ["#ffffff"],
      },
    },
    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontSize: "13px",
      labels: { colors: "#475569" },
    },
    xaxis: {
      categories: purokChartData.categories,
      labels: {
        formatter: (value) => whole(Math.round(Number(value || 0))),
        style: {
          colors: "#64748b",
          fontSize: "11px",
        },
      },
      title: {
        text: "Voter count",
        style: { color: "#64748b", fontSize: "12px", fontWeight: 600 },
      },
    },
    yaxis: {
      labels: {
        maxWidth: 300,
        style: {
          colors: "#475569",
          fontSize: "11px",
        },
      },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (value) => `${whole(value)} voters`,
      },
    },
  }), [purokChartData]);

  return (
    <Layout>
      <Head>
        <title>Administrator Dashboard</title>
      </Head>

      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Administrator overview</p>
            <h1>Voter geographic coverage</h1>
            <p className="dashboard-description">
              Monitor location assignments, identify incomplete records, and review voter data across barangays and puroks.
            </p>
          </div>
          <div className="dashboard-live-badge">
            <span className="dashboard-live-dot" />
            Live masterlist summary
          </div>
        </header>

        {loading ? (
          <div className="space-y-4">
            <Card><Skeleton active paragraph={{ rows: 5 }} /></Card>
            <Card><Skeleton active paragraph={{ rows: 9 }} /></Card>
          </div>
        ) : !insights ? (
          <Card className="dashboard-card">
            <Empty description="No voter analytics available yet." />
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key voter metrics">
              {kpis.map((item) => (
                <article key={item.label} className="dashboard-kpi">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`dashboard-kpi-icon ${item.iconClass}`}>{item.icon}</div>
                    <span className="dashboard-kpi-detail">{item.detail}</span>
                  </div>
                  <p className="dashboard-kpi-label">{item.label}</p>
                  <p className="dashboard-kpi-value">{item.value}</p>
                  <p className="dashboard-kpi-description">{item.description}</p>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
              <article className="dashboard-card">
                <div className="dashboard-section-heading">
                  <div>
                    <p className="dashboard-section-kicker">Location completeness</p>
                    <h2>Geographic coverage</h2>
                  </div>
                  <EnvironmentOutlined className="dashboard-heading-icon" />
                </div>

                <div className="dashboard-coverage-list">
                  <div className="dashboard-coverage-item">
                    <div className="dashboard-coverage-copy">
                      <div>
                        <h3>Barangay assignment</h3>
                        <p>{whole(assignedBarangay)} of {whole(totalVoters)} voters</p>
                      </div>
                      <strong>{pct(barangayCoverage)}</strong>
                    </div>
                    <Progress
                      percent={clamp(barangayCoverage)}
                      showInfo={false}
                      strokeColor="#0f766e"
                      trailColor="#e7efed"
                      strokeWidth={10}
                    />
                  </div>

                  <div className="dashboard-coverage-item">
                    <div className="dashboard-coverage-copy">
                      <div>
                        <h3>Purok assignment</h3>
                        <p>{whole(assignedPurok)} of {whole(totalVoters)} voters</p>
                      </div>
                      <strong>{pct(purokCoverage)}</strong>
                    </div>
                    <Progress
                      percent={clamp(purokCoverage)}
                      showInfo={false}
                      strokeColor="#2563eb"
                      trailColor="#e8eefb"
                      strokeWidth={10}
                    />
                  </div>
                </div>

                <div className="dashboard-coverage-note">
                  <BarChartOutlined />
                  <p>
                    Barangay assignment is the primary location baseline. Purok assignment shows the more precise level of completed geo-tagging.
                  </p>
                </div>
              </article>

              <article className="dashboard-card">
                <div className="dashboard-section-heading">
                  <div>
                    <p className="dashboard-section-kicker dashboard-section-kicker--warning">Action queue</p>
                    <h2>Records requiring attention</h2>
                  </div>
                  <WarningOutlined className="dashboard-heading-icon dashboard-heading-icon--warning" />
                </div>

                <div className="dashboard-review-list">
                  {reviewItems.map((item) => (
                    <div key={item.label} className="dashboard-review-item">
                      <div className={`dashboard-review-count ${item.tone}`}>{whole(item.value)}</div>
                      <div>
                        <h3>{item.label}</h3>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="dashboard-card dashboard-barangay-directory">
              <div className="dashboard-section-heading dashboard-section-heading--directory">
                <div>
                  <p className="dashboard-section-kicker">Barangay directory</p>
                  <h2>All available barangays</h2>
                  <p>Review every barangay currently registered in the system, including areas without voter records.</p>
                </div>
                <EnvironmentOutlined className="dashboard-heading-icon" />
              </div>

              <div className="dashboard-directory-summary" aria-label="Barangay directory summary">
                <span><strong>{whole(totalBarangays)}</strong> available</span>
                <span className="dashboard-directory-summary--covered">
                  <strong>{whole(barangaysWithVoters)}</strong> with voters
                </span>
                <span className="dashboard-directory-summary--empty">
                  <strong>{whole(barangaysWithoutVoters)}</strong> without voters
                </span>
              </div>

              <div className="dashboard-directory-toolbar">
                <label className="dashboard-directory-search">
                  <SearchOutlined />
                  <input
                    type="search"
                    value={barangaySearch}
                    onChange={(event) => setBarangaySearch(event.target.value)}
                    placeholder="Search barangay"
                    aria-label="Search all available barangays"
                  />
                </label>
                <p>
                  Showing <strong>{whole(filteredBarangays.length)}</strong> of {whole(totalBarangays)} barangays
                </p>
              </div>

              {filteredBarangays.length > 0 ? (
                <div className="dashboard-directory-grid">
                  {filteredBarangays.map((item) => {
                    const voterTotal = Number(item.total || 0);
                    const isInactive = String(item.status || "ACTIVE").toUpperCase() !== "ACTIVE";

                    return (
                      <article
                        key={item.barangay_id || item.label}
                        className={`dashboard-directory-item${voterTotal === 0 ? " is-empty" : ""}`}
                      >
                        <div className="dashboard-directory-icon" aria-hidden="true">
                          <EnvironmentOutlined />
                        </div>
                        <div className="dashboard-directory-copy">
                          <div className="dashboard-directory-title">
                            <h3>{item.label || "Unnamed barangay"}</h3>
                            {isInactive && <span>Inactive</span>}
                          </div>
                        </div>
                        <div className="dashboard-directory-count">
                          <strong>{whole(voterTotal)}</strong>
                          <span>{voterTotal === 1 ? "voter" : "voters"}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-directory-empty">
                  <Empty description={barangaySearch ? "No barangay matches your search." : "No barangays are available."} />
                </div>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-section-heading dashboard-section-heading--chart">
                <div>
                  <p className="dashboard-section-kicker">Purok distribution</p>
                  <h2>Voters by unique purok</h2>
                  <p>Each bar shows the voter count. Orange identifies puroks automatically created during a voter import.</p>
                </div>
                <ApartmentOutlined className="dashboard-heading-icon" />
              </div>

              <div className="dashboard-purok-summary" aria-label="Purok classification summary">
                <span><strong>{whole(uniquePuroks)}</strong> unique puroks</span>
                <span className="dashboard-purok-summary--existing"><strong>{whole(existingPuroks)}</strong> existing</span>
                <span className="dashboard-purok-summary--created"><strong>{whole(importCreatedPuroks)}</strong> created by import</span>
              </div>

              <div className="dashboard-purok-toolbar" aria-label="Purok chart controls">
                <div className="dashboard-purok-filters" role="group" aria-label="Filter puroks">
                  {[
                    { value: "all", label: "All" },
                    { value: "existing", label: "Existing" },
                    { value: "import", label: "Created by import" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={purokFilter === item.value ? "is-active" : ""}
                      aria-pressed={purokFilter === item.value}
                      onClick={() => {
                        setPurokFilter(item.value);
                        setPurokPage(1);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="dashboard-purok-pagination" aria-label="Purok chart pages">
                  <span>
                    {filteredPuroks.length > 0
                      ? `${whole(((purokPage - 1) * PUROK_PAGE_SIZE) + 1)}-${whole(Math.min(purokPage * PUROK_PAGE_SIZE, filteredPuroks.length))} of ${whole(filteredPuroks.length)}`
                      : "No puroks"}
                  </span>
                  <button
                    type="button"
                    disabled={purokPage <= 1}
                    onClick={() => setPurokPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={purokPage >= purokPageCount}
                    onClick={() => setPurokPage((page) => Math.min(purokPageCount, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>

              {visiblePuroks.length > 0 ? (
                <ApexChart
                  type="bar"
                  height={purokChartHeight}
                  options={purokChartOptions}
                  series={purokChartData.series}
                />
              ) : (
                <Empty description="No puroks match this classification." />
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-section-heading dashboard-section-heading--chart">
                <div>
                  <p className="dashboard-section-kicker">Data quality</p>
                  <h2>Voter record evaluation</h2>
                  <p>Compare age-group volume with occupation and location completeness.</p>
                </div>
                <BarChartOutlined className="dashboard-heading-icon" />
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
            </section>
          </>
        )}
      </main>

    </Layout>
  );
}
