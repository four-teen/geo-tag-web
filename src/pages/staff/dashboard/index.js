import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  ReadOutlined,
  TagsOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Button, Card, Empty, Progress, Skeleton } from "antd";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../../layouts";
import { Auth } from "../../api/auth";
import { GetVoterInsights } from "../../api/dashboard";
import { extractApiErrorMessage } from "../../../utils/api";
import { isVoterEditor } from "../../../utils/access";

const numberFormatter = new Intl.NumberFormat("en-PH");
const whole = (value) => numberFormatter.format(Math.max(0, Number(value || 0)));
const clamp = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const coverage = (value, total) => (
  Number(total || 0) > 0 ? clamp((Number(value || 0) / Number(total)) * 100) : 0
);
const pct = (value) => clamp(value).toFixed(1) + "%";

export default function StaffDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [sessionDetails, setSessionDetails] = useState({
    editorMode: false,
    accountName: "Staff",
    designation: "Staff account",
    scopeLabel: "All barangays",
  });
  const { editorMode, accountName, designation, scopeLabel } = sessionDetails;

  const unauthorized = useCallback((error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    const voterEditor = isVoterEditor();

    setSessionDetails({
      editorMode: voterEditor,
      accountName: Cookies.get("username") || (voterEditor ? "Voter Records Editor" : "Staff"),
      designation: Cookies.get("designation") || (voterEditor ? "Records editor" : "Staff account"),
      scopeLabel: Cookies.get("barangay_scope") === "SPECIFIC" ? "Assigned barangays" : "All barangays",
    });
  }, []);

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
        const response = await GetVoterInsights();
        if (mounted) setInsights(response?.data || null);
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
  const totalVoters = Number(snapshot.total_voters || 0);
  const assignedBarangay = Number(snapshot.assigned_barangay || 0);
  const assignedPurok = Number(snapshot.assigned_purok || 0);
  const occupationTagged = Number(snapshot.occupation_tagged || 0);
  const withoutBarangay = Math.max(0, totalVoters - assignedBarangay);
  const withoutPurok = Math.max(0, totalVoters - assignedPurok);
  const withoutOccupation = Math.max(0, totalVoters - occupationTagged);
  const barangayCoverage = coverage(assignedBarangay, totalVoters);
  const purokCoverage = coverage(assignedPurok, totalVoters);
  const occupationCoverage = coverage(occupationTagged, totalVoters);
  const overallCompletion = (barangayCoverage + purokCoverage + occupationCoverage) / 3;
  const topBarangays = useMemo(
    () => (Array.isArray(insights?.top_barangays) ? insights.top_barangays.slice(0, 6) : []),
    [insights]
  );

  const kpis = [
    {
      label: "Masterlist records",
      value: whole(totalVoters),
      description: scopeLabel + " in your working scope",
      icon: <TeamOutlined />,
      iconClass: "bg-blue-50 text-blue-700",
      detail: "Masterlist",
    },
    {
      label: "Needs barangay",
      value: whole(withoutBarangay),
      description: "Records requiring a primary location",
      icon: <EnvironmentOutlined />,
      iconClass: "bg-amber-50 text-amber-700",
      detail: "Review",
    },
    {
      label: "Needs purok",
      value: whole(withoutPurok),
      description: "Records requiring a precise location",
      icon: <ApartmentOutlined />,
      iconClass: "bg-cyan-50 text-cyan-700",
      detail: "Review",
    },
    {
      label: "Needs occupation",
      value: whole(withoutOccupation),
      description: "Records with incomplete work details",
      icon: <IdcardOutlined />,
      iconClass: "bg-violet-50 text-violet-700",
      detail: "Review",
    },
  ];

  const completionItems = [
    { label: "Barangay assignment", complete: assignedBarangay, percent: barangayCoverage, color: "#0f766e" },
    { label: "Purok assignment", complete: assignedPurok, percent: purokCoverage, color: "#2563eb" },
    { label: "Occupation recorded", complete: occupationTagged, percent: occupationCoverage, color: "#7c3aed" },
  ];

  const reviewItems = [
    { label: "No barangay assignment", value: withoutBarangay, description: "Add the voter's primary location", tone: "bg-amber-50 text-amber-700" },
    { label: "No purok assignment", value: withoutPurok, description: "Complete the voter's precise location", tone: "bg-blue-50 text-blue-700" },
    { label: "Occupation not recorded", value: withoutOccupation, description: "Complete the voter's work details", tone: "bg-violet-50 text-violet-700" },
  ];

  const quickActions = [
    {
      title: "Voter Masterlist",
      description: editorMode
        ? "Search and update existing voter and household records."
        : "Add, search, edit, and manage voter and household records.",
      path: "/voters",
      icon: <TeamOutlined />,
    },
    {
      title: "Locations & Precincts",
      description: "Maintain barangay, purok, and precinct reference data.",
      path: "/barangays",
      icon: <EnvironmentOutlined />,
    },
    {
      title: "Tribes",
      description: "Maintain tribe values used by voter records.",
      path: "/tribes",
      icon: <TagsOutlined />,
    },
    {
      title: "Religions",
      description: "Maintain religion values used by voter records.",
      path: "/religions",
      icon: <ReadOutlined />,
    },
  ];

  return (
    <Layout>
      <Head>
        <title>{editorMode ? "Voter Records Dashboard" : "Staff Dashboard"}</title>
      </Head>

      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">{editorMode ? "Records workspace" : "Staff operations"}</p>
            <h1>{editorMode ? "Voter records workspace" : "Staff masterlist workspace"}</h1>
            <p className="dashboard-description">
              {accountName} · {designation}. Manage voter records, resolve incomplete information, and maintain accurate location data within {scopeLabel.toLowerCase()}.
            </p>
          </div>
          <div className="dashboard-live-badge">
            <span className="dashboard-live-dot" />
            {scopeLabel} · {pct(overallCompletion)} complete
          </div>
        </header>

        {loading ? (
          <div className="space-y-4">
            <Card><Skeleton active paragraph={{ rows: 5 }} /></Card>
            <Card><Skeleton active paragraph={{ rows: 9 }} /></Card>
          </div>
        ) : !insights ? (
          <Card className="dashboard-card">
            <Empty description="No staff dashboard data is available yet." />
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Staff voter workload">
              {kpis.map((item) => (
                <article key={item.label} className="dashboard-kpi">
                  <div className="flex items-start justify-between gap-4">
                    <div className={"dashboard-kpi-icon " + item.iconClass}>{item.icon}</div>
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
                    <p className="dashboard-section-kicker">Staff data work</p>
                    <h2>Masterlist completion</h2>
                    <p>Track the record fields staff should complete during daily masterlist management.</p>
                  </div>
                  <CheckCircleOutlined className="dashboard-heading-icon" />
                </div>

                <div className="dashboard-coverage-list">
                  {completionItems.map((item) => (
                    <div key={item.label} className="dashboard-coverage-item">
                      <div className="dashboard-coverage-copy">
                        <div>
                          <h3>{item.label}</h3>
                          <p>{whole(item.complete)} of {whole(totalVoters)} voter records</p>
                        </div>
                        <strong>{pct(item.percent)}</strong>
                      </div>
                      <Progress
                        percent={clamp(item.percent)}
                        showInfo={false}
                        strokeColor={item.color}
                        trailColor="#e7efed"
                        strokeWidth={10}
                      />
                    </div>
                  ))}
                </div>

                <div className="dashboard-coverage-note">
                  <TeamOutlined />
                  <p>
                    Staff uses the same Voter Masterlist management workspace as the administrator, limited to the account&apos;s assigned scope and access settings.
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
                      <div className={"dashboard-review-count " + item.tone}>{whole(item.value)}</div>
                      <div>
                        <h3>{item.label}</h3>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button className="mt-4" block type="primary" icon={<TeamOutlined />} onClick={() => router.push("/voters")}>
                  Open Voter Masterlist
                </Button>
              </article>
            </section>

            <section className="dashboard-card">
              <div className="dashboard-section-heading dashboard-section-heading--directory">
                <div>
                  <p className="dashboard-section-kicker">Staff tools</p>
                  <h2>Quick access</h2>
                  <p>Open the staff management areas used for voter and reference-data work.</p>
                </div>
                <ArrowRightOutlined className="dashboard-heading-icon" />
              </div>

              <div className="dashboard-directory-grid">
                {quickActions.map((action) => (
                  <button
                    type="button"
                    key={action.title}
                    className="dashboard-directory-item w-full cursor-pointer text-left"
                    onClick={() => router.push(action.path)}
                  >
                    <span className="dashboard-directory-icon" aria-hidden="true">{action.icon}</span>
                    <span className="dashboard-directory-copy">
                      <span className="dashboard-directory-title"><h3>{action.title}</h3></span>
                      <p>{action.description}</p>
                    </span>
                    <span className="dashboard-directory-count" aria-hidden="true">
                      <ArrowRightOutlined />
                      <span>Open</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="dashboard-card dashboard-barangay-directory">
              <div className="dashboard-section-heading dashboard-section-heading--directory">
                <div>
                  <p className="dashboard-section-kicker">Scoped workload</p>
                  <h2>Highest-volume barangays</h2>
                  <p>See where the largest groups of voter records are concentrated in the staff account&apos;s working scope.</p>
                </div>
                <EnvironmentOutlined className="dashboard-heading-icon" />
              </div>

              <div className="dashboard-directory-summary">
                <span><strong>{whole(topBarangays.length)}</strong> listed</span>
                <span className="dashboard-directory-summary--covered">
                  <strong>{whole(totalVoters)}</strong> total voters
                </span>
              </div>

              {topBarangays.length > 0 ? (
                <div className="dashboard-directory-grid">
                  {topBarangays.map((item) => (
                    <article key={item.barangay_id || item.label} className="dashboard-directory-item">
                      <div className="dashboard-directory-icon" aria-hidden="true"><EnvironmentOutlined /></div>
                      <div className="dashboard-directory-copy">
                        <div className="dashboard-directory-title"><h3>{item.label || "Unnamed barangay"}</h3></div>
                        <p>{pct(item.share)} of scoped masterlist</p>
                      </div>
                      <div className="dashboard-directory-count">
                        <strong>{whole(item.total)}</strong>
                        <span>{Number(item.total || 0) === 1 ? "voter" : "voters"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-directory-empty">
                  <Empty description="No barangay workload data is available." />
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </Layout>
  );
}
