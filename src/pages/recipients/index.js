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
  Upload,
} from "antd";
import {
  AuditOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  FilterOutlined,
  IdcardOutlined,
  PlusOutlined,
  QrcodeOutlined,
  SearchOutlined,
  UpOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import QRCode from "react-qr-code";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetBarangays } from "../api/barangay";
import { GetPuroksByBarangay } from "../api/purok";
import { GetPrecinctsByPurok } from "../api/precinct";
import { GetRecipients, postRecipient, updateRecipient, deleteRecipient } from "../api/recipients";
import { GetReligions } from "../api/religion";
import { GetTribes } from "../api/tribe";
import { canDeleteActions, GEO_PERMISSIONS, hasAnyPermission } from "../../utils/access";
import { extractApiErrorMessage, getApiBaseUrl } from "../../utils/api";

const PAGE_SIZE = 20;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const NONE_OPTION_VALUE = "__NONE__";
const BLANK_OPTION = { value: NONE_OPTION_VALUE, label: "Blank" };

const toFilterLocationId = (value) => {
  if (value === NONE_OPTION_VALUE) return 0;
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

const hasLocationLabel = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized !== "" && !/^-?\d+$/.test(normalized);
};

const toAssignedLocationId = (...values) => {
  for (const value of values) {
    const normalized = toFilterLocationId(value);
    if (normalized === undefined) continue;
    return normalized > 0 ? normalized : undefined;
  }

  return undefined;
};

const normalize = (v) => String(v || "").trim().toLowerCase();
const isActive = (v) => ["active", "verified", "pending"].includes(normalize(v));
const statusLabel = (v) => (isActive(v) ? "ACTIVE" : "INACTIVE");
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
  const middle = toProperText(r?.middle_name);
  const extension = toUpperText(r?.extension);
  return `${last}${first ? `, ${first}` : ""}${middle ? ` ${middle}` : ""}${extension ? ` ${extension}` : ""}`.trim() || "No name";
};
const voterInitials = (r) => {
  const first = toUpperText(r?.first_name).charAt(0);
  const last = toUpperText(r?.last_name).charAt(0);
  return `${first}${last}` || "VR";
};
const displayValue = (value, fallback = "Not recorded") => String(value ?? "").trim() || fallback;
const voterQrValue = (record, barangay, purok) => [
  "MUNICIPAL VOTER REGISTRY",
  `Record ID: ${String(record?.recipient_id || "").padStart(6, "0")}`,
  `Name: ${fullName(record)}`,
  `Voter ID: ${displayValue(toUpperText(record?.voters_id_number), "Not assigned")}`,
  `Precinct: ${displayValue(toUpperText(record?.precinct_no), "Unassigned")}`,
  `Barangay: ${displayValue(toUpperText(barangay))}`,
  `Purok/Sitio: ${displayValue(toUpperText(purok))}`,
  `Birthdate: ${displayValue(fmtDate(record?.birthdate))}`,
  `Sex: ${displayValue(toProperText(record?.sex))}`,
].join("\n");

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
  const formBarangayId = Form.useWatch("barangay_id", form);
  const canManageGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO]);
  const canEditGeo = hasAnyPermission([GEO_PERMISSIONS.MANAGE_GEO, GEO_PERMISSIONS.EDIT_GEO]);
  const canDeleteGeo = canManageGeo && canDeleteActions();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(0);

  const [voters, setVoters] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [religions, setReligions] = useState([]);
  const [tribes, setTribes] = useState([]);
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

  const selectedBarangayFilterId = useMemo(() => toFilterLocationId(barangayId), [barangayId]);
  const selectedPurokFilterId = useMemo(() => toFilterLocationId(purokId), [purokId]);
  const sortApi = useMemo(() => sortToApi(sortOpt), [sortOpt]);
  const hasActiveFilters = useMemo(() => (
    search.trim() !== ""
    || barangayId !== undefined
    || purokId !== undefined
    || precinctNo !== undefined
    || sortOpt !== "updated_desc"
  ), [barangayId, precinctNo, purokId, search, sortOpt]);
  const barangayOptions = useMemo(
    () => [{ value: NONE_OPTION_VALUE, label: "Un Assigned" }, ...barangays.map((x) => ({ value: x.barangay_id, label: x.barangay_name }))],
    [barangays],
  );
  const purokOptions = useMemo(
    () => [{ value: NONE_OPTION_VALUE, label: "Un Assigned" }, ...filterPuroks.map((x) => ({ value: x.purok_id, label: x.purok_name }))],
    [filterPuroks],
  );
  const formBarangayOptions = useMemo(
    () => [{ value: NONE_OPTION_VALUE, label: "Un Assigned" }, ...barangays.map((x) => ({ value: x.barangay_id, label: x.barangay_name }))],
    [barangays],
  );
  const formPurokOptions = useMemo(
    () => [{ value: NONE_OPTION_VALUE, label: "Un Assigned" }, ...formPuroks.map((x) => ({ value: x.purok_id, label: x.purok_name }))],
    [formPuroks],
  );
  const religionOptions = useMemo(
    () => [
      BLANK_OPTION,
      ...religions.map((x) => ({
        value: x.religion_name,
        label: x.status === "INACTIVE" ? `${x.religion_name} (Inactive)` : x.religion_name,
      })),
    ],
    [religions],
  );
  const tribeOptions = useMemo(
    () => [
      BLANK_OPTION,
      ...tribes.map((x) => ({
        value: x.tribe_id,
        label: x.status === "INACTIVE" ? `${x.tribe_name} (Inactive)` : x.tribe_name,
      })),
    ],
    [tribes],
  );
  const barangayNameById = useMemo(
    () => new Map(barangays.map((x) => [Number(x.barangay_id), x.barangay_name])),
    [barangays],
  );

  const getBarangayLabel = useCallback((record) => {
    if (hasLocationLabel(record?.barangay_name)) return String(record.barangay_name).trim();
    if (hasLocationLabel(record?.barangay)) return String(record.barangay).trim();

    const id = toAssignedLocationId(record?.barangay_id, record?.barangay);
    if (id) return barangayNameById.get(id) || `Barangay #${id}`;

    return "Un Assigned";
  }, [barangayNameById]);

  const getPurokLabel = useCallback((record) => {
    if (hasLocationLabel(record?.purok_name)) return String(record.purok_name).trim();
    if (hasLocationLabel(record?.purok)) return String(record.purok).trim();

    const id = toAssignedLocationId(record?.purok_id, record?.purok);
    if (id) return `Purok #${id}`;

    return "Un Assigned";
  }, []);

  const clearRegistryFilters = () => {
    setSearch("");
    setBarangayId(undefined);
    setPurokId(undefined);
    setPrecinctNo(undefined);
    setSortOpt("updated_desc");
    setFilterPuroks([]);
    setFilterPrecincts([]);
  };

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
      setBarangays([]);
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load barangays."));
    }
  }, [unauthorized]);

  const loadReligions = useCallback(async () => {
    try {
      const res = await GetReligions();
      setReligions(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e) {
      setReligions([]);
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load religions."));
    }
  }, [unauthorized]);

  const loadTribes = useCallback(async () => {
    try {
      const res = await GetTribes();
      setTribes(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e) {
      setTribes([]);
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load tribes."));
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
      if (target === "filter") {
        setFilterPuroks([]);
        setFilterPrecincts([]);
      }
      if (target === "form") setFormPuroks([]);
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
      b: selectedBarangayFilterId ?? null,
      p: selectedPurokFilterId ?? null,
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
        barangay_id: selectedBarangayFilterId,
        purok_id: selectedPurokFilterId,
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
      if (!append && q === queryRef.current) {
        setVoters([]);
        setFilteredCount(0);
        setTotalCount(0);
        setPage(0);
        setHasMore(false);
      }
      if (!unauthorized(e)) toast.error(extractApiErrorMessage(e, "Failed to load voters."));
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [debouncedSearch, precinctNo, selectedBarangayFilterId, selectedPurokFilterId, sortApi, unauthorized]);

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
      await Promise.all([loadBarangays(), loadReligions(), loadTribes()]);
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [router, loadBarangays, loadReligions, loadTribes]);

  useEffect(() => {
    if (!ready) return;
    setExpanded({});
    setPage(0);
    setHasMore(false);
    fetchPage(1, false);
  }, [ready, debouncedSearch, selectedBarangayFilterId, selectedPurokFilterId, precinctNo, sortApi, fetchPage]);

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
    form.setFieldsValue({ religion: NONE_OPTION_VALUE, status: "ACTIVE", tribe_id: NONE_OPTION_VALUE });
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
    const bId = toAssignedLocationId(r?.barangay_id, r?.barangay);
    const pId = toAssignedLocationId(r?.purok_id, r?.purok);
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
      religion: r?.religion || NONE_OPTION_VALUE,
      tribe_id: r?.tribe_id || NONE_OPTION_VALUE,
      sex: normalize(r?.sex) === "female" ? "FEMALE" : normalize(r?.sex) === "male" ? "MALE" : undefined,
      status: formStatus(r?.status),
    });
    setModalOpen(true);
    if (bId) {
      const rows = await loadPuroks(bId, "form");
      const resolvedPurokId = rows.some((x) => Number(x.purok_id) === Number(pId)) ? pId : undefined;
      form.setFieldValue("purok_id", resolvedPurokId);
    }
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
    const selectedBarangayId = toFilterLocationId(vals?.barangay_id);
    const selectedPurokId = toFilterLocationId(vals?.purok_id);
    const selectedTribeId = Number(vals?.tribe_id);
    const fd = new FormData();
    ["precinct_no","voters_id_number","first_name","middle_name","last_name","extension","birthdate","occupation","marital_status","phone_number","sex"].forEach((k) => {
      const v = vals?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") fd.append(k, String(v).trim());
    });
    if (vals?.religion && vals.religion !== NONE_OPTION_VALUE) {
      fd.append("religion", String(vals.religion).trim());
    }
    if (Number.isFinite(selectedTribeId) && selectedTribeId > 0) {
      fd.append("tribe_id", String(selectedTribeId));
    }
    if (selectedBarangayId === undefined) {
      form.setFields([{ name: "barangay_id", errors: ["Barangay is required."] }]);
      return;
    }
    fd.append("barangay_id", String(selectedBarangayId));
    if (selectedPurokId !== undefined) {
      fd.append("purok_id", String(selectedPurokId));
    }
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

  const downloadVoterQr = (record) => {
    const qrElement = document.getElementById(`voter-qr-${record.recipient_id}`);
    if (!qrElement) {
      toast.error("The voter QR code is not ready yet.");
      return;
    }

    const rawSvg = new XMLSerializer().serializeToString(qrElement);
    const serialized = rawSvg.includes("xmlns=")
      ? rawSvg
      : rawSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(svgBlob);
    const qrImage = new Image();

    qrImage.onload = () => {
      const size = 640;
      const padding = 48;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        toast.error("Unable to prepare the voter QR download.");
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.imageSmoothingEnabled = false;
      context.drawImage(qrImage, padding, padding, size - (padding * 2), size - (padding * 2));
      URL.revokeObjectURL(objectUrl);

      const safeName = fullName(record).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
      const link = document.createElement("a");
      link.download = `voter-qr-${record.recipient_id}-${safeName || "record"}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    qrImage.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Unable to prepare the voter QR download.");
    };
    qrImage.src = objectUrl;
  };

  return (
    <Layout>
      <Head><title>Voters</title></Head>
      <main className="voter-registry-page">
        <section className="voter-registry-hero">
          <div className="voter-registry-brand">
            <div className="voter-registry-emblem"><AuditOutlined /></div>
            <div>
              <p className="voter-registry-eyebrow">Municipal voter information system</p>
              <h1>Voter Registry</h1>
              <p className="voter-registry-subtitle">Search and manage the official barangay, purok, and precinct masterlist.</p>
            </div>
          </div>
          <div className="voter-registry-hero-actions">
            <div className="voter-registry-count">
              <span>Records displayed</span>
              <strong>{filteredCount.toLocaleString()}</strong>
              <small>of {totalCount.toLocaleString()} registered voters</small>
            </div>
            {canManageGeo ? (
              <Button className="voter-registry-add" type="primary" size="large" icon={<PlusOutlined />} onClick={openCreate}>Add voter</Button>
            ) : null}
          </div>
        </section>

        <section className="voter-registry-toolbar" aria-label="Voter registry filters">
          <div className="voter-registry-toolbar-heading">
            <div>
              <FilterOutlined />
              <strong>Registry filters</strong>
              <span>Refine records by identity or election location</span>
            </div>
            {hasActiveFilters ? <Button type="link" onClick={clearRegistryFilters}>Clear all filters</Button> : null}
          </div>
          <div className="voter-registry-filter-grid">
            <div className="voter-registry-filter voter-registry-filter--search">
              <span>Voter search</span>
              <Input size="large" allowClear prefix={<SearchOutlined />} placeholder="Search by voter name or ID" aria-label="Search voters" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="voter-registry-filter">
              <span>Barangay</span>
              <Select
                size="large"
                allowClear
                showSearch
                aria-label="Filter by barangay"
                placeholder="All barangays"
                options={barangayOptions}
                optionFilterProp="label"
                value={barangayId}
                onChange={async (v) => {
                  setBarangayId(v);
                  setPurokId(undefined);
                  setPrecinctNo(undefined);
                  setFilterPrecincts([]);
                  if (!v || v === NONE_OPTION_VALUE) {
                    setFilterPuroks([]);
                    return;
                  }
                  await loadPuroks(v, "filter");
                }}
              />
            </div>
            <div className="voter-registry-filter">
              <span>Purok</span>
              <Select
                size="large"
                allowClear
                showSearch
                aria-label="Filter by purok"
                placeholder="All puroks"
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
            </div>
            <div className="voter-registry-filter">
              <span>Precinct</span>
              <Select size="large" allowClear showSearch aria-label="Filter by precinct" placeholder="All precincts" options={filterPrecincts.map((x) => ({ value: x.precinct_name, label: x.precinct_name }))} optionFilterProp="label" value={precinctNo} disabled={!purokId || purokId === NONE_OPTION_VALUE} onChange={setPrecinctNo} />
            </div>
            <div className="voter-registry-filter">
              <span>Sort order</span>
              <Select size="large" aria-label="Sort voter records" value={sortOpt} onChange={setSortOpt} options={[{ value: "updated_desc", label: "Recently updated" }, { value: "barangay_asc", label: "Barangay A-Z" }, { value: "purok_asc", label: "Purok A-Z" }, { value: "precinct_asc", label: "Precinct A-Z" }]} />
            </div>
          </div>
        </section>

        <div className="voter-registry-results-heading">
          <div><AuditOutlined /><span>Masterlist records</span></div>
          <p>{voters.length.toLocaleString()} loaded · {filteredCount.toLocaleString()} matching</p>
        </div>

        {loading ? (
          <div className="voter-registry-list">{Array.from({ length: 3 }).map((_, i) => <Card className="voter-record-skeleton" key={i}><Skeleton active avatar paragraph={{ rows: 3 }} /></Card>)}</div>
        ) : voters.length === 0 ? (
          <Card className="voter-registry-empty"><Empty description="No voter records match the current filters." /></Card>
        ) : (
          <section className="voter-registry-list" aria-label="Voter masterlist records">
            {voters.map((r) => {
              const open = !!expanded[r.recipient_id];
              const active = isActive(r?.status);
              const precinct = toUpperText(r?.precinct_no) || "UNASSIGNED";
              const barangayLabel = getBarangayLabel(r);
              const purokLabel = getPurokLabel(r);
              const qrValue = voterQrValue(r, barangayLabel, purokLabel);
              return (
                <article className={`voter-record${open ? " voter-record--expanded" : ""}`} key={r.recipient_id}>
                  <div className="voter-record-accent" />
                  <header className="voter-record-header">
                    <div className="voter-record-identity">
                      {imageUrl(r) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl(r)} alt={fullName(r)} className="voter-record-portrait" />
                      ) : (
                        <div className="voter-record-portrait voter-record-portrait--initials" aria-hidden="true">{voterInitials(r)}</div>
                      )}
                      <div className="voter-record-name-block">
                        <div className="voter-record-meta-line">
                          <span>Voter record #{String(r.recipient_id).padStart(6, "0")}</span>
                          <span className={`voter-record-status ${active ? "voter-record-status--active" : "voter-record-status--inactive"}`}>{statusLabel(r?.status)}</span>
                        </div>
                        <h2>{fullName(r)}</h2>
                        <p><IdcardOutlined /> Voter ID: <strong>{displayValue(toUpperText(r?.voters_id_number), "Not assigned")}</strong></p>
                      </div>
                    </div>
                    <div className="voter-record-actions">
                      <Button aria-expanded={open} icon={open ? <UpOutlined /> : <DownOutlined />} onClick={() => setExpanded((p) => ({ ...p, [r.recipient_id]: !p[r.recipient_id] }))}>{open ? "Less details" : "View details"}</Button>
                       <Button icon={<EditOutlined />} disabled={!canEditGeo} onClick={() => openEdit(r)}>Edit</Button>
                       {canDeleteGeo ? (
                         <Popconfirm title="Delete this voter?" description="This action cannot be undone." onConfirm={() => remove(r.recipient_id)}>
                           <Button danger icon={<DeleteOutlined />} disabled={deletingId === r.recipient_id} loading={deletingId === r.recipient_id}>Delete</Button>
                         </Popconfirm>
                       ) : null}
                    </div>
                  </header>

                  <div className="voter-record-primary">
                    <dl className="voter-record-facts">
                      <div className="voter-record-fact--precinct"><dt>Assigned precinct</dt><dd>{precinct}</dd></div>
                      <div><dt>Barangay</dt><dd>{displayValue(toUpperText(barangayLabel))}</dd></div>
                      <div><dt>Purok / Sitio</dt><dd>{displayValue(toUpperText(purokLabel))}</dd></div>
                      <div><dt>Date of birth</dt><dd>{displayValue(fmtDate(r?.birthdate))}</dd></div>
                      <div><dt>Sex</dt><dd>{displayValue(toProperText(r?.sex))}</dd></div>
                    </dl>
                  </div>

                  {open ? (
                    <section className="voter-record-details" aria-label={`Supplementary information for ${fullName(r)}`}>
                      <div className="voter-record-details-content">
                        <div>
                          <div className="voter-record-details-heading">
                            <h3>Supplementary voter information</h3>
                            <span>Demographic and contact details</span>
                          </div>
                          <dl>
                            <div><dt>Marital status</dt><dd>{displayValue(toProperText(r?.marital_status))}</dd></div>
                            <div><dt>Occupation</dt><dd>{displayValue(toProperText(r?.occupation))}</dd></div>
                            <div><dt>Phone number</dt><dd>{displayValue(r?.phone_number)}</dd></div>
                            <div><dt>Religion</dt><dd>{displayValue(toProperText(r?.religion))}</dd></div>
                            <div><dt>Tribe</dt><dd>{displayValue(toProperText(r?.tribe_name || r?.tribe))}</dd></div>
                            <div><dt>Created</dt><dd>{displayValue(fmtDateTime(r?.created_at))}</dd></div>
                            <div><dt>Last updated</dt><dd>{displayValue(fmtDateTime(r?.updated_at))}</dd></div>
                          </dl>
                        </div>
                        <aside className="voter-record-qr" aria-label={`Downloadable QR for ${fullName(r)}`}>
                          <div className="voter-record-qr-heading"><QrcodeOutlined /><span>Registry QR</span></div>
                          <div className="voter-record-qr-code">
                            <QRCode id={`voter-qr-${r.recipient_id}`} value={qrValue} size={112} level="M" bgColor="#ffffff" fgColor="#071f3c" />
                          </div>
                          <p>Record #{String(r.recipient_id).padStart(6, "0")} · Precinct {precinct}</p>
                          <Button block icon={<DownloadOutlined />} onClick={() => downloadVoterQr(r)}>Download QR</Button>
                        </aside>
                      </div>
                    </section>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}

        <div ref={sentinelRef} className="voter-registry-sentinel" />
        {loadingMore ? <div className="voter-registry-loading"><Spin size="small" /><span>Loading more voter records...</span></div> : null}
        {!loading && voters.length > 0 && !hasMore ? <p className="voter-registry-end">End of registry results</p> : null}
      </main>

      <Modal
        title={(
          <div className="voter-form-modal-title">
            <span className="voter-form-modal-title__icon"><IdcardOutlined /></span>
            <div>
              <strong>{editing?.recipient_id ? "Edit Voter" : "Add Voter"}</strong>
              <span>{editing?.recipient_id ? "Update the voter registry information" : "Register a voter in the municipal masterlist"}</span>
            </div>
          </div>
        )}
        open={modalOpen}
        width={1180}
        centered
        className="voter-form-modal"
        wrapClassName="voter-form-modal-wrap"
        maskClosable={!submitting}
        onCancel={() => { setModalOpen(false); resetModal(); }}
        onOk={() => form.submit()}
        okText={editing?.recipient_id ? "Update" : "Save"}
        okButtonProps={{ disabled: editing?.recipient_id ? !canEditGeo : !canManageGeo, loading: submitting }}
        cancelButtonProps={{ disabled: submitting }}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="voter-form">
          <section className="voter-form-section">
            <div className="voter-form-section__heading">
              <div>
                <strong>Registry assignment</strong>
                <span>Official voting location and registry reference</span>
              </div>
            </div>
            <div className="voter-form-grid voter-form-grid--two">
              <Form.Item label="Precinct" name="precinct_no"><Input maxLength={100} /></Form.Item>
              <Form.Item label="Voter's ID Number" name="voters_id_number"><Input maxLength={120} /></Form.Item>
              <Form.Item label="Barangay" name="barangay_id" rules={[{ required: true, message: "Barangay is required." }]}>
                <Select
                  allowClear
                  showSearch
                  options={formBarangayOptions}
                  optionFilterProp="label"
                  onChange={async (v) => {
                    form.setFieldValue("purok_id", undefined);
                    if (!v || v === NONE_OPTION_VALUE) {
                      setFormPuroks([]);
                      return;
                    }
                    await loadPuroks(v, "form");
                  }}
                />
              </Form.Item>
              <Form.Item label="Purok" name="purok_id">
                <Select
                  allowClear
                  showSearch
                  disabled={!formBarangayId || formBarangayId === NONE_OPTION_VALUE}
                  options={formPurokOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
            </div>
          </section>

          <section className="voter-form-section">
            <div className="voter-form-section__heading">
              <div>
                <strong>Personal information</strong>
                <span>Legal name and contact details</span>
              </div>
            </div>
            <div className="voter-form-grid voter-form-grid--names">
              <Form.Item label="First Name" name="first_name" rules={[{ required: true, message: "First name is required." }]}><Input maxLength={150} /></Form.Item>
              <Form.Item label="Middle Name" name="middle_name"><Input maxLength={150} /></Form.Item>
              <Form.Item label="Last Name" name="last_name" rules={[{ required: true, message: "Last name is required." }]}><Input maxLength={150} /></Form.Item>
            </div>
            <div className="voter-form-grid voter-form-grid--four">
              <Form.Item label="Extension" name="extension"><Input maxLength={50} /></Form.Item>
              <Form.Item label="Birthdate" name="birthdate"><Input type="date" /></Form.Item>
              <Form.Item label="Occupation" name="occupation"><Input maxLength={200} /></Form.Item>
              <Form.Item label="Marital Status" name="marital_status"><Select allowClear options={[{ value: "SINGLE", label: "Single" }, { value: "MARRIED", label: "Married" }, { value: "WIDOWED", label: "Widowed" }, { value: "SEPARATED", label: "Separated" }]} /></Form.Item>
            </div>
            <div className="voter-form-grid voter-form-grid--one">
              <Form.Item label="Phone Number" name="phone_number"><Input maxLength={50} /></Form.Item>
            </div>
          </section>

          <section className="voter-form-section">
            <div className="voter-form-section__heading">
              <div>
                <strong>Demographic classification</strong>
                <span>Profile classifications used in voter records</span>
              </div>
            </div>
            <div className="voter-form-grid voter-form-grid--four">
              <Form.Item label="Religion" name="religion"><Select showSearch options={religionOptions} optionFilterProp="label" /></Form.Item>
              <Form.Item label="Tribe" name="tribe_id"><Select allowClear showSearch options={tribeOptions} optionFilterProp="label" /></Form.Item>
              <Form.Item label="Sex" name="sex"><Select allowClear options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }]} /></Form.Item>
              <Form.Item label="Status" name="status" initialValue="ACTIVE"><Select options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} /></Form.Item>
            </div>
          </section>

          <section className="voter-form-section voter-form-section--picture">
            <div className="voter-form-section__heading">
              <div>
                <strong>Voter picture</strong>
                <span>Add a clear identification photo</span>
              </div>
            </div>
            <Form.Item>
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
          </section>
        </Form>
      </Modal>

      <ToastContainer />
    </Layout>
  );
}
