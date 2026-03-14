import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Tag,
  Upload,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, StopOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { createAccount, deleteAccount, disableAccount, getAccountOptions, getAccounts, updateAccount } from "../api/account";
import { extractApiErrorMessage } from "../../utils/api";
import { getDefaultLandingPath, isAdministrator, isStaff } from "../../utils/access";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const AVATAR_UPDATED_EVENT = "geo-avatar-updated";
const ACCOUNT_PAGE_CHUNK = 12;

const defaultRoleOptions = [
  { value: "administrator", label: "Administrator" },
  { value: "staff", label: "Staff" },
  { value: "municipal_staff", label: "Municipal Staff" },
  { value: "viewer", label: "Viewer" },
];

const scopeOptions = [
  { value: "ALL", label: "All Barangays" },
  { value: "SPECIFIC", label: "Specific Barangays" },
];

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialFormValues() {
  return {
    name: "",
    username: "",
    designation: "",
    password: "",
    role: "staff",
    is_active: true,
    can_delete: false,
    barangay_scope: "ALL",
    barangay_ids: [],
  };
}

function roleLabel(role = "") {
  if (role === "administrator") return "Admin";
  if (role === "staff") return "Staff";
  if (role === "municipal_staff") return "Municipal Staff";
  if (role === "viewer") return "Viewer";
  return role || "Unknown";
}

function getAvatarStorageKey(userId) {
  return `geoAvatar:${userId || "guest"}`;
}

function getPermissionCodesForRole(role = "staff") {
  if (role === "staff") return ["bow.manage_geo", "bow.view_geo"];
  if (role === "municipal_staff" || role === "viewer") return ["bow.view_geo"];
  return [];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AccountManagementPage({ mode = "administrator" }) {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const isAdminMode = mode === "administrator";
  const apiScope = isAdminMode ? "admin" : "staff";
  const pageTitle = isAdminMode ? "Accounts" : "Staff Accounts";
  const pageDescription = isAdminMode
    ? "Add, edit, delete, and manage user access details."
    : "Add, edit, and disable account access. Delete remains available only in the administrator module.";

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [roleOptions, setRoleOptions] = useState(defaultRoleOptions);
  const [barangays, setBarangays] = useState([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(ACCOUNT_PAGE_CHUNK);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [formRole, setFormRole] = useState("staff");
  const [formScope, setFormScope] = useState("ALL");
  const [currentUserId, setCurrentUserId] = useState(0);
  const sentinelRef = useRef(null);

  const isCreateMode = !editingAccount;

  const filteredAccounts = useMemo(() => {
    const keyword = String(accountSearch || "").trim().toLowerCase();
    if (!keyword) return accounts;

    return accounts.filter((account) => {
      const haystack = [
        account?.name,
        account?.username,
        account?.designation,
        account?.role,
        account?.barangay_scope,
        account?.is_active ? "active" : "inactive",
        account?.can_delete ? "delete enabled" : "delete disabled",
      ]
        .map((item) => String(item || "").toLowerCase())
        .join(" ");

      return haystack.includes(keyword);
    });
  }, [accounts, accountSearch]);

  const visibleAccounts = useMemo(
    () => filteredAccounts.slice(0, visibleCount),
    [filteredAccounts, visibleCount]
  );

  const guardRoute = async () => {
    const auth = await Auth(router?.pathname);
    if (auth !== router?.pathname) {
      router.push({ pathname: auth });
      return false;
    }
    if (isAdminMode && !isAdministrator()) {
      router.push({ pathname: getDefaultLandingPath() });
      return false;
    }
    if (!isAdminMode && !isStaff()) {
      router.push({ pathname: getDefaultLandingPath() });
      return false;
    }
    return true;
  };

  const resetPhotoState = () => {
    setSelectedPhoto(null);
    setPhotoPreview("");
    setRemovePhoto(false);
  };

  const loadOptions = async () => {
    const res = await getAccountOptions(apiScope);
    const fallbackRoles = isAdminMode
      ? defaultRoleOptions
      : defaultRoleOptions.filter((item) => item.value !== "administrator");
    setRoleOptions(Array.isArray(res?.data?.data?.roles) ? res.data.data.roles : fallbackRoles);
    setBarangays(Array.isArray(res?.data?.data?.barangays) ? res.data.data.barangays : []);
  };

  const loadAccounts = async () => {
    const res = await getAccounts(apiScope);
    setAccounts(Array.isArray(res?.data?.data) ? res.data.data : []);
  };

  useEffect(() => {
    setCurrentUserId(Number(Cookies.get("id") || 0));
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const allowed = await guardRoute();
      if (!allowed) return;

      try {
        setLoading(true);
        await Promise.all([loadOptions(), loadAccounts()]);
      } catch (error) {
        messageApi.error(extractApiErrorMessage(error, "Failed to load accounts."));
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiScope]);

  useEffect(() => {
    setVisibleCount(ACCOUNT_PAGE_CHUNK);
  }, [accountSearch, accounts.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || visibleCount >= filteredAccounts.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + ACCOUNT_PAGE_CHUNK, filteredAccounts.length));
      },
      { rootMargin: "240px 0px", threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, visibleCount, filteredAccounts.length]);

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormRole("staff");
    setFormScope("ALL");
    form.setFieldsValue(initialFormValues());
    resetPhotoState();
    setModalOpen(true);
  };

  const openEditModal = (account) => {
    setEditingAccount(account);
    const role = account?.role || "staff";
    const scope = account?.barangay_scope || "ALL";
    setFormRole(role);
    setFormScope(scope);

    form.setFieldsValue({
      name: account?.name || "",
      username: account?.username || "",
      designation: account?.designation || "",
      password: "",
      role,
      is_active: !!account?.is_active,
      can_delete: isAdminMode && role === "administrator" ? true : isAdminMode ? !!account?.can_delete : false,
      barangay_scope: scope,
      barangay_ids: Array.isArray(account?.barangays)
        ? account.barangays.map((item) => item.barangay_id)
        : [],
    });

    setSelectedPhoto(null);
    setPhotoPreview(account?.avatar_url || "");
    setRemovePhoto(false);
    setModalOpen(true);
  };

  const onPhotoPick = async (file) => {
    if (!file.type?.startsWith("image/")) {
      messageApi.error("Please select an image file.");
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      messageApi.error("Image is too large. Maximum size is 2MB.");
      return Upload.LIST_IGNORE;
    }

    setSelectedPhoto(file);
    setRemovePhoto(false);
    try {
      const previewUrl = await readFileAsDataUrl(file);
      setPhotoPreview(previewUrl);
    } catch (error) {
      messageApi.error("Failed to preview image.");
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const removePickedPhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview("");
    setRemovePhoto(true);
  };

  const formDataFromValues = (values) => {
    const data = new FormData();
    data.append("name", String(values.name || ""));
    data.append("username", String(values.username || ""));
    data.append("designation", String(values.designation || ""));
    if (isCreateMode || String(values.password || "").trim() !== "") {
      data.append("password", String(values.password || ""));
    }
    data.append("role", String(values.role || "staff"));
    data.append("is_active", values.is_active ? "1" : "0");
    data.append(
      "can_delete",
      isAdminMode && values.role !== "administrator" && values.can_delete ? "1" : values.role === "administrator" ? "1" : "0"
    );
    data.append("barangay_scope", String(values.barangay_scope || "ALL"));
    getPermissionCodesForRole(values.role).forEach((code) => data.append("permission_codes[]", code));

    if (Array.isArray(values.barangay_ids)) {
      values.barangay_ids.forEach((id) => data.append("barangay_ids[]", String(id)));
    }

    if (selectedPhoto) {
      data.append("avatar", selectedPhoto);
    }

    if (removePhoto) {
      data.append("remove_avatar", "1");
    }

    return data;
  };

  const onSubmit = async (values) => {
    const payload = { ...values };

    if (payload.role === "administrator") {
      payload.barangay_scope = "ALL";
      payload.barangay_ids = [];
      payload.can_delete = true;
    }

    if (!isAdminMode) {
      payload.can_delete = false;
    }

    if (payload.barangay_scope !== "SPECIFIC") {
      payload.barangay_ids = [];
    }

    try {
      setSubmitting(true);
      const formData = formDataFromValues(payload);

      if (editingAccount?.id) {
        await updateAccount(editingAccount.id, formData, apiScope);
        messageApi.success("Account updated.");
      } else {
        await createAccount(formData, apiScope);
        messageApi.success("Account added.");
      }

      if (editingAccount?.id === currentUserId) {
        const refreshed = await getAccounts(apiScope);
        const rows = Array.isArray(refreshed?.data?.data) ? refreshed.data.data : [];
        const self = rows.find((item) => Number(item.id) === currentUserId);
        const storageKey = getAvatarStorageKey(currentUserId);

        if (self?.avatar_url) {
          Cookies.set("avatar_url", self.avatar_url);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, self.avatar_url);
          }
        } else {
          Cookies.remove("avatar_url");
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(storageKey);
          }
        }
        Cookies.set("can_delete", String(self?.can_delete ? 1 : 0));

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
        }
      }

      setModalOpen(false);
      setEditingAccount(null);
      form.resetFields();
      resetPhotoState();
      await loadAccounts();
    } catch (error) {
      messageApi.error(extractApiErrorMessage(error, "Saving account failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    try {
      setLoading(true);
      await deleteAccount(id, apiScope);
      messageApi.success("Account deleted.");
      await loadAccounts();
    } catch (error) {
      messageApi.error(extractApiErrorMessage(error, "Deleting account failed."));
    } finally {
      setLoading(false);
    }
  };

  const onDisable = async (id) => {
    try {
      setLoading(true);
      await disableAccount(id, apiScope);
      messageApi.success("Account disabled.");
      await loadAccounts();
    } catch (error) {
      messageApi.error(extractApiErrorMessage(error, "Disabling account failed."));
    } finally {
      setLoading(false);
    }
  };

  const barangayOptionList = barangays.map((item) => ({
    value: item.barangay_id,
    label: item.barangay_name,
  }));

  return (
    <Layout>
      <Head>
        <title>{pageTitle}</title>
      </Head>

      {contextHolder}

      <main className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{pageTitle}</h1>
            <p className="text-slate-500">{pageDescription}</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Add Account
          </Button>
        </div>

        <div className="max-w-md">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search account"
            value={accountSearch}
            onChange={(event) => setAccountSearch(event.target.value)}
          />
        </div>

        {filteredAccounts.length === 0 && !loading ? (
          <Card>
            <Empty description="No account records found." />
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleAccounts.map((account) => (
              <Card key={account.id} loading={loading}>
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    {account.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={account.avatar_url} alt={account.username || account.name} className="account-avatar" />
                    ) : (
                      <Avatar size={64} icon={<UserOutlined />} />
                    )}

                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-slate-800 capitalize">{account.name || "-"}</p>
                      <p className="text-slate-600">@{account.username || "-"}</p>
                      <p className="text-sm text-slate-500">{account.designation || "No designation"}</p>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 ${isAdminMode ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
                    <div>
                      <p className="text-slate-500">Role</p>
                      <Tag
                        color={
                          account.role === "administrator"
                            ? "blue"
                            : account.role === "staff"
                              ? "gold"
                              : account.role === "municipal_staff"
                                ? "purple"
                                : "cyan"
                        }
                        className="mt-1"
                      >
                        {roleLabel(account.role)}
                      </Tag>
                    </div>
                    <div>
                      <p className="text-slate-500">Status</p>
                      <Tag color={account.is_active ? "green" : "red"} className="mt-1">
                        {account.is_active ? "ACTIVE" : "INACTIVE"}
                      </Tag>
                    </div>
                    <div>
                      <p className="text-slate-500">Must Change Password</p>
                      <Tag color={account.must_change_password ? "orange" : "default"} className="mt-1">
                        {account.must_change_password ? "YES" : "NO"}
                      </Tag>
                    </div>
                    <div>
                      <p className="text-slate-500">Scope</p>
                      <Tag className="mt-1">{account.barangay_scope || "ALL"}</Tag>
                    </div>
                    {isAdminMode ? (
                      <div>
                        <p className="text-slate-500">Delete Access</p>
                        <Tag color={account.role === "administrator" || account.can_delete ? "green" : "red"} className="mt-1">
                          {account.role === "administrator" || account.can_delete ? "ENABLED" : "DISABLED"}
                        </Tag>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500">Created At</p>
                      <p className="text-slate-700">{formatDateTime(account.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Updated At</p>
                      <p className="text-slate-700">{formatDateTime(account.updated_at)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(account)}>
                      Edit
                    </Button>
                    {isAdminMode ? (
                      <Popconfirm
                        title="Delete this account?"
                        onConfirm={() => onDelete(account.id)}
                        disabled={Number(account.id) === currentUserId}
                      >
                        <Button
                          icon={<DeleteOutlined />}
                          danger
                          disabled={Number(account.id) === currentUserId}
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Popconfirm
                        title="Disable this account?"
                        onConfirm={() => onDisable(account.id)}
                        disabled={Number(account.id) === currentUserId || !account.is_active}
                      >
                        <Button
                          icon={<StopOutlined />}
                          danger
                          disabled={Number(account.id) === currentUserId || !account.is_active}
                        >
                          {account.is_active ? "Disable" : "Disabled"}
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            <div ref={sentinelRef} className="h-2" />
            {!loading && visibleCount < filteredAccounts.length ? (
              <p className="text-center text-xs text-slate-400">Scroll to load more accounts...</p>
            ) : null}
            {!loading && filteredAccounts.length > 0 && visibleCount >= filteredAccounts.length ? (
              <p className="text-center text-xs text-slate-400">All account records loaded.</p>
            ) : null}
          </div>
        )}
      </main>

      <Modal
        title={isCreateMode ? "Add Account" : "Edit Account"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingAccount(null);
          form.resetFields();
          resetPhotoState();
        }}
        onOk={() => form.submit()}
        okText={isCreateMode ? "Create" : "Save"}
        confirmLoading={submitting}
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={initialFormValues()}
          onValuesChange={(changedValues, allValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, "role")) {
              setFormRole(changedValues.role);
              if (isAdminMode && changedValues.role === "administrator") {
                form.setFieldsValue({
                  barangay_scope: "ALL",
                  barangay_ids: [],
                  can_delete: true,
                });
                setFormScope("ALL");
              } else if (!isAdminMode) {
                form.setFieldsValue({ can_delete: false });
              }
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, "barangay_scope")) {
              setFormScope(changedValues.barangay_scope || "ALL");
              if (changedValues.barangay_scope !== "SPECIFIC") {
                form.setFieldsValue({ barangay_ids: [] });
              }
            }
            if (!Object.prototype.hasOwnProperty.call(changedValues, "role")) {
              setFormRole(allValues.role || "staff");
            }
          }}
          onFinish={onSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item
              label="Full Name"
              name="name"
              rules={[{ required: true, message: "Name is required." }]}
            >
              <Input placeholder="Enter name" />
            </Form.Item>

            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Username is required." }]}
            >
              <Input placeholder="Enter username" />
            </Form.Item>

            <Form.Item label="Designation" name="designation">
              <Input placeholder="Optional designation" />
            </Form.Item>

            <Form.Item
              label={isCreateMode ? "Password" : "Password (leave blank to keep current)"}
              name="password"
              rules={[
                { required: isCreateMode, message: "Password is required for new accounts." },
                { min: 6, message: "Password must be at least 6 characters." },
              ]}
            >
              <Input.Password placeholder={isCreateMode ? "Enter password" : "Optional new password"} />
            </Form.Item>

            <Form.Item
              label="Role"
              name="role"
              rules={[{ required: true, message: "Role is required." }]}
            >
              <Select options={roleOptions} />
            </Form.Item>

            <Form.Item label="Barangay Scope" name="barangay_scope">
              <Select options={scopeOptions} disabled={formRole === "administrator"} />
            </Form.Item>
          </div>

          <Form.Item label="Active Account" name="is_active" valuePropName="checked">
            <Switch disabled={Number(editingAccount?.id || 0) === currentUserId} />
          </Form.Item>
          {isAdminMode ? (
            <Form.Item label="Allow Delete Actions" name="can_delete" valuePropName="checked">
              <Switch disabled={formRole === "administrator"} />
            </Form.Item>
          ) : null}

          {formRole !== "administrator" && formScope === "SPECIFIC" ? (
            <Form.Item
              label="Assigned Barangays"
              name="barangay_ids"
              rules={[{ required: true, message: "Select at least one barangay." }]}
            >
              <Select mode="multiple" options={barangayOptionList} placeholder="Select barangays" />
            </Form.Item>
          ) : null}

          <Form.Item label="User Photo">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="User photo preview" className="account-avatar" />
              ) : (
                <Avatar size={64} icon={<UserOutlined />} />
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={onPhotoPick}
                >
                  <Button icon={<UploadOutlined />}>Upload Photo</Button>
                </Upload>
                <Button onClick={removePickedPhoto} disabled={!photoPreview && !selectedPhoto}>
                  Remove Photo
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Allowed: image files only, max size 2MB.</p>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default function AdminAccountManagementRoute() {
  return <AccountManagementPage mode="administrator" />;
}
