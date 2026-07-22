import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileWordOutlined,
  ImportOutlined,
  ReloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetBarangays } from "../api/barangay";
import {
  CommitVoterImport,
  DeleteBarangayVoterImports,
  DeleteVoterImport,
  GetVoterImportCommitProgress,
  GetVoterImport,
  GetVoterImportRows,
  GetVoterImports,
  PreviewVoterImport,
} from "../api/voter-imports";
import { extractApiErrorMessage } from "../../utils/api";
import { canDeleteActions } from "../../utils/access";

const { Dragger } = Upload;
const { Text, Title } = Typography;

const statusColor = {
  DRAFT: "orange",
  READY: "green",
  COMMITTED: "blue",
  SUPERSEDED: "default",
  ERROR: "red",
  WARNING: "gold",
  REVIEW_REQUIRED: "orange",
};

const fmtDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const createProgressToken = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

export default function VoterImportsPage() {
  const router = useRouter();
  const [commitForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const canDelete = canDeleteActions();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [imports, setImports] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetBarangayId, setTargetBarangayId] = useState();
  const [detail, setDetail] = useState(null);
  const [rowData, setRowData] = useState([]);
  const [rowPage, setRowPage] = useState(1);
  const [rowTotal, setRowTotal] = useState(0);
  const [rowLoading, setRowLoading] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitComplete, setCommitComplete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingBarangay, setDeletingBarangay] = useState(false);
  const [commitProgress, setCommitProgress] = useState({
    status: "WAITING",
    processed_rows: 0,
    total_rows: 0,
    inserted_rows: 0,
    skipped_rows: 0,
    percentage: 0,
    message: "Waiting to start.",
  });

  const selectedImport = detail?.import || null;
  const isEditable = ["DRAFT", "READY"].includes(selectedImport?.status);

  const unauthorized = useCallback((error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  }, [router]);

  const loadImports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await GetVoterImports({ per_page: 100 });
      setImports(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load voter imports."));
    } finally {
      setLoading(false);
    }
  }, [unauthorized]);

  const loadBarangays = useCallback(async () => {
    try {
      const response = await GetBarangays();
      setBarangays(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load barangays."));
    }
  }, [unauthorized]);

  const loadRows = useCallback(async (importId, page = 1) => {
    if (!importId) return;
    try {
      setRowLoading(true);
      const response = await GetVoterImportRows(importId, { page, per_page: 50 });
      setRowData(Array.isArray(response?.data?.data) ? response.data.data : []);
      setRowPage(Number(response?.data?.pagination?.current_page || page));
      setRowTotal(Number(response?.data?.pagination?.total || 0));
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load parsed rows."));
    } finally {
      setRowLoading(false);
    }
  }, [unauthorized]);

  const openImport = useCallback(async (importId) => {
    try {
      setLoading(true);
      const response = await GetVoterImport(importId);
      const payload = response?.data?.data || null;
      setDetail(payload);
      await loadRows(importId, 1);
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to open import review."));
    } finally {
      setLoading(false);
    }
  }, [loadRows, unauthorized]);

  useEffect(() => {
    const bootstrap = async () => {
      const allowed = await Auth(router.pathname);
      if (allowed !== router.pathname) {
        router.push({ pathname: allowed });
        return;
      }
      setReady(true);
      await Promise.all([loadImports(), loadBarangays()]);
    };
    bootstrap();
  }, [loadBarangays, loadImports, router]);

  const uploadProps = {
    accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    maxCount: 1,
    fileList: selectedFile ? [selectedFile] : [],
    beforeUpload: (file) => {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        toast.error("Only .docx files are accepted.");
        return Upload.LIST_IGNORE;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("The maximum upload size is 10 MB.");
        return Upload.LIST_IGNORE;
      }
      setSelectedFile(file);
      return false;
    },
    onRemove: () => {
      setSelectedFile(null);
      return true;
    },
  };

  const uploadPreview = async () => {
    if (!selectedFile) {
      toast.warning("Select a Word document first.");
      return;
    }
    try {
      setUploading(true);
      const response = await PreviewVoterImport(selectedFile, targetBarangayId);
      const payload = response?.data?.data || null;
      setDetail(payload);
      setSelectedFile(null);
      setTargetBarangayId(undefined);
      toast.success("Document parsed and puroks resolved automatically.");
      await Promise.all([loadImports(), loadRows(payload?.import?.import_id, 1)]);
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Document preview failed."));
    } finally {
      setUploading(false);
    }
  };

  const commitImport = async (values) => {
    if (!selectedImport?.import_id) return;
    const progressToken = createProgressToken();
    let polling = true;
    let pollTimer;

    const pollProgress = async () => {
      try {
        const progressResponse = await GetVoterImportCommitProgress(progressToken);
        const progressPayload = progressResponse?.data?.data;
        if (progressPayload) setCommitProgress(progressPayload);
      } catch (error) {
        if (error?.response?.status === 401) unauthorized(error);
      } finally {
        if (polling) pollTimer = window.setTimeout(pollProgress, 300);
      }
    };

    try {
      setCommitting(true);
      setCommitComplete(false);
      setCommitProgress({
        status: "PREPARING",
        processed_rows: 0,
        total_rows: Number(selectedImport.parsed_rows || 0),
        inserted_rows: 0,
        skipped_rows: 0,
        percentage: 0,
        message: "Starting the import.",
      });

      const commitRequest = CommitVoterImport(
        selectedImport.import_id,
        values.mode,
        values.confirmation,
        progressToken,
      );
      pollProgress();
      const response = await commitRequest;
      const summary = response?.data?.data || {};
      polling = false;
      window.clearTimeout(pollTimer);
      setCommitProgress({
        status: "COMPLETED",
        processed_rows: Number(summary.verified_rows || summary.inserted_rows || 0),
        total_rows: Number(selectedImport.parsed_rows || 0),
        inserted_rows: Number(summary.inserted_rows || 0),
        skipped_rows: Number(summary.skipped_rows || 0),
        percentage: 100,
        message: "All voter records were verified and committed.",
      });
      setCommitComplete(true);
      toast.success(`${Number(summary.inserted_rows || 0).toLocaleString()} voters imported into ${summary.barangay_name}.`);
      commitForm.resetFields();
      await Promise.all([loadImports(), openImport(selectedImport.import_id)]);
    } catch (error) {
      polling = false;
      window.clearTimeout(pollTimer);
      setCommitProgress((current) => ({
        ...current,
        status: "FAILED",
        message: "Import failed. All database changes were rolled back.",
      }));
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Committing voter import failed."));
    } finally {
      setCommitting(false);
    }
  };

  const deleteImport = async (importId) => {
    try {
      setLoading(true);
      await DeleteVoterImport(importId);
      if (selectedImport?.import_id === importId) {
        setDetail(null);
        setRowData([]);
      }
      toast.success("Draft import removed.");
      await loadImports();
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Deleting draft import failed."));
    } finally {
      setLoading(false);
    }
  };

  const openBarangayDelete = (record) => {
    deleteForm.resetFields();
    setDeleteTarget(record);
  };

  const deleteBarangayImports = async (values) => {
    if (!deleteTarget?.import_id) return;

    try {
      setDeletingBarangay(true);
      const response = await DeleteBarangayVoterImports(
        deleteTarget.import_id,
        values.confirmation,
      );
      const summary = response?.data?.data || {};

      if (Number(selectedImport?.barangay_id) === Number(deleteTarget.barangay_id)) {
        setDetail(null);
        setRowData([]);
        setRowTotal(0);
      }

      setDeleteTarget(null);
      deleteForm.resetFields();
      toast.success(
        `${Number(summary.deleted_voters || 0).toLocaleString()} imported voters and ${Number(summary.deleted_imports || 0).toLocaleString()} document record(s) removed from ${summary.barangay_name || "the barangay"}.`,
      );
      await loadImports();
    } catch (error) {
      if (!unauthorized(error)) {
        toast.error(extractApiErrorMessage(error, "Deleting barangay import data failed."));
      }
    } finally {
      setDeletingBarangay(false);
    }
  };

  const importColumns = [
    {
      title: "Barangay / file",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.barangay_name}</Text>
          <Text type="secondary">{record.original_filename}</Text>
        </Space>
      ),
    },
    { title: "Rows", dataIndex: "parsed_rows", width: 90, render: (value) => Number(value || 0).toLocaleString() },
    { title: "Unresolved", dataIndex: "unresolved_rows", width: 110, render: (value) => Number(value || 0).toLocaleString() },
    { title: "Status", dataIndex: "status", width: 120, render: (value) => <Tag color={statusColor[value]}>{value}</Tag> },
    { title: "Created", dataIndex: "created_at", width: 180, render: fmtDateTime },
    {
      title: "Actions",
      width: 300,
      render: (_, record) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => openImport(record.import_id)}>Open</Button>
          {["DRAFT", "READY"].includes(record.status) && (
            <Popconfirm title="Remove this draft import?" onConfirm={() => deleteImport(record.import_id)}>
              <Button danger icon={<DeleteOutlined />} aria-label="Delete draft import" />
            </Popconfirm>
          )}
          {canDelete && ["COMMITTED", "SUPERSEDED"].includes(record.status) && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => openBarangayDelete(record)}
            >
              Delete barangay
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const mappingColumns = [
    {
      title: "Document address",
      dataIndex: "sample_address",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text>{value}</Text>
          <Text type="secondary">{record.row_count.toLocaleString()} voter(s)</Text>
        </Space>
      ),
    },
    {
      title: "Automatic purok decision",
      width: 420,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.location_resolution === "PROPOSED_NEW" ? record.proposed_purok_name : record.purok_name}</Text>
          <Text type="secondary">
            {record.location_resolution === "PROPOSED_NEW"
              ? "Create source address as a new purok"
              : record.match_strategy === "CLOSE_MATCH"
                ? `Use close existing match (${Number(record.match_score || 0).toFixed(1)}%)`
                : "Use existing purok"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Resolution",
      dataIndex: "location_resolution",
      width: 180,
      render: (value) => <Tag color={value === "MATCHED" ? "green" : "blue"}>{value === "PROPOSED_NEW" ? "CREATE NEW" : value.replaceAll("_", " ")}</Tag>,
    },
  ];

  const rowColumns = [
    { title: "No.", dataIndex: "source_record_no", width: 80 },
    { title: "Voter", dataIndex: "raw_name", width: 260 },
    { title: "Address", dataIndex: "raw_address" },
    { title: "Birthday", dataIndex: "raw_birthdate", width: 120 },
    { title: "Sex", dataIndex: "raw_sex", width: 70 },
    { title: "Precinct", dataIndex: "precinct_no", width: 100 },
    {
      title: "Review",
      dataIndex: "status",
      width: 150,
      render: (value, record) => (
        <Tooltip title={(record.issues || []).map((issue) => issue.message).join(" ") || "Ready"}>
          <Tag color={statusColor[value] || "default"}>{value.replaceAll("_", " ")}</Tag>
        </Tooltip>
      ),
    },
  ];

  const diagnostics = selectedImport?.diagnostics || {};
  const duplicateNumbers = Array.from(new Set(diagnostics.duplicate_source_numbers || []));

  if (!ready) return null;

  return (
    <Layout>
      <Head><title>Voter Imports</title></Head>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>Voter document imports</Title>
          <Text type="secondary">Upload one barangay masterlist. Close address names use existing puroks; all other source addresses become new puroks when committed.</Text>
        </div>

        <Card title={<Space><UploadOutlined /> Upload and preview</Space>}>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Text strong>Target barangay (optional)</Text>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: "100%", marginTop: 8 }}
                placeholder="Auto-detect from document header"
                value={targetBarangayId}
                onChange={setTargetBarangayId}
                options={barangays.map((item) => ({ value: Number(item.barangay_id), label: item.barangay_name }))}
              />
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 16 }}
                message="Preview does not change voter records"
                description="New barangays, puroks, and precincts are created only during commit. Every voter remains in the preview until you confirm the import."
              />
            </Col>
            <Col xs={24} lg={16}>
              <div className="voter-import-upload">
                <Dragger {...uploadProps} disabled={uploading}>
                  <p className="ant-upload-drag-icon"><FileWordOutlined /></p>
                  <p className="ant-upload-text">Drop a voter .docx here or click to browse</p>
                  <p className="ant-upload-hint">Maximum 10 MB. Expected: No., Voter&apos;s Name, Address, Birthday, Sex, and Precinct.</p>
                </Dragger>
                <Button
                  type="primary"
                  icon={<ImportOutlined />}
                  loading={uploading}
                  disabled={!selectedFile}
                  onClick={uploadPreview}
                  style={{ marginTop: 12 }}
                >
                  Parse document and create preview
                </Button>
              </div>
            </Col>
          </Row>
        </Card>

        <Card title="Import history" extra={<Button icon={<ReloadOutlined />} onClick={loadImports} loading={loading}>Refresh</Button>}>
          <Table
            rowKey="import_id"
            loading={loading}
            dataSource={imports}
            columns={importColumns}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 900 }}
            locale={{ emptyText: <Empty description="No voter imports yet" /> }}
          />
        </Card>

        {selectedImport && (
          <>
            <Card
              title={<Space><FileWordOutlined /> Import #{selectedImport.import_id}: {selectedImport.barangay_name}</Space>}
              extra={<Tag color={statusColor[selectedImport.status]}>{selectedImport.status}</Tag>}
            >
              <Row gutter={[16, 16]}>
                <Col xs={12} md={4}><Statistic title="Parsed" value={selectedImport.parsed_rows} /></Col>
                <Col xs={12} md={4}><Statistic title="Ready" value={selectedImport.ready_rows} valueStyle={{ color: "#389e0d" }} /></Col>
                <Col xs={12} md={4}><Statistic title="Warnings" value={selectedImport.warning_rows} valueStyle={{ color: "#d48806" }} /></Col>
                <Col xs={12} md={4}><Statistic title="Unresolved" value={selectedImport.unresolved_rows} valueStyle={{ color: selectedImport.unresolved_rows ? "#d46b08" : "#389e0d" }} /></Col>
                <Col xs={12} md={4}><Statistic title="Errors" value={selectedImport.error_rows} valueStyle={{ color: selectedImport.error_rows ? "#cf1322" : "#389e0d" }} /></Col>
                <Col xs={12} md={4}><Statistic title="Declared" value={selectedImport.declared_total || 0} /></Col>
              </Row>

              <Alert
                style={{ marginTop: 18 }}
                type={selectedImport.error_rows ? "error" : selectedImport.unresolved_rows ? "warning" : "success"}
                showIcon
                icon={selectedImport.unresolved_rows || selectedImport.error_rows ? <WarningOutlined /> : <CheckCircleOutlined />}
                message={selectedImport.can_commit ? "Automatic resolution complete — every voter can be committed" : "Source errors prevent this import"}
                description={
                  <Space direction="vertical" size={0}>
                    <Text>{selectedImport.original_filename} · uploaded {fmtDateTime(selectedImport.created_at)}</Text>
                    <Text>{Number(diagnostics.recovered_outside_table || 0)} malformed Word-table records recovered; {Number(diagnostics.continuation_rows || 0)} continuation lines joined.</Text>
                    {duplicateNumbers.length > 0 && <Text>Duplicate source number(s) deduplicated: {duplicateNumbers.join(", ")}</Text>}
                  </Space>
                }
              />
            </Card>

            <Card title="Automatic purok decisions">
              <Alert
                type="info"
                showIcon
                message="No manual mapping is required"
                description="Close, unambiguous names use an existing purok. Every other unique source address will be created automatically as a normal purok and linked to its voters."
                style={{ marginBottom: 16 }}
              />
              <Table
                rowKey="address_key"
                dataSource={detail.address_groups || []}
                columns={mappingColumns}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                scroll={{ x: 980 }}
              />
              {isEditable && (
                <Space style={{ marginTop: 16 }} wrap>
                  <Button
                    danger
                    type="primary"
                    icon={<ImportOutlined />}
                    disabled={!selectedImport.can_commit}
                    onClick={() => {
                      commitForm.setFieldsValue({ mode: "REPLACE_BARANGAY", confirmation: "" });
                      setCommitComplete(false);
                      setCommitProgress({
                        status: "WAITING",
                        processed_rows: 0,
                        total_rows: Number(selectedImport.parsed_rows || 0),
                        inserted_rows: 0,
                        skipped_rows: 0,
                        percentage: 0,
                        message: "Waiting to start.",
                      });
                      setCommitOpen(true);
                    }}
                  >
                    Commit import
                  </Button>
                  {!selectedImport.can_commit && <Text type="secondary">Commit requires zero source-field errors.</Text>}
                </Space>
              )}
            </Card>

            <Card title="Parsed voter rows">
              <Table
                rowKey="import_row_id"
                loading={rowLoading}
                dataSource={rowData}
                columns={rowColumns}
                pagination={{
                  current: rowPage,
                  total: rowTotal,
                  pageSize: 50,
                  showSizeChanger: false,
                  onChange: (page) => loadRows(selectedImport.import_id, page),
                }}
                scroll={{ x: 1100 }}
              />
            </Card>
          </>
        )}
      </Space>

      <Modal
        title={`Commit ${selectedImport?.barangay_name || "voter"} import`}
        open={commitOpen}
        onCancel={() => { if (!committing) setCommitOpen(false); }}
        footer={null}
        closable={!committing}
        maskClosable={!committing}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          message="This is the only step that writes voter records"
          description="Replace deletes only the current barangay's voters, creates required puroks and precincts, inserts every parsed voter, and verifies the final count before committing."
          style={{ marginBottom: 16 }}
        />
        {(committing || commitComplete || commitProgress.status === "FAILED") && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Progress
              percent={Number(commitProgress.percentage || 0)}
              status={commitProgress.status === "FAILED" ? "exception" : commitProgress.status === "COMPLETED" ? "success" : "active"}
            />
            <Space direction="vertical" size={0}>
              <Text strong>{commitProgress.message}</Text>
              <Text type="secondary">
                Processed {Number(commitProgress.processed_rows || 0).toLocaleString()} of {Number(commitProgress.total_rows || 0).toLocaleString()} records
              </Text>
              <Text type="secondary">
                Inserted: {Number(commitProgress.inserted_rows || 0).toLocaleString()}
                {Number(commitProgress.skipped_rows || 0) > 0 ? ` · Skipped: ${Number(commitProgress.skipped_rows).toLocaleString()}` : ""}
              </Text>
            </Space>
          </Card>
        )}
        <Form form={commitForm} layout="vertical" onFinish={commitImport} initialValues={{ mode: "REPLACE_BARANGAY" }}>
          <Form.Item name="mode" label="Import mode" rules={[{ required: true }]}>
            <Radio.Group disabled={committing || commitComplete}>
              <Space direction="vertical">
                <Radio value="REPLACE_BARANGAY"><Text strong>Replace this barangay</Text> — recommended for a complete masterlist</Radio>
                <Radio value="MERGE"><Text strong>Merge only new rows</Text> — skips matching fingerprints</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="confirmation"
            label={<>Type <Text code>{selectedImport?.barangay_name}</Text> to confirm</>}
            rules={[{ required: true, message: "Barangay confirmation is required." }]}
          >
            <Input autoComplete="off" disabled={committing || commitComplete} />
          </Form.Item>
          <Space>
            <Button disabled={committing} onClick={() => setCommitOpen(false)}>{commitComplete ? "Close" : "Cancel"}</Button>
            {!commitComplete && <Button danger type="primary" htmlType="submit" loading={committing}>Commit voter records</Button>}
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`Delete ${deleteTarget?.barangay_name || "barangay"} import data`}
        open={Boolean(deleteTarget)}
        onCancel={() => {
          if (!deletingBarangay) {
            setDeleteTarget(null);
            deleteForm.resetFields();
          }
        }}
        footer={null}
        width={600}
        closable={!deletingBarangay}
        maskClosable={!deletingBarangay}
        destroyOnClose
      >
        <Alert
          type="error"
          showIcon
          message="This permanently removes imported voter data for the barangay"
          description={
            <Space direction="vertical" size={4}>
              <Text>
                All imported voters and every voter-import history record for <Text strong>{deleteTarget?.barangay_name}</Text> will be deleted.
              </Text>
              <Text>
                The barangay, puroks, precincts, and manually added voters will remain available.
              </Text>
            </Space>
          }
          style={{ marginBottom: 18 }}
        />

        <Form form={deleteForm} layout="vertical" onFinish={deleteBarangayImports}>
          <Form.Item
            name="confirmation"
            label={<>Type <Text code>{deleteTarget?.barangay_name}</Text> to confirm</>}
            rules={[
              { required: true, message: "Barangay confirmation is required." },
              {
                validator: (_, value) => (
                  String(value || "").trim() === String(deleteTarget?.barangay_name || "").trim()
                    ? Promise.resolve()
                    : Promise.reject(new Error(`Type ${deleteTarget?.barangay_name || "the barangay name"} exactly.`))
                ),
              },
            ]}
          >
            <Input autoComplete="off" disabled={deletingBarangay} />
          </Form.Item>

          <Space>
            <Button
              disabled={deletingBarangay}
              onClick={() => {
                setDeleteTarget(null);
                deleteForm.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button danger type="primary" htmlType="submit" loading={deletingBarangay}>
              Delete imported voters and documents
            </Button>
          </Space>
        </Form>
      </Modal>
    </Layout>
  );
}
