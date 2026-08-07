import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  AuditOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  LoginOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Empty, Input, Select, Skeleton, Table, Tag } from "antd";
import dayjs from "dayjs";
import moment from "moment-timezone";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { getStaffActivityLogs } from "../api/activity-logs";
import { extractApiErrorMessage } from "../../utils/api";

const MANILA_TIMEZONE = "Asia/Manila";
const DEFAULT_FILTERS = {
  date_from: "",
  date_to: "",
  user_id: undefined,
  role: undefined,
  event_type: undefined,
  page_path: undefined,
  status: undefined,
  search: "",
};

const eventTag = {
  LOGIN: { color: "green", label: "Login" },
  LOGOUT: { color: "default", label: "Logout" },
  PAGE_VIEW: { color: "blue", label: "Page opened" },
  ACTION: { color: "gold", label: "Work action" },
};

const resourceLabels = {
  ACCOUNTS: "account",
  ACCOUNT: "account",
  BARANGAY: "barangay",
  PUROK: "purok",
  PRECINCT: "precinct",
  RELIGIONS: "religion",
  TRIBES: "tribe",
  VOTERS: "voter record",
  RECIPIENTS: "voter record",
};

const friendlyDescription = (value) => {
  const description = String(value || "")
    .replace(/#(\d+)/g, "record $1")
    .trim();
  return description ? description.charAt(0).toUpperCase() + description.slice(1) : "Activity recorded";
};

const displayPageName = (record) => {
  const providedName = String(record.page_name || "").trim();
  if (providedName && !providedName.startsWith("/")) return providedName;

  const path = String(record.request_path || "").toLowerCase();
  if (path.includes("voter") || path.includes("recipient")) return "Voter Masterlist";
  if (path.includes("barangay") || path.includes("purok") || path.includes("precinct")) return "Locations & Precincts";
  if (path.includes("tribe")) return "Tribes";
  if (path.includes("religion")) return "Religions";
  if (path.includes("login")) return "Login";
  return "Staff workspace";
};

const displayAction = (record) => {
  if (record.event_type === "LOGIN") return record.action_status === "FAILED" ? "Failed login attempt" : "Logged in";
  if (record.event_type === "LOGOUT") return record.action_status === "FAILED" ? "Failed logout attempt" : "Logged out";
  if (record.event_type === "PAGE_VIEW") return "Opened " + displayPageName(record);

  const eventCode = String(record.event_code || "").toUpperCase();
  if (eventCode === "ACTION") return friendlyDescription(record.description);
  if (eventCode === "CHANGE_PASSWORD") return "Changed account password";
  if (eventCode === "SESSION_ACTIVITY") return "Previous staff activity";

  const automaticAction = eventCode.match(/^(CREATE|UPDATE|DELETE)_(.+)$/);
  if (automaticAction) {
    const verbs = { CREATE: "Added", UPDATE: "Updated", DELETE: "Deleted" };
    const resource = resourceLabels[automaticAction[2]] || "record";
    const target = record.entity_id ? " " + record.entity_id : "";
    return verbs[automaticAction[1]] + " " + resource + target;
  }

  return friendlyDescription(record.description);
};

const formatTimestamp = (value) => {
  if (!value) return "Not recorded";
  const parsed = moment.tz(value, MANILA_TIMEZONE);
  return parsed.isValid() ? parsed.format("MMM D, YYYY, h:mm:ss A") : String(value);
};

export default function StaffActivityLogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    users: [],
    roles: [],
    event_types: [],
    pages: [],
    statuses: [],
  });
  const [summary, setSummary] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    logins: 0,
    page_views: 0,
    actions: 0,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const currentPage = pagination.current;
  const pageSize = pagination.pageSize;

  const unauthorized = useCallback((error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  }, [router]);

  const loadLogs = useCallback(async () => {
    const params = Object.entries(appliedFilters).reduce((result, [key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        result[key] = value;
      }
      return result;
    }, {
      page: currentPage,
      per_page: pageSize,
    });

    try {
      setLoading(true);
      const response = await getStaffActivityLogs(params);
      const payload = response?.data?.data || {};
      const pageData = payload.pagination || {};
      const options = payload.filters || {};

      setRows(Array.isArray(payload.items) ? payload.items : []);
      setSummary((current) => ({ ...current, ...(payload.summary || {}) }));
      setFilterOptions({
        users: Array.isArray(options.users) ? options.users : [],
        roles: Array.isArray(options.roles) ? options.roles : [],
        event_types: Array.isArray(options.event_types) ? options.event_types : [],
        pages: Array.isArray(options.pages) ? options.pages : [],
        statuses: Array.isArray(options.statuses) ? options.statuses : [],
      });
      setPagination((current) => ({
        ...current,
        current: Number(pageData.current_page || current.current),
        pageSize: Number(pageData.per_page || current.pageSize),
        total: Number(pageData.total || 0),
      }));
    } catch (error) {
      if (!unauthorized(error)) {
        toast.error(extractApiErrorMessage(error, "Failed to load staff activity logs."));
      }
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, currentPage, pageSize, unauthorized]);

  useEffect(() => {
    let mounted = true;

    const authorize = async () => {
      const destination = await Auth(router.pathname);
      if (!mounted) return;

      if (destination !== router.pathname) {
        router.push({ pathname: destination });
        return;
      }

      await loadLogs();
    };

    if (router.isReady) authorize();
    return () => {
      mounted = false;
    };
  }, [loadLogs, router]);

  const summaryCards = useMemo(() => ([
    {
      label: "Filtered activities",
      value: summary.total,
      description: "All matching staff activity",
      icon: <AuditOutlined />,
      iconClass: "bg-slate-100 text-slate-700",
    },
    {
      label: "Staff logins",
      value: summary.logins,
      description: "Times staff signed in",
      icon: <LoginOutlined />,
      iconClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Pages accessed",
      value: summary.page_views,
      description: "Pages opened by staff",
      icon: <EyeOutlined />,
      iconClass: "bg-blue-50 text-blue-700",
    },
    {
      label: "Actions performed",
      value: summary.actions,
      description: summary.failed > 0 ? String(summary.failed) + " unsuccessful activity record(s)" : "All shown activity was successful",
      icon: summary.failed > 0 ? <ThunderboltOutlined /> : <CheckCircleOutlined />,
      iconClass: summary.failed > 0 ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700",
    },
  ]), [summary]);

  const columns = useMemo(() => [
    {
      title: "Date and time",
      dataIndex: "created_at",
      key: "created_at",
      width: 225,
      render: (value) => (
        <div className="activity-log-time">
          <strong>{formatTimestamp(value)}</strong>
          <span>Asia/Manila</span>
        </div>
      ),
    },
    {
      title: "Staff account",
      dataIndex: "username",
      key: "username",
      width: 190,
      render: (value, record) => (
        <div className="activity-log-person">
          <strong>{value || "Unknown account"}</strong>
          <span>{record.role_label || record.role || "Staff"}</span>
        </div>
      ),
    },
    {
      title: "Activity",
      dataIndex: "event_type",
      key: "event_type",
      width: 140,
      render: (value) => {
        const config = eventTag[value] || eventTag.ACTION;
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Page accessed",
      dataIndex: "page_name",
      key: "page_name",
      width: 210,
      render: (_value, record) => (
        <div className="activity-log-page-name">
          <strong>{displayPageName(record)}</strong>
        </div>
      ),
    },
    {
      title: "Action performed",
      dataIndex: "description",
      key: "description",
      width: 300,
      render: (_value, record) => (
        <div className="activity-log-action">
          <strong>{displayAction(record)}</strong>
        </div>
      ),
    },
    {
      title: "Result and IP address",
      dataIndex: "action_status",
      key: "action_status",
      width: 175,
      render: (value, record) => (
        <div className="activity-log-result">
          <Tag color={value === "FAILED" ? "red" : "green"}>
            {value === "FAILED" ? "Failed" : "Successful"}
          </Tag>
          <span>{record.ip_address ? "IP: " + record.ip_address : "IP not available"}</span>
        </div>
      ),
    },
  ], []);

  const applyFilters = () => {
    setPagination((current) => ({ ...current, current: 1 }));
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPagination((current) => ({ ...current, current: 1 }));
    setAppliedFilters(DEFAULT_FILTERS);
  };

  return (
    <Layout>
      <Head>
        <title>Staff Activity Log</title>
      </Head>

      <main className="dashboard-page activity-log-page">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Administrator review</p>
            <h1>Staff activity log</h1>
            <p className="dashboard-description">
              Review who logged in, which pages were accessed, what actions were performed, and the exact recorded time.
            </p>
          </div>
          <div className="dashboard-live-badge">
            <span className="dashboard-live-dot" />
            Asia/Manila timestamps
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Activity summary">
          {summaryCards.map((item) => (
            <article key={item.label} className="dashboard-kpi">
              <div className="flex items-start justify-between gap-4">
                <div className={"dashboard-kpi-icon " + item.iconClass}>{item.icon}</div>
              </div>
              <p className="dashboard-kpi-label">{item.label}</p>
              <p className="dashboard-kpi-value">{Number(item.value || 0).toLocaleString("en-PH")}</p>
              <p className="dashboard-kpi-description">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-card activity-log-filter-card">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-kicker">Required filters</p>
              <h2>Find staff activity</h2>
              <p>Combine any filters below, then select Apply filters.</p>
            </div>
            <SearchOutlined className="dashboard-heading-icon" />
          </div>

          <div className="activity-log-filter-grid">
            <label>
              <span>Date from</span>
              <DatePicker
                value={filters.date_from ? dayjs(filters.date_from) : null}
                onChange={(_date, dateString) => setFilters((current) => ({ ...current, date_from: dateString }))}
                format="YYYY-MM-DD"
                placeholder="Start date"
              />
            </label>
            <label>
              <span>Date to</span>
              <DatePicker
                value={filters.date_to ? dayjs(filters.date_to) : null}
                onChange={(_date, dateString) => setFilters((current) => ({ ...current, date_to: dateString }))}
                format="YYYY-MM-DD"
                placeholder="End date"
              />
            </label>
            <label>
              <span>Staff member</span>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                value={filters.user_id}
                options={filterOptions.users}
                placeholder="All staff members"
                onChange={(value) => setFilters((current) => ({ ...current, user_id: value }))}
              />
            </label>
            <label>
              <span>Staff role</span>
              <Select
                allowClear
                value={filters.role}
                options={filterOptions.roles}
                placeholder="All staff roles"
                onChange={(value) => setFilters((current) => ({ ...current, role: value }))}
              />
            </label>
            <label>
              <span>Activity type</span>
              <Select
                allowClear
                value={filters.event_type}
                options={filterOptions.event_types}
                placeholder="Login, page opened, or work action"
                onChange={(value) => setFilters((current) => ({ ...current, event_type: value }))}
              />
            </label>
            <label>
              <span>Page accessed</span>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                value={filters.page_path}
                options={filterOptions.pages}
                placeholder="All staff pages"
                onChange={(value) => setFilters((current) => ({ ...current, page_path: value }))}
              />
            </label>
            <label>
              <span>Result</span>
              <Select
                allowClear
                value={filters.status}
                options={filterOptions.statuses}
                placeholder="Successful or failed"
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              />
            </label>
            <label>
              <span>Keyword</span>
              <Input
                allowClear
                value={filters.search}
                prefix={<SearchOutlined />}
                placeholder="Search staff or activity"
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onPressEnter={applyFilters}
              />
            </label>
          </div>

          <div className="activity-log-filter-actions">
            <Button onClick={resetFilters}>Reset</Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>Apply filters</Button>
          </div>
        </section>

        <section className="dashboard-card activity-log-table-card">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-section-kicker">Chronological review</p>
              <h2>Recorded staff timeline</h2>
              <p>{Number(pagination.total || 0).toLocaleString("en-PH")} matching activity record(s), newest first.</p>
            </div>
            <AuditOutlined className="dashboard-heading-icon" />
          </div>

          {loading && rows.length === 0 ? (
            <Skeleton active paragraph={{ rows: 10 }} />
          ) : (
            <Table
              rowKey={(record) => record.log_id || record.id || [record.created_at, record.user_id, record.event_code].join("-")}
              columns={columns}
              dataSource={rows}
              loading={loading}
              scroll={{ x: 1200 }}
              locale={{ emptyText: <Empty description="No staff activity matches the selected filters." /> }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total, range) => range[0] + "-" + range[1] + " of " + total,
                onChange: (current, pageSize) => {
                  setPagination((previous) => ({
                    ...previous,
                    current: pageSize !== previous.pageSize ? 1 : current,
                    pageSize,
                  }));
                },
              }}
            />
          )}
        </section>
      </main>
    </Layout>
  );
}
