import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BarChartOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Input, Pagination, Select, Table, Tag } from 'antd';
import Cookies from 'js-cookie';
import { toast } from 'react-toastify';
import Layout from '../layouts';
import { Auth } from '../api/auth';
import { GetVoterReport } from '../api/reports';
import { extractApiErrorMessage } from '../../utils/api';

const numberFormatter = new Intl.NumberFormat('en-PH');
const whole = (value) => numberFormatter.format(Math.max(0, Number(value || 0)));

const generatedLabel = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Not generated';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const asText = (value, fallback = '-') => String(value || '').trim() || fallback;
const reportGroupKey = (group) => `${Number(group?.barangay_id || 0)}:${group?.barangay_name || ''}`;
const fileSafeName = (value) => String(value || 'barangay')
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLocaleLowerCase() || 'barangay';
const REPORT_PROGRESS_LIMIT = 94;
const REPORT_PROGRESS_COMPLETE_DELAY = 220;
const VIEW_PROGRESS_INTERVAL = 105;

export default function ReportsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewLoading, setViewLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(5);
  const [printing, setPrinting] = useState(false);
  const [printBarangayKey, setPrintBarangayKey] = useState(null);
  const [exportingBarangayKey, setExportingBarangayKey] = useState(null);
  const [report, setReport] = useState(null);
  const [view, setView] = useState('summary');
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(10);
  const [consolidatedPage, setConsolidatedPage] = useState(1);
  const [consolidatedPageSize, setConsolidatedPageSize] = useState(2);
  const [barangayId, setBarangayId] = useState();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const progressTimerRef = useRef(null);
  const viewProgressTimerRef = useRef(null);
  const viewCompletionTimerRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const viewSequenceRef = useRef(0);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const clearViewProgressTimers = useCallback(() => {
    if (viewProgressTimerRef.current) {
      window.clearInterval(viewProgressTimerRef.current);
      viewProgressTimerRef.current = null;
    }
    if (viewCompletionTimerRef.current) {
      window.clearTimeout(viewCompletionTimerRef.current);
      viewCompletionTimerRef.current = null;
    }
  }, []);

  const unauthorized = useCallback((error) => {
    if (error?.response?.status === 401) {
      Cookies.remove('accessToken');
      router.push({ pathname: '/' });
      return true;
    }
    return false;
  }, [router]);

  const loadReport = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    let reportReady = false;
    requestSequenceRef.current = requestId;
    viewSequenceRef.current += 1;
    clearProgressTimer();
    clearViewProgressTimers();
    setViewLoading(false);
    setLoading(true);
    setLoadingProgress(5);
    progressTimerRef.current = window.setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= REPORT_PROGRESS_LIMIT) return current;
        const increment = current < 35 ? 7 : current < 68 ? 4 : current < 86 ? 2 : 1;
        return Math.min(REPORT_PROGRESS_LIMIT, current + increment);
      });
    }, 320);

    try {
      const response = await GetVoterReport({
        barangay_id: barangayId,
        status,
      }, {
        onDownloadProgress: ({ loaded, total, progress }) => {
          if (requestId !== requestSequenceRef.current) return;
          const ratio = Number.isFinite(progress)
            ? progress
            : Number(total) > 0 ? Number(loaded) / Number(total) : null;
          if (ratio === null) return;
          setLoadingProgress((current) => Math.max(
            current,
            Math.min(96, Math.round(ratio * 96))
          ));
        },
      });
      if (requestId !== requestSequenceRef.current) return;
      setReport(response?.data || null);
      reportReady = true;
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return;
      setReport(null);
      if (!unauthorized(error)) {
        toast.error(extractApiErrorMessage(error, 'Failed to generate voter reports.'));
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        clearProgressTimer();
        if (reportReady) {
          setLoadingProgress(100);
          await new Promise((resolve) => window.setTimeout(resolve, REPORT_PROGRESS_COMPLETE_DELAY));
          if (requestId === requestSequenceRef.current) setLoading(false);
        } else {
          setLoadingProgress(0);
          setLoading(false);
        }
      }
    }
  }, [barangayId, clearProgressTimer, clearViewProgressTimers, status, unauthorized]);

  const changeReportView = useCallback((nextView) => {
    setView(nextView);
    if (loading) return;

    clearViewProgressTimers();
    const transitionId = viewSequenceRef.current + 1;
    let nextProgress = 8;
    viewSequenceRef.current = transitionId;
    setViewLoading(true);
    setLoadingProgress(nextProgress);

    viewProgressTimerRef.current = window.setInterval(() => {
      if (transitionId !== viewSequenceRef.current) return;
      nextProgress = nextProgress < 70
        ? Math.min(70, nextProgress + 13)
        : Math.min(96, nextProgress + 7);
      setLoadingProgress(nextProgress);

      if (nextProgress >= 96) {
        window.clearInterval(viewProgressTimerRef.current);
        viewProgressTimerRef.current = null;
        setLoadingProgress(100);
        viewCompletionTimerRef.current = window.setTimeout(() => {
          if (transitionId === viewSequenceRef.current) setViewLoading(false);
          viewCompletionTimerRef.current = null;
        }, REPORT_PROGRESS_COMPLETE_DELAY);
      }
    }, VIEW_PROGRESS_INTERVAL);
  }, [clearViewProgressTimers, loading]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
    viewSequenceRef.current += 1;
    clearProgressTimer();
    clearViewProgressTimers();
  }, [clearProgressTimer, clearViewProgressTimers]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const auth = await Auth(router?.pathname);
      if (!mounted) return;
      if (auth !== router?.pathname) {
        router.push({ pathname: auth });
        return;
      }
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (ready) loadReport();
  }, [ready, loadReport]);

  const totals = report?.totals || {};
  const summaries = useMemo(
    () => (Array.isArray(report?.barangays) ? report.barangays : []),
    [report]
  );
  const options = useMemo(
    () => (Array.isArray(report?.barangay_options) ? report.barangay_options : []),
    [report]
  );
  const records = useMemo(
    () => (Array.isArray(report?.records) ? report.records : []),
    [report]
  );

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return records;
    return records.filter((record) => [
      record.full_name,
      record.voters_id_number,
      record.barangay_name,
      record.purok_name,
      record.precinct_no,
      record.status,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [records, search]);

  const groupedRecords = useMemo(() => {
    const groups = new Map();
    visibleRecords.forEach((record) => {
      const key = `${record.barangay_id}:${record.barangay_name}`;
      if (!groups.has(key)) {
        groups.set(key, {
          barangay_id: Number(record.barangay_id || 0),
          barangay_name: record.barangay_name,
          records: [],
        });
      }
      groups.get(key).records.push(record);
    });
    return Array.from(groups.values());
  }, [visibleRecords]);

  const printedBarangayGroup = useMemo(
    () => printBarangayKey
      ? groupedRecords.find((group) => reportGroupKey(group) === printBarangayKey) || null
      : null,
    [groupedRecords, printBarangayKey]
  );

  const displayedGroupedRecords = useMemo(() => {
    if (printing) return printedBarangayGroup ? [printedBarangayGroup] : groupedRecords;
    const start = (consolidatedPage - 1) * consolidatedPageSize;
    return groupedRecords.slice(start, start + consolidatedPageSize);
  }, [consolidatedPage, consolidatedPageSize, groupedRecords, printedBarangayGroup, printing]);

  useEffect(() => {
    setSummaryPage(1);
    setConsolidatedPage(1);
  }, [report, search]);

  const finishPrinting = useCallback(() => {
    setPrinting(false);
    setPrintBarangayKey(null);
  }, []);

  useEffect(() => {
    window.addEventListener('afterprint', finishPrinting);
    return () => window.removeEventListener('afterprint', finishPrinting);
  }, [finishPrinting]);

  const summaryColumns = [
    {
      title: 'Barangay',
      dataIndex: 'barangay_name',
      key: 'barangay_name',
      render: (value, row) => (
        <div className='report-barangay-cell'>
          <EnvironmentOutlined />
          <div>
            <strong>{asText(value, 'Unassigned')}</strong>
            {row.barangay_status === 'INACTIVE' ? <span>Inactive barangay</span> : null}
          </div>
        </div>
      ),
    },
    {
      title: 'Active voters',
      dataIndex: 'active',
      key: 'active',
      align: 'right',
      render: (value) => <strong className='report-number report-number--active'>{whole(value)}</strong>,
    },
    {
      title: 'Inactive voters',
      dataIndex: 'inactive',
      key: 'inactive',
      align: 'right',
      render: (value) => <strong className='report-number report-number--inactive'>{whole(value)}</strong>,
    },
    {
      title: 'Overall total',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (value) => <strong className='report-number'>{whole(value)}</strong>,
    },
    {
      title: 'Active rate',
      key: 'active_rate',
      align: 'right',
      render: (_, row) => (
        <span>{Number(row.total || 0) > 0 ? `${((Number(row.active) / Number(row.total)) * 100).toFixed(1)}%` : '0.0%'}</span>
      ),
    },
  ];

  const detailColumns = [
    {
      title: '#',
      key: 'number',
      width: 56,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Purok / Sitio',
      dataIndex: 'purok_name',
      key: 'purok_name',
      render: (value) => <strong>{asText(value, 'Unassigned')}</strong>,
    },
    {
      title: 'Precinct',
      dataIndex: 'precinct_no',
      key: 'precinct_no',
      render: (value) => <span className='report-precinct'>{asText(value, 'Unassigned')}</span>,
    },
    {
      title: 'Voter name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (value) => <span className='report-voter-name'>{asText(value, 'No name')}</span>,
    },
    {
      title: 'Voter ID',
      dataIndex: 'voters_id_number',
      key: 'voters_id_number',
      render: (value) => asText(value, 'Not assigned'),
    },
    {
      title: 'Sex',
      dataIndex: 'sex',
      key: 'sex',
      render: (value) => asText(value),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'red'}>{value}</Tag>,
    },
  ];

  const selectedBarangay = options.find((item) => Number(item.barangay_id) === Number(barangayId));
  const scopeLabel = selectedBarangay?.barangay_name || 'All barangays';
  const statusLabel = status === 'ALL' ? 'All voter statuses' : `${status} voters only`;
  const loadingViewLabel = view === 'summary' ? 'per barangay report' : 'consolidated report';
  const isReportLoading = loading || viewLoading;
  const printedBarangaySummary = printedBarangayGroup
    ? summaries.find((row) => Number(row.barangay_id) === Number(printedBarangayGroup.barangay_id))
    : null;
  const displayedTotals = printing && printedBarangayGroup ? {
    total: printedBarangaySummary?.total,
    active: printedBarangaySummary?.active,
    inactive: printedBarangaySummary?.inactive,
    barangays: 1,
  } : totals;
  const displayedScopeLabel = printing && printedBarangayGroup
    ? printedBarangayGroup.barangay_name
    : scopeLabel;
  const displayedMatchingRecords = printing && printedBarangayGroup
    ? printedBarangayGroup.records.length
    : visibleRecords.length;
  const displayedGeneratedRecords = printing && printedBarangayGroup
    ? records.filter((row) => Number(row.barangay_id) === Number(printedBarangayGroup.barangay_id)).length
    : totals.filtered_records;

  const exportWorkbook = async () => {
    if (!report) return;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summaryRows = summaries.map((row) => ({
        Barangay: row.barangay_name,
        Active: Number(row.active || 0),
        Inactive: Number(row.inactive || 0),
        Total: Number(row.total || 0),
        'Active Rate': Number(row.total || 0) > 0
          ? Number(((Number(row.active) / Number(row.total)) * 100).toFixed(1)) / 100
          : 0,
      }));
      const detailRows = visibleRecords.map((row, index) => ({
        No: index + 1,
        Barangay: row.barangay_name,
        'Purok / Sitio': row.purok_name,
        Precinct: row.precinct_no,
        'Voter Name': row.full_name,
        'Voter ID': row.voters_id_number,
        Sex: row.sex,
        Status: row.status,
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      summarySheet['!cols'] = [28, 12, 12, 12, 14].map((wch) => ({ wch }));
      detailSheet['!cols'] = [7, 24, 24, 16, 34, 20, 10, 12].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Barangay Summary');
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Consolidated Report');
      XLSX.writeFile(workbook, `voter-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      toast.error('Unable to export the report workbook.');
    }
  };

  const exportBarangayWorkbook = async (group) => {
    const key = reportGroupKey(group);
    const groupSummary = summaries.find((row) => Number(row.barangay_id) === Number(group.barangay_id));
    setExportingBarangayKey(key);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet([{
        Barangay: group.barangay_name,
        Active: Number(groupSummary?.active || 0),
        Inactive: Number(groupSummary?.inactive || 0),
        Total: Number(groupSummary?.total || 0),
        'Exported Records': group.records.length,
        'Voter Status Filter': statusLabel,
        'Search Filter': search.trim() || 'None',
        'Generated At': generatedLabel(report?.generated_at),
      }]);
      const detailRows = group.records.map((row, index) => ({
        No: index + 1,
        Barangay: row.barangay_name,
        'Purok / Sitio': row.purok_name,
        Precinct: row.precinct_no,
        'Voter Name': row.full_name,
        'Voter ID': row.voters_id_number,
        Sex: row.sex,
        Status: row.status,
      }));
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      summarySheet['!cols'] = [28, 12, 12, 12, 18, 22, 28, 24].map((wch) => ({ wch }));
      detailSheet['!cols'] = [7, 24, 24, 16, 34, 20, 10, 12].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Barangay Summary');
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Voter Records');
      XLSX.writeFile(
        workbook,
        `voter-report-${fileSafeName(group.barangay_name)}-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (error) {
      toast.error(`Unable to export the ${group.barangay_name} report.`);
    } finally {
      setExportingBarangayKey(null);
    }
  };

  const printReport = (barangayKey = null) => {
    setPrintBarangayKey(barangayKey);
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(finishPrinting, 0);
    }, 0);
  };

  return (
    <Layout>
      <Head><title>Administrator Reports</title></Head>
      <main className='report-page'>
        <section className='report-hero'>
          <div className='report-hero-copy'>
            <div className='report-hero-icon'><FileTextOutlined /></div>
            <div>
              <p className='report-eyebrow'>Administrator reporting center</p>
              <h1>Voter Reports</h1>
              <p>Review active and inactive voters per barangay or generate the consolidated masterlist sorted by purok and precinct.</p>
            </div>
          </div>
          <div className='report-actions report-no-print'>
            <Button icon={<PrinterOutlined />} onClick={() => printReport()} disabled={!report}>Print report</Button>
            <Button type='primary' icon={<DownloadOutlined />} onClick={exportWorkbook} disabled={!report}>Export Excel</Button>
          </div>
        </section>

        <section className='report-toolbar report-no-print' aria-label='Report controls'>
          <div className='report-view-switch' role='group' aria-label='Report view'>
            <button
              type='button'
              className={view === 'summary' ? 'is-active' : ''}
              aria-pressed={view === 'summary'}
              onClick={() => changeReportView('summary')}
            >
              <BarChartOutlined />
              <span>Per Barangay Summary</span>
            </button>
            <button
              type='button'
              className={view === 'consolidated' ? 'is-active' : ''}
              aria-pressed={view === 'consolidated'}
              onClick={() => changeReportView('consolidated')}
            >
              <TeamOutlined />
              <span>Consolidated Report</span>
            </button>
          </div>

          <div className='report-filter-grid'>
            <label className='report-filter'>
              <span>Barangay scope</span>
              <Select
                allowClear
                showSearch
                optionFilterProp='label'
                placeholder='All barangays'
                value={barangayId}
                options={options.map((item) => ({
                  value: Number(item.barangay_id),
                  label: item.barangay_name,
                }))}
                onChange={setBarangayId}
              />
            </label>
            <label className='report-filter'>
              <span>Consolidated voter status</span>
              <Select
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ALL', label: 'Active and inactive' },
                  { value: 'ACTIVE', label: 'Active only' },
                  { value: 'INACTIVE', label: 'Inactive only' },
                ]}
              />
            </label>
            <label className='report-filter report-filter--search'>
              <span>Find in consolidated report</span>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder='Name, voter ID, purok or precinct'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadReport}>Refresh</Button>
          </div>
        </section>

        <section className='report-print-meta'>
          <div>
            <strong>
              {view === 'summary'
                ? 'Active and Inactive Voters per Barangay'
                : printedBarangayGroup
                  ? `Consolidated Voter Report - ${printedBarangayGroup.barangay_name}`
                  : 'Consolidated Voter Report'}
            </strong>
            <span>{displayedScopeLabel} · {view === 'summary' ? 'All voter statuses' : statusLabel}</span>
          </div>
          <span>Generated {generatedLabel(report?.generated_at)}</span>
        </section>

        <section className='report-kpis' aria-label='Report totals'>
          <Card className='report-kpi report-kpi--total'>
            <TeamOutlined />
            <div><span>Overall voters</span><strong>{whole(displayedTotals.total)}</strong></div>
          </Card>
          <Card className='report-kpi report-kpi--active'>
            <CheckCircleOutlined />
            <div><span>Active voters</span><strong>{whole(displayedTotals.active)}</strong></div>
          </Card>
          <Card className='report-kpi report-kpi--inactive'>
            <StopOutlined />
            <div><span>Inactive voters</span><strong>{whole(displayedTotals.inactive)}</strong></div>
          </Card>
          <Card className='report-kpi report-kpi--barangays'>
            <EnvironmentOutlined />
            <div><span>Barangays covered</span><strong>{whole(displayedTotals.barangays)}</strong></div>
          </Card>
        </section>

        {isReportLoading ? (
          <div className='report-loading-overlay'>
            <Card className='report-loading' role='status' aria-live='polite' aria-busy='true'>
              <div className='report-progress-heading'>
                <div className='report-progress-icon'><FileTextOutlined /></div>
                <div className='report-progress-copy'>
                  <p>{viewLoading ? 'Switching report view' : 'Generating report'}</p>
                  <h2>Loading {loadingViewLabel}</h2>
                  <span>
                    {viewLoading
                      ? `Preparing the ${loadingViewLabel} for display.`
                      : `Collecting and organizing voter records for ${scopeLabel.toLocaleLowerCase()}.`}
                  </span>
                </div>
                <strong className='report-progress-percentage'>{loadingProgress}%</strong>
              </div>
              <div
                className='report-progress-track'
                role='progressbar'
                aria-label={`Loading ${loadingViewLabel}`}
                aria-valuemin='0'
                aria-valuemax='100'
                aria-valuenow={loadingProgress}
              >
                <div className='report-progress-fill' style={{ width: `${loadingProgress}%` }} />
              </div>
              <div className='report-progress-meta'>
                <span>{loadingProgress === 100 ? 'Report is ready.' : 'Please keep this page open while the report is prepared.'}</span>
                <span>{loadingProgress === 100 ? 'Complete' : 'In progress'}</span>
              </div>
            </Card>
          </div>
        ) : report ? (
          view === 'summary' ? (
            <Card className='report-table-card'>
              <div className='report-section-heading'>
                <div>
                  <p>Barangay status breakdown</p>
                  <h2>Active and inactive voters per barangay</h2>
                  <span>Counts include every voter in the selected barangay scope.</span>
                </div>
                <Tag>{whole(summaries.length)} rows</Tag>
              </div>
              {summaries.length > 0 ? (
                <Table
                  className='report-summary-table report-datatable'
                  rowKey='barangay_id'
                  columns={summaryColumns}
                  dataSource={summaries}
                  pagination={printing ? false : {
                    current: summaryPage,
                    pageSize: summaryPageSize,
                    pageSizeOptions: ['10', '25', '50'],
                    showSizeChanger: true,
                    hideOnSinglePage: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} barangays`,
                    onChange: (page, pageSize) => {
                      setSummaryPage(pageSize === summaryPageSize ? page : 1);
                      setSummaryPageSize(pageSize);
                    },
                  }}
                  scroll={{ x: 720 }}
                  summary={() => (
                    <Table.Summary.Row className='report-summary-total'>
                      <Table.Summary.Cell index={0}><strong>Overall total</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align='right'><strong>{whole(totals.active)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align='right'><strong>{whole(totals.inactive)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align='right'><strong>{whole(totals.total)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align='right'>
                        <strong>{Number(totals.total || 0) > 0 ? `${((Number(totals.active) / Number(totals.total)) * 100).toFixed(1)}%` : '0.0%'}</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              ) : (
                <Empty description='No barangays are available for this scope.' />
              )}
            </Card>
          ) : (
            <section className='report-consolidated'>
              <div className='report-section-heading report-section-heading--standalone'>
                <div>
                  <p>Consolidated masterlist</p>
                  <h2>Barangay, purok and precinct listing</h2>
                  <span>{whole(displayedMatchingRecords)} matching of {whole(displayedGeneratedRecords)} generated records · {statusLabel}</span>
                </div>
                <Tag color='blue'>Sorted Purok → Precinct</Tag>
              </div>
              {groupedRecords.length > 0 ? displayedGroupedRecords.map((group) => {
                const groupSummary = summaries.find((row) => Number(row.barangay_id) === Number(group.barangay_id));
                const purokCount = new Set(group.records.map((row) => row.purok_name)).size;
                const precinctCount = new Set(group.records.map((row) => row.precinct_no)).size;
                return (
                  <Card className='report-barangay-group' key={reportGroupKey(group)}>
                    <div className='report-group-heading'>
                      <div>
                        <span>Barangay</span>
                        <h3>{group.barangay_name}</h3>
                      </div>
                      <div className='report-group-tools'>
                        <div className='report-group-actions report-no-print'>
                          <Button
                            size='small'
                            icon={<PrinterOutlined />}
                            onClick={() => printReport(reportGroupKey(group))}
                          >
                            Print Barangay
                          </Button>
                          <Button
                            className='report-group-excel'
                            size='small'
                            icon={<DownloadOutlined />}
                            loading={exportingBarangayKey === reportGroupKey(group)}
                            onClick={() => exportBarangayWorkbook(group)}
                          >
                            Excel
                          </Button>
                        </div>
                        <dl>
                          <div><dt>Listed</dt><dd>{whole(group.records.length)}</dd></div>
                          <div><dt>Puroks</dt><dd>{whole(purokCount)}</dd></div>
                          <div><dt>Precincts</dt><dd>{whole(precinctCount)}</dd></div>
                          <div><dt>All active / inactive</dt><dd>{whole(groupSummary?.active)} / {whole(groupSummary?.inactive)}</dd></div>
                        </dl>
                      </div>
                    </div>
                    <Table
                      className='report-detail-table report-datatable'
                      rowKey='recipient_id'
                      columns={detailColumns}
                      dataSource={group.records}
                      pagination={printing ? false : {
                        defaultPageSize: 10,
                        pageSizeOptions: ['10', '25', '50'],
                        showSizeChanger: true,
                        hideOnSinglePage: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} voters`,
                      }}
                      scroll={{ x: 920 }}
                      size='small'
                    />
                  </Card>
                );
              }) : (
                <Card className='report-empty'>
                  <Empty description='No voter records match the selected filters.' />
                </Card>
              )}
              {!printing && groupedRecords.length > consolidatedPageSize ? (
                <div className='report-group-pagination report-no-print'>
                  <Pagination
                    current={consolidatedPage}
                    pageSize={consolidatedPageSize}
                    total={groupedRecords.length}
                    pageSizeOptions={['2', '4', '6']}
                    showSizeChanger
                    showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} barangays`}
                    onChange={(page, pageSize) => {
                      setConsolidatedPage(pageSize === consolidatedPageSize ? page : 1);
                      setConsolidatedPageSize(pageSize);
                    }}
                  />
                </div>
              ) : null}
            </section>
          )
        ) : (
          <Card className='report-empty'><Empty description='No report data is available.' /></Card>
        )}
      </main>
    </Layout>
  );
}
