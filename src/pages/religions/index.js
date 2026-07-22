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
import { deleteReligion, GetReligions, postReligion, updateReligion } from "../api/religion";
import { canDeleteActions, GEO_PERMISSIONS, hasAnyPermission } from "../../utils/access";
import { extractApiErrorMessage } from "../../utils/api";

export default function ReligionManagementPage() {
  const router = useRouter();
  const canManageGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO]);
  const canEditGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO, GEO_PERMISSIONS.EDIT_GEO]);
  const canDeleteGeo = canManageGeo && canDeleteActions();

  const [loading, setLoading] = useState(false);
  const [religions, setReligions] = useState([]);
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

  const loadReligions = async () => {
    try {
      setLoading(true);
      const res = await GetReligions();
      setReligions(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load religions."));
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
      await loadReligions();
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredReligions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return religions;

    return religions.filter((record) =>
      String(record?.religion_name || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [religions, search]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      religion_name: record.religion_name,
      status: record.status || "ACTIVE",
    });
    setModalOpen(true);
  };

  const submit = async (values) => {
    try {
      setLoading(true);
      if (editing?.religion_id) {
        await updateReligion(editing.religion_id, values);
        toast.success("Religion updated.");
      } else {
        await postReligion(values);
        toast.success("Religion added.");
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadReligions();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Saving religion failed."));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    try {
      setLoading(true);
      await deleteReligion(id);
      toast.success("Religion deleted.");
      await loadReligions();
    } catch (error) {
      if (!handleUnauthorized(error)) toast.error(extractApiErrorMessage(error, "Deleting religion failed."));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Religion", dataIndex: "religion_name", key: "religion_name" },
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
            <Button icon={<EditOutlined />} disabled={!canEditGeo} onClick={() => openEdit(record)}>
              Edit
            </Button>
            {canDeleteGeo ? (
              <Popconfirm
                title={assignedCount > 0 ? "This religion has assigned voters." : "Delete this religion?"}
                onConfirm={() => remove(record.religion_id)}
                disabled={assignedCount > 0}
              >
                <Button icon={<DeleteOutlined />} danger disabled={assignedCount > 0}>Delete</Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <Layout>
      <main className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Religion Management</h1>
          <p className="text-slate-500">Manage voter religion selections</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold">Religions</h2>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canManageGeo} onClick={openCreate}>
              Add Religion
            </Button>
          </div>

          <div className="mb-4">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search religion"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="md:hidden space-y-3">
            {!loading && filteredReligions.length === 0 ? (
              <div className="py-4">
                <Empty description="No religions found." />
              </div>
            ) : (
              filteredReligions.map((record) => {
                const assignedCount = Number(record?.recipients_count || 0);
                return (
                  <div key={record.religion_id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-slate-800">{record.religion_name || "-"}</p>
                        <p className="text-xs text-slate-500">Voters: {assignedCount}</p>
                      </div>
                      <Tag color={record.status === "ACTIVE" ? "green" : "red"}>{record.status || "INACTIVE"}</Tag>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button block icon={<EditOutlined />} disabled={!canEditGeo} onClick={() => openEdit(record)}>
                        Edit
                      </Button>
                      {canDeleteGeo ? (
                        <Popconfirm
                          title={assignedCount > 0 ? "This religion has assigned voters." : "Delete this religion?"}
                          onConfirm={() => remove(record.religion_id)}
                          disabled={assignedCount > 0}
                        >
                          <Button block icon={<DeleteOutlined />} danger disabled={assignedCount > 0}>Delete</Button>
                        </Popconfirm>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block">
            <Table
              rowKey="religion_id"
              columns={columns}
              dataSource={filteredReligions}
              loading={loading}
              scroll={{ x: 720 }}
            />
          </div>
        </div>
      </main>

      <Modal
        title={editing ? "Edit Religion" : "Add Religion"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okButtonProps={{ disabled: editing ? !canEditGeo : !canManageGeo, loading }}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="Religion Name"
            name="religion_name"
            rules={[{ required: true, message: "Religion name is required." }]}
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
