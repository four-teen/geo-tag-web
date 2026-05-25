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
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { deleteTribe, GetTribes, postTribe, updateTribe } from "../api/tribe";
import { canDeleteActions, GEO_PERMISSIONS, hasAnyPermission } from "../../utils/access";
import { extractApiErrorMessage } from "../../utils/api";

export default function TribeManagementPage() {
  const router = useRouter();
  const canManageGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO]);
  const canDeleteGeo = canManageGeo && canDeleteActions();

  const [loading, setLoading] = useState(false);
  const [tribes, setTribes] = useState([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const handleUnauthorized = (error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  };

  const loadTribes = async () => {
    try {
      setLoading(true);
      const res = await GetTribes();
      setTribes(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load tribes."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const auth = await Auth(router?.pathname);
      if (auth !== router?.pathname) {
        router.push({ pathname: auth });
        return;
      }
      await loadTribes();
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTribes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return tribes;

    return tribes.filter((record) =>
      String(record?.tribe_name || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [tribes, search]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      tribe_name: record.tribe_name,
      status: record.status || "ACTIVE",
    });
    setModalOpen(true);
  };

  const submit = async (values) => {
    try {
      setLoading(true);
      if (editing?.tribe_id) {
        await updateTribe(editing.tribe_id, values);
        toast.success("Tribe updated.");
      } else {
        await postTribe(values);
        toast.success("Tribe added.");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadTribes();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Saving tribe failed."));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    try {
      setLoading(true);
      await deleteTribe(id);
      toast.success("Tribe deleted.");
      await loadTribes();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Deleting tribe failed."));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Tribe", dataIndex: "tribe_name", key: "tribe_name" },
    {
      title: "Voters",
      dataIndex: "recipients_count",
      key: "recipients_count",
      width: 120,
      render: (count) => Number(count || 0),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status) => <Tag color={status === "ACTIVE" ? "green" : "red"}>{status}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 220,
      render: (_, record) => {
        const assignedCount = Number(record?.recipients_count || 0);
        return (
          <Space>
            <Button icon={<EditOutlined />} disabled={!canManageGeo} onClick={() => openEdit(record)}>
              Edit
            </Button>
            <Popconfirm
              title={assignedCount > 0 ? "This tribe has assigned voters." : "Delete this tribe?"}
              onConfirm={() => remove(record.tribe_id)}
              disabled={!canDeleteGeo || assignedCount > 0}
            >
              <Button icon={<DeleteOutlined />} danger disabled={!canDeleteGeo || assignedCount > 0}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Layout>
      <main className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Tribe Management</h1>
          <p className="text-slate-500">Manage voter tribe selections</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold">Tribes</h2>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canManageGeo} onClick={openCreate}>
              Add Tribe
            </Button>
          </div>

          <div className="mb-4">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search tribe"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="md:hidden space-y-3">
            {!loading && filteredTribes.length === 0 ? (
              <div className="py-4">
                <Empty description="No tribes found." />
              </div>
            ) : (
              filteredTribes.map((record) => {
                const assignedCount = Number(record?.recipients_count || 0);
                return (
                  <div key={record.tribe_id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-slate-800">{record.tribe_name || "-"}</p>
                        <p className="text-xs text-slate-500">Voters: {assignedCount}</p>
                      </div>
                      <Tag color={record.status === "ACTIVE" ? "green" : "red"}>{record.status || "INACTIVE"}</Tag>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button block icon={<EditOutlined />} disabled={!canManageGeo} onClick={() => openEdit(record)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title={assignedCount > 0 ? "This tribe has assigned voters." : "Delete this tribe?"}
                        onConfirm={() => remove(record.tribe_id)}
                        disabled={!canDeleteGeo || assignedCount > 0}
                      >
                        <Button block icon={<DeleteOutlined />} danger disabled={!canDeleteGeo || assignedCount > 0}>
                          Delete
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block">
            <Table
              rowKey="tribe_id"
              columns={columns}
              dataSource={filteredTribes}
              loading={loading}
              scroll={{ x: 720 }}
            />
          </div>
        </div>
      </main>

      <Modal
        title={editing ? "Edit Tribe" : "Add Tribe"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okButtonProps={{ disabled: !canManageGeo, loading }}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="Tribe Name"
            name="tribe_name"
            rules={[{ required: true, message: "Tribe name is required." }]}
          >
            <Input maxLength={150} />
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
