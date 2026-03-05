import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Spin,
  Tag,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  UpOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetBarangays } from "../api/barangay";
import { GetPuroksByBarangay } from "../api/purok";
import { GetPrecinctsByPurok } from "../api/precinct";
import { GetRecipients, postRecipient, updateRecipient, deleteRecipient } from "../api/recipients";
import { canDeleteActions, GEO_PERMISSIONS, hasAnyPermission } from "../../utils/access";
import { extractApiErrorMessage, getApiBaseUrl } from "../../utils/api";

const PAGE_SIZE = 20;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const NONE_OPTION_VALUE = "__NONE__";

const normalize = (v) => String(v || "").trim().toLowerCase();
const isActive = (v) => ["active", "verified", "pending"].includes(normalize(v));
const statusLabel = (v) => (isActive(v) ? "ACTIVE" : "ENACTIVE");
const statusColor = (v) => (isActive(v) ? "green" : "red");
const formStatus = (v) => (isActive(v) ? "ACTIVE" : "INACTIVE");
const toUpperText = (v) => String(v || "").trim().toUpperCase();
const toLowerText = (v) => String(v || "").trim().toLowerCase();
const toProperText = (v) =>
  toLowerText(v).replace(/(^|[\s\-'])([a-z])/g, (_, start, letter) => `${start}${letter.toUpperCase()}`);

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
};
const fmtDateTime = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const fullName = (r) => {
  const last = toUpperText(r?.last_name);
  const first = toProperText(r?.first_name);
  const middle = toLowerText(r?.middle_name);
  const extension = toUpperText(r?.extension);
  return `${last}${first ? `, ${first}` : ""}${middle ? ` ${middle}` : ""}${extension ? ` ${extension}` : ""}`.trim() || "No name";
};

const imageUrl = (r) => {
  const absolute = String(r?.profile_picture_url || "").trim();
  if (absolute) return absolute;
  const raw = String(r?.profile_picture || "").trim();
  if (!raw) return "";
  if (/^(https?:\/\/|data:)/i.test(raw)) return raw;
  const root = String(getApiBaseUrl() || "").replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return root ? `${root}${raw.startsWith("/") ? raw : `/${raw}`}` : raw;
};

const sortToApi = (opt) => {
  if (opt === "barangay_asc") return { sort_by: "barangay", sort_dir: "asc" };
  if (opt === "purok_asc") return { sort_by: "purok", sort_dir: "asc" };
  if (opt === "precinct_asc") return { sort_by: "precinct_no", sort_dir: "asc" };
  return { sort_by: "updated_at", sort_dir: "desc" };
};

export default function VotersPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const canManageGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO]);
  const canDeleteGeo = canManageGeo && canDeleteActions();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(0);

  const [voters, setVoters] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [filterPuroks, setFilterPuroks] = useState([]);
  const [filterPrecincts, setFilterPrecincts] = useState([]);
  const [formPuroks, setFormPuroks] = useState([]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [barangayId, setBarangayId] = useState();
  const [purokId, setPurokId] = useState();
  const [precinctNo, setPrecinctNo] = useState();
  const [sortOpt, setSortOpt] = useState("updated_desc");
  const [filteredCount, setFilteredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [expanded, setExpanded] = useState({});

  const sentinelRef = useRef(null);
  const queryRef = useRef("");

  useEffect(() => {
    if (router.pathname === "/recipients") {
      router.replace("/voters");
    }
  }, [router, router.pathname]);

  const selectedBarangayName = useMemo(() => {
    if (barangayId === NONE_OPTION_VALUE) return "None";
    return barangays.find((b) => Number(b.barangay_id) === Number(barangayId))?.barangay_name || "";
  }, [barangays, barangayId]);
  const selectedPurokName = useMemo(() => {
    if (purokId === NONE_OPTION_VALUE) return "None";
    return filterPuroks.find((p) => Number(p.purok_id) === Number(purokId))?.purok_name || "";
  }, [filterPuroks, purokId]);
  const sortApi = useMemo(() => sortToApi(sortOpt), [sortOpt]);
  const barangayOptions = useMemo(
    () => [{ value: NONE_OPTION_VALUE, label: "None" }, ...barangays.map((x) => ({ value: x.barangay_id, label: x.barangay_name }))],
    [barangays],
  );
  const purokOptions = useMemo(
    () => [{ value: NONE_OPTION_VALUE, label: "None" }, ...filterPuroks.map((x) => ({ value: x.purok_id, label: x.purok_name }))],
    [filterPuroks],
  );

  const unauthorized = useCallback((error) => {
    if (error?.response?.status === 401) {
      Cookies.remove("accessToken");
      router.push({ pathname: "/" });
      return true;
    }
    return false;
  }, [router]);

  const loadBarangays = useCallback(async () => {
    try {
      const res = await GetBarangays();
      setBarangays(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e) {
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load barangays."));
    }
  }, [unauthorized]);

  const loadPuroks = useCallback(async (id, target = "filter") => {
    if (!id) {
      if (target === "filter") setFilterPuroks([]);
      if (target === "form") setFormPuroks([]);
      return [];
    }
    try {
      const res = await GetPuroksByBarangay(id);
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      if (target === "filter") setFilterPuroks(rows);
      if (target === "form") setFormPuroks(rows);
      return rows;
    } catch (e) {
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load puroks."));
      return [];
    }
  }, [unauthorized]);

  const loadPrecincts = useCallback(async (id) => {
    if (!id) {
      setFilterPrecincts([]);
      return [];
    }
    try {
      const res = await GetPrecinctsByPurok(id);
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setFilterPrecincts(rows);
      return rows;
    } catch (e) {
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load precincts."));
      setFilterPrecincts([]);
      return [];
    }
  }, [unauthorized]);

  const fetchPage = useCallback(async (nextPage = 1, append = false) => {
    const q = JSON.stringify({
      s: debouncedSearch.trim(),
      b: selectedBarangayName,
      p: selectedPurokName,
      n: precinctNo,
      by: sortApi.sort_by,
      dir: sortApi.sort_dir,
    });
    queryRef.current = q;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await GetRecipients({
        page: nextPage,
        per_page: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        barangay: selectedBarangayName || undefined,
        purok: selectedPurokName || undefined,
        precinct_no: precinctNo || undefined,
        sort_by: sortApi.sort_by,
        sort_dir: sortApi.sort_dir,
      });
      if (q !== queryRef.current) return;
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      const meta = res?.data?.pagination || {};
      const counts = res?.data?.counts || {};
      const cp = Number(meta.current_page || nextPage);
      const lp = Number(meta.last_page || 1);
      const filtered = Number(counts.filtered ?? meta.total ?? rows.length ?? 0);
      const total = Number(counts.total ?? filtered);
      setVoters((prev) => (append ? Array.from(new Map([...prev, ...rows].map((x) => [Number(x.recipient_id), x])).values()) : rows));
      setFilteredCount(filtered);
      setTotalCount(total);
      setPage(cp);
      setHasMore(cp < lp);
    } catch (e) {
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load voters."));
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [debouncedSearch, precinctNo, selectedBarangayName, selectedPurokName, sortApi, unauthorized]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const auth = await Auth(router?.pathname);
      if (!mounted) return;
      if (auth !== router?.pathname) {
        router.push({ pathname: auth });
        return;
      }
      await loadBarangays();
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [router, loadBarangays]);

  useEffect(() => {
    if (!ready) return;
    setExpanded({});
    setPage(0);
    setHasMore(false);
    fetchPage(1, false);
  }, [ready, debouncedSearch, selectedBarangayName, selectedPurokName, precinctNo, sortApi, fetchPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !ready || !hasMore || loading || loadingMore) return undefined;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) fetchPage(page + 1, true);
    }, { rootMargin: "320px 0px", threshold: 0.01 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [ready, hasMore, loading, loadingMore, page, fetchPage]);

  const resetModal = () => {
    form.resetFields();
    form.setFieldsValue({ status: "ACTIVE" });
    setFormPuroks([]);
    setEditing(null);
    setSelectedPhoto(null);
    setPhotoPreview("");
    setRemovePhoto(false);
  };

  const openCreate = () => { resetModal(); setModalOpen(true); };

  const openEdit = async (r) => {
    resetModal();
    setEditing(r);
    setPhotoPreview(imageUrl(r));
    const b = barangays.find((x) => normalize(x.barangay_name) === normalize(r.barangay));
    const bId = b?.barangay_id;
    let pId;
    if (bId) {
      const rows = await loadPuroks(bId, "form");
      pId = rows.find((x) => normalize(x.purok_name) === normalize(r.purok))?.purok_id;
    }
    form.setFieldsValue({
      precinct_no: r?.precinct_no || "",
      voters_id_number: r?.voters_id_number || "",
      first_name: r?.first_name || "",
      middle_name: r?.middle_name || "",
      last_name: r?.last_name || "",
      extension: r?.extension || "",
      birthdate: r?.birthdate || "",
      occupation: r?.occupation || "",
      barangay_id: bId,
      purok_id: pId,
      marital_status: r?.marital_status || undefined,
      phone_number: r?.phone_number || "",
      religion: r?.religion || "",
      sex: normalize(r?.sex) === "female" ? "FEMALE" : normalize(r?.sex) === "male" ? "MALE" : undefined,
      status: formStatus(r?.status),
    });
    setModalOpen(true);
  };

  const onPhotoPick = async (file) => {
    if (!file.type?.startsWith("image/")) return Upload.LIST_IGNORE;
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image is too large. Maximum size is 2MB.");
      return Upload.LIST_IGNORE;
    }
    setSelectedPhoto(file);
    setRemovePhoto(false);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
    return false;
  };

  const clearPhoto = () => { setSelectedPhoto(null); setPhotoPreview(""); setRemovePhoto(true); };

  const submit = async (vals) => {
    const fd = new FormData();
    ["precinct_no","voters_id_number","first_name","middle_name","last_name","extension","birthdate","occupation","marital_status","phone_number","religion","sex"].forEach((k) => {
      const v = vals?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") fd.append(k, String(v).trim());
    });
    fd.append("barangay_id", String(vals.barangay_id));
    fd.append("purok_id", String(vals.purok_id));
    fd.append("status", String(vals.status || "ACTIVE"));
    if (selectedPhoto) fd.append("profile_picture", selectedPhoto);
    if (removePhoto) fd.append("remove_profile_picture", "1");
    try {
      setSubmitting(true);
      if (editing?.recipient_id) {
        await updateRecipient(editing.recipient_id, fd);
        toast.success("Voter updated.");
      } else {
        await postRecipient(fd);
        toast.success("Voter added.");
      }
      setModalOpen(false);
      resetModal();
      await fetchPage(1, false);
    } catch (e) {
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Saving voter failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    try {
      setDeletingId(id);
      await deleteRecipient(id);
      toast.success("Voter deleted.");
      await fetchPage(1, false);
    } catch (e) {
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Deleting voter failed."));
    } finally {
      setDeletingId(0);
    }
  };

  return (
    <Layout>
      <Head><title>Voters</title></Head>
      <main className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Voters</h1>
            <p className="text-slate-500">Voters Count: <span className="font-semibold">{filteredCount}/{totalCount}</span></p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManageGeo} onClick={openCreate}>Add Voter</Button>
        </div>

        <Card>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
            <div className="xl:col-span-2">
              <Input allowClear prefix={<SearchOutlined />} placeholder="Search voter" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select
              allowClear
              showSearch
              placeholder="Select Barangay (All by default)"
              options={barangayOptions}
              optionFilterProp="label"
              value={barangayId}
              onChange={async (v) => {
                setBarangayId(v);
                setPurokId(v === NONE_OPTION_VALUE ? NONE_OPTION_VALUE : undefined);
                setPrecinctNo(undefined);
                setFilterPrecincts([]);
                if (!v || v === NONE_OPTION_VALUE) {
                  setFilterPuroks([]);
                  return;
                }
                await loadPuroks(v, "filter");
              }}
            />
            <Select
              allowClear
              showSearch
              placeholder="Select Purok"
              options={purokOptions}
              optionFilterProp="label"
              value={purokId}
              disabled={!barangayId || barangayId === NONE_OPTION_VALUE}
              onChange={async (v) => {
                setPurokId(v);
                setPrecinctNo(undefined);
                if (!v || v === NONE_OPTION_VALUE) {
                  setFilterPrecincts([]);
                  return;
                }
                await loadPrecincts(v);
              }}
            />
            <div className="flex gap-2">
              <Select allowClear showSearch className="flex-1" placeholder="Select Precinct" options={filterPrecincts.map((x) => ({ value: x.precinct_name, label: x.precinct_name }))} optionFilterProp="label" value={precinctNo} disabled={!purokId || purokId === NONE_OPTION_VALUE} onChange={setPrecinctNo} />
              <Select className="w-44" value={sortOpt} onChange={setSortOpt} options={[{ value: "updated_desc", label: "Latest" }, { value: "barangay_asc", label: "Sort Barangay" }, { value: "purok_asc", label: "Sort Purok" }, { value: "precinct_asc", label: "Sort Precinct" }]} />
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><Skeleton active avatar paragraph={{ rows: 5 }} /></Card>)}</div>
        ) : voters.length === 0 ? (
          <Card><Empty description="No voter records found." /></Card>
        ) : (
          <div className="space-y-4">
            {voters.map((r) => {
              const open = !!expanded[r.recipient_id];
              const last = toUpperText(r?.last_name);
              const first = toProperText(r?.first_name);
              const middle = toLowerText(r?.middle_name);
              const extension = toUpperText(r?.extension);
              return (
                <Card key={r.recipient_id}>
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="flex flex-col sm:flex-row gap-4 min-w-0">
                        <div className="shrink-0">
                          {imageUrl(r) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl(r)} alt={fullName(r)} className="w-24 h-24 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-24 h-24 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-600 text-3xl"><UserOutlined /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-semibold text-slate-800 break-words">
                            <span>{last || "NO NAME"}</span>
                            {first ? <span>, {first}</span> : null}
                            {middle ? <span className="italic"> {middle}</span> : null}
                            {extension ? <span> {extension}</span> : null}
                          </p>
                          <p className="text-slate-600 text-sm uppercase">Voter&apos;s ID Number: {toUpperText(r?.voters_id_number) || "-"}</p>
                          <Tag color={statusColor(r?.status)} className="mt-2">{statusLabel(r?.status)}</Tag>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button icon={open ? <UpOutlined /> : <DownOutlined />} onClick={() => setExpanded((p) => ({ ...p, [r.recipient_id]: !p[r.recipient_id] }))}>{open ? "Hide Details" : "Show More Details"}</Button>
                        <Button icon={<EditOutlined />} disabled={!canManageGeo} onClick={() => openEdit(r)}>Edit</Button>
                        <Popconfirm title="Delete this voter?" onConfirm={() => remove(r.recipient_id)} disabled={!canDeleteGeo}>
                          <Button danger icon={<DeleteOutlined />} disabled={!canDeleteGeo || deletingId === r.recipient_id} loading={deletingId === r.recipient_id}>Delete</Button>
                        </Popconfirm>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm uppercase">
                      <div><p className="text-slate-500">Precinct</p><p className="text-slate-800 font-medium">{toUpperText(r?.precinct_no) || "-"}</p></div>
                      <div><p className="text-slate-500">Barangay</p><p className="text-slate-800 font-medium">{toUpperText(r?.barangay) || "-"}</p></div>
                      <div><p className="text-slate-500">Purok</p><p className="text-slate-800 font-medium">{toUpperText(r?.purok) || "-"}</p></div>
                    </div>
                    {open ? (
                      <div className="border-t border-slate-200 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm uppercase">
                          <div><p className="text-slate-500">Birthdate</p><p className="text-slate-800">{toUpperText(fmtDate(r?.birthdate)) || "-"}</p></div>
                          <div><p className="text-slate-500">Sex</p><p className="text-slate-800">{toUpperText(r?.sex) || "-"}</p></div>
                          <div><p className="text-slate-500">Marital Status</p><p className="text-slate-800">{toUpperText(r?.marital_status) || "-"}</p></div>
                          <div><p className="text-slate-500">Occupation</p><p className="text-slate-800">{toUpperText(r?.occupation) || "-"}</p></div>
                          <div><p className="text-slate-500">Phone Number</p><p className="text-slate-800">{toUpperText(r?.phone_number) || "-"}</p></div>
                          <div><p className="text-slate-500">Religion</p><p className="text-slate-800">{toUpperText(r?.religion) || "-"}</p></div>
                          <div><p className="text-slate-500">Created At</p><p className="text-slate-800">{toUpperText(fmtDateTime(r?.created_at)) || "-"}</p></div>
                          <div><p className="text-slate-500">Updated At</p><p className="text-slate-800">{toUpperText(fmtDateTime(r?.updated_at)) || "-"}</p></div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div ref={sentinelRef} className="h-2" />
        {loadingMore ? <div className="flex items-center justify-center py-3"><Spin size="small" /><span className="ml-2 text-sm text-slate-500">Loading more voters...</span></div> : null}
        {!loading && voters.length > 0 && !hasMore ? <p className="text-center text-xs text-slate-400">All records loaded.</p> : null}
      </main>

      <Modal
        title={editing?.recipient_id ? "Edit Voter" : "Add Voter"}
        open={modalOpen}
        width={900}
        onCancel={() => { setModalOpen(false); resetModal(); }}
        onOk={() => form.submit()}
        okText={editing?.recipient_id ? "Update" : "Save"}
        okButtonProps={{ disabled: !canManageGeo, loading: submitting }}
        cancelButtonProps={{ disabled: submitting }}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Form.Item label="Precinct" name="precinct_no"><Input maxLength={100} /></Form.Item>
            <Form.Item label="Voter's ID Number" name="voters_id_number"><Input maxLength={120} /></Form.Item>
            <Form.Item label="First Name" name="first_name" rules={[{ required: true, message: "First name is required." }]}><Input maxLength={150} /></Form.Item>
            <Form.Item label="Middle Name" name="middle_name"><Input maxLength={150} /></Form.Item>
            <Form.Item label="Last Name" name="last_name" rules={[{ required: true, message: "Last name is required." }]}><Input maxLength={150} /></Form.Item>
            <Form.Item label="Extension" name="extension"><Input maxLength={50} /></Form.Item>
            <Form.Item label="Birthdate" name="birthdate"><Input type="date" /></Form.Item>
            <Form.Item label="Occupation" name="occupation"><Input maxLength={200} /></Form.Item>
            <Form.Item label="Barangay" name="barangay_id" rules={[{ required: true, message: "Barangay is required." }]}>
              <Select showSearch options={barangays.map((x) => ({ value: x.barangay_id, label: x.barangay_name }))} optionFilterProp="label" onChange={async (v) => { form.setFieldValue("purok_id", undefined); await loadPuroks(v, "form"); }} />
            </Form.Item>
            <Form.Item label="Purok" name="purok_id" rules={[{ required: true, message: "Purok is required." }]}>
              <Select showSearch options={formPuroks.map((x) => ({ value: x.purok_id, label: x.purok_name }))} optionFilterProp="label" />
            </Form.Item>
            <Form.Item label="Marital Status" name="marital_status"><Select allowClear options={[{ value: "SINGLE", label: "Single" }, { value: "MARRIED", label: "Married" }, { value: "WIDOWED", label: "Widowed" }, { value: "SEPARATED", label: "Separated" }]} /></Form.Item>
            <Form.Item label="Phone Number" name="phone_number"><Input maxLength={50} /></Form.Item>
            <Form.Item label="Religion" name="religion"><Input maxLength={100} /></Form.Item>
            <Form.Item label="Sex" name="sex"><Select allowClear options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }]} /></Form.Item>
            <Form.Item label="Status" name="status" initialValue="ACTIVE"><Select options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Enactive" }]} /></Form.Item>
          </div>
          <Form.Item label="Voter Picture">
            <Upload accept="image/*" beforeUpload={onPhotoPick} onRemove={() => { clearPhoto(); return true; }} maxCount={1} fileList={selectedPhoto ? [selectedPhoto] : []}>
              <Button icon={<UploadOutlined />}>Select Picture</Button>
            </Upload>
            {photoPreview ? (
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Voter preview" className="w-28 h-28 rounded-full object-cover border border-slate-200" />
                <Button danger onClick={clearPhoto}>Remove Picture</Button>
              </div>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>

      <ToastContainer />
    </Layout>
  );
}
