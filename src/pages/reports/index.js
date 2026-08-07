import Head from 'next/head';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { GetPurokVoterReport, GetVoterReport, GetVoterReportRecords } from '../api/reports';
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
const ALL_BARANGAYS_VALUE = '__ALL_BARANGAYS__';
const ALL_PUROKS_VALUE = '__ALL_PUROKS__';

export default function ReportsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewLoading, setViewLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(5);
  const [printing, setPrinting] = useState(false);
  const [printBarangayData, setPrintBarangayData] = useState(null);
  const [printingBarangayKey, setPrintingBarangayKey] = useState(null);
  const [exportingBarangayKey, setExportingBarangayKey] = useState(null);
  const [groupData, setGroupData] = useState({});
  const [report, setReport] = useState(null);
  const [view, setView] = useState('summary');
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(10);
  const [consolidatedPage, setConsolidatedPage] = useState(1);
  const [consolidatedPageSize, setConsolidatedPageSize] = useState(2);
  const [barangayId, setBarangayId] = useState();
  const [purokId, setPurokId] = useState();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [purokReport, setPurokReport] = useState(null);
  const [purokLoading, setPurokLoading] = useState(false);
  const [purokPrintScope, setPurokPrintScope] = useState(null);
  const [exportingPuroks, setExportingPuroks] = useState(false);
  const progressTimerRef = useRef(null);
  const viewProgressTimerRef = useRef(null);
  const viewCompletionTimerRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const groupRequestSequenceRef = useRef({});
  const viewSequenceRef = useRef(0);
  const printTitleRef = useRef(null);

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
        search: debouncedSearch || undefined,
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
      setGroupData({});
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
  }, [barangayId, clearProgressTimer, clearViewProgressTimers, debouncedSearch, status, unauthorized]);

  const loadPurokReport = useCallback(async () => {
    if (!Number(barangayId)) {
      setPurokReport(null);
      return;
    }

    setPurokLoading(true);
    try {
      const response = await GetPurokVoterReport({
        barangay_id: Number(barangayId),
        purok_id: purokId,
        status,
      });
      setPurokReport(response?.data || null);
    } catch (error) {
      setPurokReport(null);
      if (!unauthorized(error)) {
        toast.error(extractApiErrorMessage(error, 'Failed to generate the Purok voter report.'));
      }
    } finally {
      setPurokLoading(false);
    }
  }, [barangayId, purokId, status, unauthorized]);

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

  useEffect(() => {
    if (!ready || view !== 'purok') return;
    loadPurokReport();
  }, [ready, view, loadPurokReport]);

  useEffect(() => {
    setPurokId(undefined);
  }, [barangayId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const totals = report?.totals || {};
  const summaries = useMemo(
    () => (Array.isArray(report?.barangays) ? report.barangays : []),
    [report]
  );
  const options = useMemo(
    () => (Array.isArray(report?.barangay_options) ? report.barangay_options : []),
    [report]
  );
  const purokOptions = useMemo(
    () => (Array.isArray(purokReport?.purok_options) ? purokReport.purok_options : []),
    [purokReport]
  );
  const displayedPurokGroups = useMemo(
    () => (Array.isArray(purokReport?.puroks) ? purokReport.puroks : []),
    [purokReport]
  );
  const displayedPurokTotals = useMemo(() => displayedPurokGroups.reduce((current, group) => ({
    puroks: current.puroks + 1,
    total_voters: current.total_voters + Number(group.total_voters || 0),
    active_voters: current.active_voters + Number(group.active_voters || 0),
    inactive_voters: current.inactive_voters + Number(group.inactive_voters || 0),
  }), {
    puroks: 0,
    total_voters: 0,
    active_voters: 0,
    inactive_voters: 0,
  }), [displayedPurokGroups]);
  const consolidatedGroups = useMemo(
    () => summaries.filter((row) => Number(row.filtered_records || 0) > 0),
    [summaries]
  );
  const displayedConsolidatedGroups = useMemo(() => {
    if (printing) return printBarangayData ? [printBarangayData] : [];
    const start = (consolidatedPage - 1) * consolidatedPageSize;
    return consolidatedGroups.slice(start, start + consolidatedPageSize);
  }, [consolidatedGroups, consolidatedPage, consolidatedPageSize, printBarangayData, printing]);

  useEffect(() => {
    setSummaryPage(1);
    setConsolidatedPage(1);
  }, [report]);

  const loadGroupRecords = useCallback(async (group, page = 1, perPage = 10) => {
    const key = reportGroupKey(group);
    const requestId = Number(groupRequestSequenceRef.current[key] || 0) + 1;
    groupRequestSequenceRef.current[key] = requestId;
    setGroupData((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: null },
    }));

    try {
      const response = await GetVoterReportRecords({
        barangay_id: Number(group.barangay_id || 0),
        status,
        search: debouncedSearch || undefined,
        page,
        per_page: perPage,
      });
      if (groupRequestSequenceRef.current[key] !== requestId) return;
      setGroupData((current) => ({
        ...current,
        [key]: {
          records: Array.isArray(response?.data?.records) ? response.data.records : [],
          pagination: response?.data?.pagination || {},
          loading: false,
          error: null,
        },
      }));
    } catch (error) {
      if (groupRequestSequenceRef.current[key] !== requestId) return;
      setGroupData((current) => ({
        ...current,
        [key]: { ...current[key], loading: false, error: true },
      }));
      if (!unauthorized(error)) {
        toast.error(extractApiErrorMessage(error, `Failed to load ${group.barangay_name} voters.`));
      }
    }
  }, [debouncedSearch, status, unauthorized]);

  useEffect(() => {
    if (loading || viewLoading || printing || view !== 'consolidated') return;
    displayedConsolidatedGroups.forEach((group) => {
      const key = reportGroupKey(group);
      if (!groupData[key]) loadGroupRecords(group);
    });
  }, [displayedConsolidatedGroups, groupData, loadGroupRecords, loading, printing, view, viewLoading]);

  const fetchAllBarangayRecords = useCallback(async (group) => {
    const allRecords = [];
    let page = 1;
    let lastPage = 1;

    do {
      const response = await GetVoterReportRecords({
        barangay_id: Number(group.barangay_id || 0),
        status,
        search: debouncedSearch || undefined,
        page,
        per_page: 500,
      });
      const pageRecords = Array.isArray(response?.data?.records) ? response.data.records : [];
      allRecords.push(...pageRecords);
      lastPage = Math.max(1, Number(response?.data?.pagination?.last_page || 1));
      page += 1;
    } while (page <= lastPage);

    return allRecords;
  }, [debouncedSearch, status]);

  const finishPrinting = useCallback(() => {
    setPrinting(false);
    setPrintBarangayData(null);
    setPrintingBarangayKey(null);
    setPurokPrintScope(null);
    if (printTitleRef.current !== null) {
      document.title = printTitleRef.current;
      printTitleRef.current = null;
    }
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
      dataIndex: 'report_no',
      key: 'report_no',
      width: 56,
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
  const selectedPurok = purokOptions.find((item) => Number(item.purok_id) === Number(purokId));
  const scopeLabel = selectedBarangay?.barangay_name || 'All barangays';
  const purokScopeLabel = (purokReport?.barangay?.barangay_name || scopeLabel) + ' · ' + (selectedPurok?.purok_name || 'All Puroks');
  const statusLabel = status === 'ALL' ? 'All voter statuses' : `${status} voters only`;
  const loadingViewLabel = view === 'summary'
    ? 'per barangay report'
    : view === 'purok' ? 'Purok voter report' : 'consolidated report';
  const isGroupLoading = view === 'consolidated' && !printing
    && displayedConsolidatedGroups.some((group) => {
      const state = groupData[reportGroupKey(group)];
      return !state || state.loading;
    });
  const isPurokLoading = view === 'purok' && purokLoading;
  const isReportLoading = loading || viewLoading || isGroupLoading || isPurokLoading;
  const displayedProgress = isGroupLoading ? Math.min(96, loadingProgress) : loadingProgress;
  const printedBarangaySummary = printBarangayData
    ? summaries.find((row) => Number(row.barangay_id) === Number(printBarangayData.barangay_id))
    : null;
  const displayedTotals = view === 'purok' ? {
    total: displayedPurokTotals.total_voters,
    active: displayedPurokTotals.active_voters,
    inactive: displayedPurokTotals.inactive_voters,
    barangays: displayedPurokTotals.puroks,
  } : printing && printBarangayData ? {
    total: printedBarangaySummary?.total,
    active: printedBarangaySummary?.active,
    inactive: printedBarangaySummary?.inactive,
    barangays: 1,
  } : totals;
  const displayedScopeLabel = view === 'purok'
    ? purokScopeLabel
    : printing && printBarangayData
      ? printBarangayData.barangay_name
      : scopeLabel;
  const displayedMatchingRecords = printing && printBarangayData
    ? printBarangayData.records.length
    : totals.filtered_records;
  const displayedGeneratedRecords = printing && printBarangayData
    ? Number(printBarangayData.filtered_records || printBarangayData.records.length)
    : status === 'ACTIVE'
      ? totals.active
      : status === 'INACTIVE'
        ? totals.inactive
        : totals.total;

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
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet['!cols'] = [28, 12, 12, 12, 14].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Barangay Summary');
      XLSX.writeFile(workbook, `voter-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      toast.error('Unable to export the report workbook.');
    }
  };

  const exportBarangayWorkbook = async (group) => {
    const key = reportGroupKey(group);
    const groupSummary = summaries.find((row) => Number(row.barangay_id) === Number(group.barangay_id));
    setExportingBarangayKey(key);
    try {
      const records = await fetchAllBarangayRecords(group);
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet([{
        Barangay: group.barangay_name,
        Active: Number(groupSummary?.active || 0),
        Inactive: Number(groupSummary?.inactive || 0),
        Total: Number(groupSummary?.total || 0),
        'Exported Records': records.length,
        'Voter Status Filter': statusLabel,
        'Search Filter': search.trim() || 'None',
        'Generated At': generatedLabel(report?.generated_at),
      }]);
      const detailRows = records.map((row) => ({
        No: row.report_no,
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

  const exportPurokWorkbook = async () => {
    if (displayedPurokGroups.length === 0) {
      toast.error('No Purok voter records are available to export.');
      return;
    }

    setExportingPuroks(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const barangayName = purokReport?.barangay?.barangay_name || scopeLabel;
      const generatedAt = generatedLabel(purokReport?.generated_at);
      const summaryRows = displayedPurokGroups.map((group) => ({
        Barangay: barangayName,
        'Purok / Sitio': asText(group.purok_name, 'Unassigned'),
        'Status Filter': statusLabel,
        'Total Voters': Number(group.total_voters || 0),
        Active: Number(group.active_voters || 0),
        Inactive: Number(group.inactive_voters || 0),
        'Generated At': generatedAt,
      }));
      const voterRows = displayedPurokGroups.flatMap((group) => (
        (Array.isArray(group.voters) ? group.voters : []).map((voter, index) => ({
          No: index + 1,
          Barangay: barangayName,
          'Purok / Sitio': asText(group.purok_name, 'Unassigned'),
          'Voter Name': asText(voter.full_name, 'No name'),
          'Voter ID': asText(voter.voters_id_number, 'No voter ID'),
          Sex: asText(voter.sex),
          Precinct: asText(voter.precinct_no, 'Unassigned'),
          Status: asText(voter.status, 'INACTIVE'),
        }))
      ));
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const voterSheet = XLSX.utils.json_to_sheet(voterRows);
      summarySheet['!cols'] = [24, 28, 24, 14, 12, 12, 26].map((wch) => ({ wch }));
      voterSheet['!cols'] = [7, 24, 28, 36, 20, 10, 16, 12].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Purok Summary');
      XLSX.utils.book_append_sheet(workbook, voterSheet, 'Voter Records');
      XLSX.writeFile(
        workbook,
        `purok-voter-report-${fileSafeName(barangayName)}-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (error) {
      toast.error('Unable to export the Purok voter report.');
    } finally {
      setExportingPuroks(false);
    }
  };

  const printSummary = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(finishPrinting, 0);
    }, 0);
  };

  const printBarangayReport = async (group) => {
    const key = reportGroupKey(group);
    setPrintingBarangayKey(key);
    try {
      const records = await fetchAllBarangayRecords(group);
      setPrintBarangayData({ ...group, records });
      setPrinting(true);
      window.setTimeout(() => {
        window.print();
        window.setTimeout(finishPrinting, 0);
      }, 0);
    } catch (error) {
      setPrintingBarangayKey(null);
      if (!unauthorized(error)) {
        toast.error(extractApiErrorMessage(error, `Unable to prepare the ${group.barangay_name} print report.`));
      }
    }
  };

  const printPurokReport = (purok) => {
    const groups = purok ? [purok] : displayedPurokGroups;
    if (groups.length === 0) {
      toast.error('No Purok voter records are available to print.');
      return;
    }

    try {
      flushSync(() => {
        setPurokPrintScope(purok ? Number(purok.purok_id || 0) : ALL_PUROKS_VALUE);
      });
      printTitleRef.current = document.title;
      document.title = `Purok Voter Masterlist - ${purokReport?.barangay?.barangay_name || scopeLabel}`;
      window.print();
    } catch (error) {
      finishPrinting();
      toast.error('Unable to open the print dialog for the Purok voter report.');
    }
  };

  return (
    <Layout>
      <Head>
        <title>Administrator Reports</title>
        {purokPrintScope !== null ? (
          <style media='print'>{'@page { size: A4 portrait; margin: 13mm 12mm 16mm; }'}</style>
        ) : null}
      </Head>
      <main className={`report-page${purokPrintScope !== null ? ' report-page--purok-printing' : ''}`}>
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
            {view === 'purok' ? (
              <>
                <Button type='primary' icon={<PrinterOutlined />} onClick={() => printPurokReport(null)} disabled={purokLoading || displayedPurokGroups.length === 0}>Print All Puroks</Button>
                <Button icon={<DownloadOutlined />} loading={exportingPuroks} onClick={exportPurokWorkbook} disabled={purokLoading || displayedPurokGroups.length === 0}>Export Excel</Button>
              </>
            ) : (
              <>
                <Button icon={<PrinterOutlined />} onClick={printSummary} disabled={!report || view !== 'summary'}>Print summary</Button>
                <Button type='primary' icon={<DownloadOutlined />} onClick={exportWorkbook} disabled={!report}>Export summary</Button>
              </>
            )}
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
            <button
              type='button'
              className={view === 'purok' ? 'is-active' : ''}
              aria-pressed={view === 'purok'}
              onClick={() => changeReportView('purok')}
            >
              <EnvironmentOutlined />
              <span>Purok Voter Report</span>
            </button>
          </div>

          <div className='report-filter-grid'>
            <div className='report-filter report-filter--scope'>
              <span>Barangay scope</span>
              <Select
                allowClear
                showSearch
                aria-label='Select barangay report scope'
                optionFilterProp='label'
                placeholder='All barangays'
                value={barangayId ?? ALL_BARANGAYS_VALUE}
                options={[
                  { value: ALL_BARANGAYS_VALUE, label: 'All barangays' },
                  ...options.map((item) => ({
                    value: Number(item.barangay_id),
                    label: item.barangay_name,
                  })),
                ]}
                onChange={(value) => {
                  setBarangayId(value === ALL_BARANGAYS_VALUE ? undefined : value);
                  setPurokId(undefined);
                }}
              />
              {barangayId !== undefined ? (
                <Button className='report-scope-reset' onClick={() => setBarangayId(undefined)}>
                  Show all barangays
                </Button>
              ) : null}
            </div>
            {view === 'purok' ? (
              <label className='report-filter'>
                <span>Purok scope</span>
                <Select
                  disabled={!Number(barangayId)}
                  value={purokId ?? ALL_PUROKS_VALUE}
                  options={[
                    { value: ALL_PUROKS_VALUE, label: 'All Puroks' },
                    ...purokOptions.map((item) => ({
                      value: Number(item.purok_id),
                      label: item.purok_name,
                    })),
                  ]}
                  onChange={(value) => setPurokId(value === ALL_PUROKS_VALUE ? undefined : value)}
                />
              </label>
            ) : null}
            <label className='report-filter'>
              <span>{view === 'purok' ? 'Purok voter status' : 'Consolidated voter status'}</span>
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
            {view !== 'purok' ? (
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
            ) : null}
            <Button icon={<ReloadOutlined />} loading={loading || purokLoading} onClick={view === 'purok' ? loadPurokReport : loadReport}>Refresh</Button>
          </div>
        </section>

        <section className='report-print-meta'>
          <div>
            <strong>
              {view === 'summary'
                ? 'Active and Inactive Voters per Barangay'
                : view === 'purok'
                  ? 'Purok Voter Report'
                : printBarangayData
                  ? `Consolidated Voter Report - ${printBarangayData.barangay_name}`
                  : 'Consolidated Voter Report'}
            </strong>
            <span>{displayedScopeLabel} · {view === 'summary' ? 'All voter statuses' : statusLabel}</span>
          </div>
          <span>Generated {generatedLabel(view === 'purok' ? purokReport?.generated_at : report?.generated_at)}</span>
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
            <div><span>{view === 'purok' ? 'Puroks covered' : 'Barangays covered'}</span><strong>{whole(displayedTotals.barangays)}</strong></div>
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
                <strong className='report-progress-percentage'>{displayedProgress}%</strong>
              </div>
              <div
                className='report-progress-track'
                role='progressbar'
                aria-label={`Loading ${loadingViewLabel}`}
                aria-valuemin='0'
                aria-valuemax='100'
                aria-valuenow={displayedProgress}
              >
                <div className='report-progress-fill' style={{ width: `${displayedProgress}%` }} />
              </div>
              <div className='report-progress-meta'>
                <span>{displayedProgress === 100 ? 'Report is ready.' : 'Please keep this page open while the report is prepared.'}</span>
                <span>{displayedProgress === 100 ? 'Complete' : 'In progress'}</span>
              </div>
            </Card>
          </div>
        ) : view === 'purok' ? (
          !Number(barangayId) ? (
            <Card className='report-empty'>
              <Empty description='Select one barangay to prepare its Purok voter report.' />
            </Card>
          ) : !purokReport ? (
            <Card className='report-empty'>
              <Empty description='No Purok voter report is available for this barangay.' />
            </Card>
          ) : (
            <section className='purok-voter-report'>
              <div className='report-section-heading report-section-heading--standalone'>
                <div>
                  <p>Printable voter-record listing</p>
                  <h2>Voter records organized by registered Purok</h2>
                  <span>Each voter is counted under the Purok saved on that voter record. Household membership does not affect this report.</span>
                </div>
              </div>
              {displayedPurokGroups.length > 0 ? displayedPurokGroups.map((group) => (
                <Card
                  className={`report-barangay-group purok-report-group${
                    purokPrintScope !== null
                      && purokPrintScope !== ALL_PUROKS_VALUE
                      && Number(purokPrintScope) !== Number(group.purok_id || 0)
                      ? ' purok-report-group--print-hidden'
                      : ''
                  }`}
                  key={group.purok_id}
                >
                  <div className='report-group-heading'>
                    <div>
                      <span>Purok / Sitio</span>
                      <h3>{asText(group.purok_name, 'Unassigned')}</h3>
                    </div>
                    <div className='report-group-tools'>
                      <div className='report-group-actions report-no-print'>
                        <Button size='small' icon={<PrinterOutlined />} onClick={() => printPurokReport(group)}>Print Purok</Button>
                      </div>
                      <dl>
                        <div><dt>Voter records</dt><dd>{whole(group.total_voters)}</dd></div>
                        <div><dt>Active</dt><dd>{whole(group.active_voters)}</dd></div>
                        <div><dt>Inactive</dt><dd>{whole(group.inactive_voters)}</dd></div>
                      </dl>
                    </div>
                  </div>

                  <div className='purok-voter-records'>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Voter</th>
                          <th>Voter ID</th>
                          <th>Sex</th>
                          <th>Precinct</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.voters.map((voter, index) => (
                          <tr key={voter.recipient_id}>
                            <td>{index + 1}</td>
                            <td>{asText(voter.full_name, 'No name')}</td>
                            <td>{asText(voter.voters_id_number, 'No voter ID')}</td>
                            <td>{asText(voter.sex, '-')}</td>
                            <td>{asText(voter.precinct_no, 'Unassigned')}</td>
                            <td><Tag color={voter.status === 'ACTIVE' ? 'green' : 'red'}>{voter.status}</Tag></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className='purok-report-signatures'>
                    <div><span>Prepared by</span><strong /></div>
                    <div><span>Verified by</span><strong /></div>
                  </div>
                </Card>
              )) : (
                <Card className='report-empty'>
                  <Empty description='No voter records match the selected Purok and status.' />
                </Card>
              )}
            </section>
          )
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
              {consolidatedGroups.length > 0 ? displayedConsolidatedGroups.map((group) => {
                const key = reportGroupKey(group);
                const state = groupData[key] || {};
                const groupRecords = printing ? group.records : state.records || [];
                const pagination = state.pagination || {};
                return (
                  <Card className='report-barangay-group' key={key}>
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
                            loading={printingBarangayKey === key}
                            onClick={() => printBarangayReport(group)}
                          >
                            Print Barangay
                          </Button>
                          <Button
                            className='report-group-excel'
                            size='small'
                            icon={<DownloadOutlined />}
                            loading={exportingBarangayKey === key}
                            onClick={() => exportBarangayWorkbook(group)}
                          >
                            Excel
                          </Button>
                        </div>
                        <dl>
                          <div><dt>Matching</dt><dd>{whole(group.filtered_records)}</dd></div>
                          <div><dt>All voters</dt><dd>{whole(group.total)}</dd></div>
                          <div><dt>Active</dt><dd>{whole(group.active)}</dd></div>
                          <div><dt>Inactive</dt><dd>{whole(group.inactive)}</dd></div>
                        </dl>
                      </div>
                    </div>
                    <Table
                      className='report-detail-table report-datatable'
                      rowKey='recipient_id'
                      columns={detailColumns}
                      dataSource={groupRecords}
                      loading={state.loading}
                      pagination={printing ? false : {
                        current: Number(pagination.current_page || 1),
                        pageSize: Number(pagination.per_page || 10),
                        total: Number(pagination.total || group.filtered_records || 0),
                        pageSizeOptions: ['10', '25', '50'],
                        showSizeChanger: true,
                        hideOnSinglePage: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} voters`,
                        onChange: (page, pageSize) => loadGroupRecords(group, page, pageSize),
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
              {!printing && consolidatedGroups.length > consolidatedPageSize ? (
                <div className='report-group-pagination report-no-print'>
                  <Pagination
                    current={consolidatedPage}
                    pageSize={consolidatedPageSize}
                    total={consolidatedGroups.length}
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
