import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetBarangays, deleteBarangay, postBarangay, updateBarangay } from "../api/barangay";
import { GetPuroksByBarangay, deletePurok, postPurok, updatePurok } from "../api/purok";
import {
  GetPrecinctsByPurok,
  deletePrecinct,
  postPrecinct,
  updatePrecinct,
} from "../api/precinct";
import { GEO_PERMISSIONS, hasAnyPermission } from "../../utils/access";
import { extractApiErrorMessage } from "../../utils/api";

export default function BarangayGeoPage() {
  const router = useRouter();
  const canManageGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO]);

  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState([]);
  const [barangaySearch, setBarangaySearch] = useState("");
  const [puroks, setPuroks] = useState([]);
  const [precincts, setPrecincts] = useState([]);

  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [selectedPurok, setSelectedPurok] = useState(null);

  const [barangayModalOpen, setBarangayModalOpen] = useState(false);
  const [purokModalOpen, setPurokModalOpen] = useState(false);
  const [purokFormOpen, setPurokFormOpen] = useState(false);
  const [precinctModalOpen, setPrecinctModalOpen] = useState(false);
  const [precinctFormOpen, setPrecinctFormOpen] = useState(false);

  const [editingBarangay, setEditingBarangay] = useState(null);
  const [editingPurok, setEditingPurok] = useState(null);
  const [editingPrecinct, setEditingPrecinct] = useState(null);

  const [barangayForm] = Form.useForm();
  const [purokForm] = Form.useForm();
  const [precinctForm] = Form.useForm();

  const guardRoute = async () => {
    const auth = await Auth(router?.pathname);
    if (auth !== router?.pathname) {
      router.push({ pathname: auth });
      return false;
    }
    return true;
  };

  const handleUnauthorized = (error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  };

  const loadBarangays = async () => {
    try {
      setLoading(true);
      const res = await GetBarangays();
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setBarangays(rows);
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load barangays."));
    } finally {
      setLoading(false);
    }
  };

  const loadPuroks = async (barangayId) => {
    try {
      const res = await GetPuroksByBarangay(barangayId);
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setPuroks(rows);
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load puroks."));
    }
  };

  const loadPrecincts = async (purokId) => {
    try {
      const res = await GetPrecinctsByPurok(purokId);
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setPrecincts(rows);
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load precincts."));
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const allowed = await guardRoute();
      if (!allowed) return;
      await loadBarangays();
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitBarangay = async (values) => {
    try {
      setLoading(true);
      if (editingBarangay?.barangay_id) {
        await updateBarangay(editingBarangay.barangay_id, values);
        toast.success("Barangay updated.");
      } else {
        await postBarangay(values);
        toast.success("Barangay added.");
      }
      setBarangayModalOpen(false);
      setEditingBarangay(null);
      barangayForm.resetFields();
      await loadBarangays();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Saving barangay failed."));
    } finally {
      setLoading(false);
    }
  };

  const removeBarangay = async (id) => {
    try {
      setLoading(true);
      await deleteBarangay(id);
      toast.success("Barangay deleted.");
      await loadBarangays();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Deleting barangay failed."));
    } finally {
      setLoading(false);
    }
  };

  const openPurokViewer = async (record) => {
    setSelectedBarangay(record);
    setPurokModalOpen(true);
    await loadPuroks(record.barangay_id);
  };

  const openBarangayEditor = (record) => {
    setEditingBarangay(record);
    barangayForm.setFieldsValue({
      barangay_name: record.barangay_name,
      status: record.status || "ACTIVE",
    });
    setBarangayModalOpen(true);
  };

  const getPurokCount = (record) => {
    const parsed = Number(record?.puroks_count ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const filteredBarangays = useMemo(() => {
    const keyword = barangaySearch.trim().toLowerCase();
    if (!keyword) return barangays;

    return barangays.filter((record) =>
      String(record?.barangay_name || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [barangays, barangaySearch]);

  const submitPurok = async (values) => {
    if (!selectedBarangay?.barangay_id) return;

    const payload = { ...values, barangay_id: selectedBarangay.barangay_id };
    try {
      setLoading(true);
      if (editingPurok?.purok_id) {
        await updatePurok(editingPurok.purok_id, payload);
        toast.success("Purok updated.");
      } else {
        await postPurok(payload);
        toast.success("Purok added.");
      }
      setPurokFormOpen(false);
      setEditingPurok(null);
      purokForm.resetFields();
      await loadPuroks(selectedBarangay.barangay_id);
      await loadBarangays();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Saving purok failed."));
    } finally {
      setLoading(false);
    }
  };

  const removePurok = async (id) => {
    try {
      setLoading(true);
      await deletePurok(id);
      toast.success("Purok deleted.");
      if (selectedBarangay?.barangay_id) {
        await loadPuroks(selectedBarangay.barangay_id);
        await loadBarangays();
      }
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Deleting purok failed."));
    } finally {
      setLoading(false);
    }
  };

  const submitPrecinct = async (values) => {
    if (!selectedPurok?.purok_id) return;

    const payload = { ...values, purok_id: selectedPurok.purok_id };
    try {
      setLoading(true);
      if (editingPrecinct?.precinct_id) {
        await updatePrecinct(editingPrecinct.precinct_id, payload);
        toast.success("Precinct updated.");
      } else {
        await postPrecinct(payload);
        toast.success("Precinct added.");
      }
      setPrecinctFormOpen(false);
      setEditingPrecinct(null);
      precinctForm.resetFields();
      await loadPrecincts(selectedPurok.purok_id);
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Saving precinct failed."));
    } finally {
      setLoading(false);
    }
  };

  const removePrecinct = async (id) => {
    try {
      setLoading(true);
      await deletePrecinct(id);
      toast.success("Precinct deleted.");
      if (selectedPurok?.purok_id) {
        await loadPrecincts(selectedPurok.purok_id);
      }
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Deleting precinct failed."));
    } finally {
      setLoading(false);
    }
  };

  const barangayColumns = [
      { title: "Barangay", dataIndex: "barangay_name", key: "barangay_name" },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => <Tag color={status === "ACTIVE" ? "green" : "red"}>{status}</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        align: "right",
        render: (_, record) => (
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={() => openPurokViewer(record)}
            >
              Add/View Purok ({getPurokCount(record)})
            </Button>
            <Button
              icon={<EditOutlined />}
              disabled={!canManageGeo}
              onClick={() => openBarangayEditor(record)}
            >
              Edit
            </Button>
            <Popconfirm
              title="Delete this barangay?"
              onConfirm={() => removeBarangay(record.barangay_id)}
              disabled={!canManageGeo}
            >
              <Button icon={<DeleteOutlined />} danger disabled={!canManageGeo}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

  const purokColumns = [
      { title: "Purok", dataIndex: "purok_name", key: "purok_name" },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => <Tag color={status === "ACTIVE" ? "green" : "red"}>{status}</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        align: "right",
        render: (_, record) => (
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={async () => {
                setSelectedPurok(record);
                setPrecinctModalOpen(true);
                await loadPrecincts(record.purok_id);
              }}
            >
              View Precincts
            </Button>
            <Button
              icon={<EditOutlined />}
              disabled={!canManageGeo}
              onClick={() => {
                setEditingPurok(record);
                purokForm.setFieldsValue({
                  purok_name: record.purok_name,
                  status: record.status || "ACTIVE",
                });
                setPurokFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Popconfirm
              title="Delete this purok?"
              onConfirm={() => removePurok(record.purok_id)}
              disabled={!canManageGeo}
            >
              <Button icon={<DeleteOutlined />} danger disabled={!canManageGeo}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

  const precinctColumns = [
      { title: "Precinct", dataIndex: "precinct_name", key: "precinct_name" },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => <Tag color={status === "ACTIVE" ? "green" : "red"}>{status}</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        align: "right",
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              disabled={!canManageGeo}
              onClick={() => {
                setEditingPrecinct(record);
                precinctForm.setFieldsValue({
                  precinct_name: record.precinct_name,
                  status: record.status || "ACTIVE",
                });
                setPrecinctFormOpen(true);
              }}
            >
              Edit
            </Button>
            <Popconfirm
              title="Delete this precinct?"
              onConfirm={() => removePrecinct(record.precinct_id)}
              disabled={!canManageGeo}
            >
              <Button icon={<DeleteOutlined />} danger disabled={!canManageGeo}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

  return (
    <Layout>
      <main className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Geo Tagging Master Data</h1>
          <p className="text-slate-500">Manage barangays, puroks, and precincts</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold">Barangays</h2>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!canManageGeo}
              onClick={() => {
                setEditingBarangay(null);
                barangayForm.resetFields();
                barangayForm.setFieldsValue({ status: "ACTIVE" });
                setBarangayModalOpen(true);
              }}
            >
              Add Barangay
            </Button>
          </div>

          <div className="mb-4">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search barangay"
              value={barangaySearch}
              onChange={(event) => setBarangaySearch(event.target.value)}
            />
          </div>

          <div className="md:hidden space-y-3">
            {!loading && filteredBarangays.length === 0 ? (
              <div className="py-4">
                <Empty description="No barangays found." />
              </div>
            ) : (
              filteredBarangays.map((record) => (
                <div key={record.barangay_id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-slate-800">{record.barangay_name || "-"}</p>
                    <Tag color={record.status === "ACTIVE" ? "green" : "red"}>{record.status || "INACTIVE"}</Tag>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button block icon={<EyeOutlined />} onClick={() => openPurokViewer(record)}>
                      Add/View Purok ({getPurokCount(record)})
                    </Button>
                    <Button
                      block
                      icon={<EditOutlined />}
                      disabled={!canManageGeo}
                      onClick={() => openBarangayEditor(record)}
                    >
                      Edit
                    </Button>
                    <Popconfirm
                      title="Delete this barangay?"
                      onConfirm={() => removeBarangay(record.barangay_id)}
                      disabled={!canManageGeo}
                    >
                      <Button block icon={<DeleteOutlined />} danger disabled={!canManageGeo}>
                        Delete
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <Table
              rowKey="barangay_id"
              columns={barangayColumns}
              dataSource={filteredBarangays}
              loading={loading}
              scroll={{ x: 720 }}
            />
          </div>
        </div>
      </main>

      <Modal
        title={editingBarangay ? "Edit Barangay" : "Add Barangay"}
        open={barangayModalOpen}
        onCancel={() => {
          setBarangayModalOpen(false);
          setEditingBarangay(null);
          barangayForm.resetFields();
        }}
        onOk={() => barangayForm.submit()}
        okButtonProps={{ disabled: !canManageGeo }}
      >
        <Form form={barangayForm} layout="vertical" onFinish={submitBarangay}>
          <Form.Item
            label="Barangay Name"
            name="barangay_name"
            rules={[{ required: true, message: "Barangay name is required." }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="ACTIVE">
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        width={900}
        title={`Puroks - ${selectedBarangay?.barangay_name || ""}`}
        open={purokModalOpen}
        onCancel={() => {
          setPurokModalOpen(false);
          setSelectedBarangay(null);
          setPuroks([]);
        }}
        footer={[
          <Button
            key="addPurok"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManageGeo || !selectedBarangay?.barangay_id}
            onClick={() => {
              setEditingPurok(null);
              purokForm.resetFields();
              purokForm.setFieldsValue({ status: "ACTIVE" });
              setPurokFormOpen(true);
            }}
          >
            Add Purok
          </Button>,
          <Button key="close" onClick={() => setPurokModalOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <Table rowKey="purok_id" columns={purokColumns} dataSource={puroks} loading={loading} />
      </Modal>

      <Modal
        title={editingPurok ? "Edit Purok" : "Add Purok"}
        open={purokFormOpen}
        onCancel={() => {
          setPurokFormOpen(false);
          setEditingPurok(null);
          purokForm.resetFields();
        }}
        onOk={() => purokForm.submit()}
        okButtonProps={{ disabled: !canManageGeo }}
      >
        <Form form={purokForm} layout="vertical" onFinish={submitPurok}>
          <Form.Item label="Barangay">
            <Input disabled value={selectedBarangay?.barangay_name || ""} />
          </Form.Item>
          <Form.Item
            label="Purok Name"
            name="purok_name"
            rules={[{ required: true, message: "Purok name is required." }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="ACTIVE">
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        width={850}
        title={`Precincts - ${selectedPurok?.purok_name || ""}`}
        open={precinctModalOpen}
        onCancel={() => {
          setPrecinctModalOpen(false);
          setSelectedPurok(null);
          setPrecincts([]);
        }}
        footer={[
          <Button
            key="addPrecinct"
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManageGeo || !selectedPurok?.purok_id}
            onClick={() => {
              setEditingPrecinct(null);
              precinctForm.resetFields();
              precinctForm.setFieldsValue({ status: "ACTIVE" });
              setPrecinctFormOpen(true);
            }}
          >
            Add Precinct
          </Button>,
          <Button key="close" onClick={() => setPrecinctModalOpen(false)}>
            Close
          </Button>,
        ]}
      >
        <Table rowKey="precinct_id" columns={precinctColumns} dataSource={precincts} loading={loading} />
      </Modal>

      <Modal
        title={editingPrecinct ? "Edit Precinct" : "Add Precinct"}
        open={precinctFormOpen}
        onCancel={() => {
          setPrecinctFormOpen(false);
          setEditingPrecinct(null);
          precinctForm.resetFields();
        }}
        onOk={() => precinctForm.submit()}
        okButtonProps={{ disabled: !canManageGeo }}
      >
        <Form form={precinctForm} layout="vertical" onFinish={submitPrecinct}>
          <Form.Item label="Purok">
            <Input disabled value={selectedPurok?.purok_name || ""} />
          </Form.Item>
          <Form.Item
            label="Precinct Name"
            name="precinct_name"
            rules={[{ required: true, message: "Precinct name is required." }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="ACTIVE">
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <ToastContainer />
    </Layout>
  );
}
