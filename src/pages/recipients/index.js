import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
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
  EnvironmentOutlined,
  FilterOutlined,
  HomeOutlined,
  IdcardOutlined,
  PlusOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UpOutlined,
  UserAddOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import Layout from "../layouts";
import { Auth } from "../api/auth";
import { GetBarangays } from "../api/barangay";
import { GetPuroksByBarangay } from "../api/purok";
import { GetPrecinctsByPurok } from "../api/precinct";
import { GetRecipients, postRecipient, updateRecipient, deleteRecipient, getVoterHousehold, updateVoterHousehold } from "../api/recipients";
import { GetReligions } from "../api/religion";
import { GetTribes } from "../api/tribe";
import { canDeleteActions, GEO_PERMISSIONS, hasAnyPermission } from "../../utils/access";
import { extractApiErrorMessage, getApiBaseUrl } from "../../utils/api";
import { logStaffAction } from "../../utils/activity";

const PAGE_SIZE = 20;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const NONE_OPTION_VALUE = "__NONE__";
const BLANK_OPTION = { value: NONE_OPTION_VALUE, label: "Blank" };
const HOUSEHOLD_RELATIONSHIPS = [
  "Spouse / Partner",
  "Child",
  "Parent",
  "Sibling",
  "Grandchild",
  "Grandparent",
  "Relative",
  "Boarder / Tenant",
  "Other household member",
];

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
const statusLabel = (v) => (isActive(v) ? "KAPAMILYA" : "NON KAPAMILYA");
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

const storedImageUrl = (r, field) => {
  const absolute = String(r?.[`${field}_url`] || "").trim();
  if (absolute) return absolute;
  const raw = String(r?.[field] || "").trim();
  if (!raw) return "";
  if (/^(https?:\/\/|data:)/i.test(raw)) return raw;
  const root = String(getApiBaseUrl() || "").replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return root ? `${root}${raw.startsWith("/") ? raw : `/${raw}`}` : raw;
};
const imageUrl = (r) => storedImageUrl(r, "profile_picture");
const houseImageUrl = (r) => storedImageUrl(r, "house_picture");
const coordinateValue = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};
const hasCoordinateInput = (value) => coordinateValue(value) !== null;
const formatCoordinate = (value) => {
  const normalized = coordinateValue(value);
  return normalized === null ? "Not recorded" : normalized.toFixed(7);
};
const formatLocationAccuracy = (value) => {
  const normalized = coordinateValue(value);
  if (normalized === null) return "";
  if (normalized >= 1000) return `±${(normalized / 1000).toFixed(1)} km`;
  return `±${Math.round(normalized)} m`;
};
const voterMapUrl = (latitude, longitude) => {
  const lat = coordinateValue(latitude);
  const lng = coordinateValue(longitude);
  if (lat === null || lng === null) return "";
  const coordinateQuery = `${lat.toFixed(7)},${lng.toFixed(7)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateQuery)}`;
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
  const formLatitude = Form.useWatch("latitude", form);
  const formLongitude = Form.useWatch("longitude", form);
  const formResidenceMapUrl = voterMapUrl(formLatitude, formLongitude);
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
  const [registryResolved, setRegistryResolved] = useState(false);
  const [registryLoadError, setRegistryLoadError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [selectedHousePhoto, setSelectedHousePhoto] = useState(null);
  const [housePhotoPreview, setHousePhotoPreview] = useState("");
  const [removeHousePhoto, setRemoveHousePhoto] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMeta, setLocationMeta] = useState({ accuracy: null, capturedAt: null });
  const [expanded, setExpanded] = useState({});
  const [households, setHouseholds] = useState({});
  const [loadedHouseholds, setLoadedHouseholds] = useState({});
  const [loadingHouseholds, setLoadingHouseholds] = useState({});
  const [householdModalOpen, setHouseholdModalOpen] = useState(false);
  const [householdVoter, setHouseholdVoter] = useState(null);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [householdCandidates, setHouseholdCandidates] = useState([]);
  const [savingHousehold, setSavingHousehold] = useState(false);

  const sentinelRef = useRef(null);
  const queryRef = useRef("");
  const geolocationRequestRef = useRef(0);

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
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadingMore(false);
      setRegistryResolved(false);
      setRegistryLoadError("");
    }
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
      if (!append) setRegistryResolved(true);
    } catch (e) {
      const message = extractApiErrorMessage(e, append ? "Failed to load more voter records." : "Failed to load the voter masterlist.");
      if (!append && q === queryRef.current) {
        setVoters([]);
        setFilteredCount(0);
        setTotalCount(0);
        setPage(0);
        setHasMore(false);
        setRegistryResolved(false);
        setRegistryLoadError(message);
      }
      if (!unauthorized(e)) toast.error(message);
    } finally {
      if (q === queryRef.current) {
        append ? setLoadingMore(false) : setLoading(false);
      }
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
    geolocationRequestRef.current += 1;
    form.resetFields();
    form.setFieldsValue({ religion: NONE_OPTION_VALUE, status: "ACTIVE", tribe_id: NONE_OPTION_VALUE });
    setFormPuroks([]);
    setEditing(null);
    setSelectedPhoto(null);
    setPhotoPreview("");
    setRemovePhoto(false);
    setSelectedHousePhoto(null);
    setHousePhotoPreview("");
    setRemoveHousePhoto(false);
    setLocating(false);
    setLocationMeta({ accuracy: null, capturedAt: null });
  };

  const openCreate = () => {
    resetModal();
    setModalOpen(true);
    logStaffAction("OPEN_CREATE_VOTER_FORM");
  };

  const openEdit = async (r) => {
    logStaffAction("OPEN_VOTER_EDIT", { entityId: r?.recipient_id });
    resetModal();
    setEditing(r);
    setPhotoPreview(imageUrl(r));
    setHousePhotoPreview(houseImageUrl(r));
    setLocationMeta({
      accuracy: coordinateValue(r?.location_accuracy_meters),
      capturedAt: r?.location_captured_at || null,
    });
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
      latitude: coordinateValue(r?.latitude),
      longitude: coordinateValue(r?.longitude),
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

  const onHousePhotoPick = async (file) => {
    if (!file.type?.startsWith("image/")) return Upload.LIST_IGNORE;
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image is too large. Maximum size is 2MB.");
      return Upload.LIST_IGNORE;
    }
    setSelectedHousePhoto(file);
    setRemoveHousePhoto(false);
    const reader = new FileReader();
    reader.onload = () => setHousePhotoPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
    return false;
  };

  const clearHousePhoto = () => { setSelectedHousePhoto(null); setHousePhotoPreview(""); setRemoveHousePhoto(true); };

  const clearLocationMetadata = () => {
    setLocationMeta({ accuracy: null, capturedAt: null });
  };

  const clearResidenceLocation = () => {
    geolocationRequestRef.current += 1;
    setLocating(false);
    form.setFieldsValue({ latitude: null, longitude: null });
    form.setFields([
      { name: "latitude", errors: [] },
      { name: "longitude", errors: [] },
    ]);
    clearLocationMetadata();
  };

  const captureCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location services are not supported by this browser.");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error("Current location requires HTTPS or localhost.");
      return;
    }

    const requestId = geolocationRequestRef.current + 1;
    geolocationRequestRef.current = requestId;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (geolocationRequestRef.current !== requestId) return;
        const latitude = Number(position.coords.latitude.toFixed(7));
        const longitude = Number(position.coords.longitude.toFixed(7));
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? Number(Math.max(0, position.coords.accuracy).toFixed(2))
          : null;
        const capturedAt = new Date(position.timestamp || Date.now()).toISOString();

        form.setFieldsValue({ latitude, longitude });
        form.setFields([
          { name: "latitude", errors: [] },
          { name: "longitude", errors: [] },
        ]);
        setLocationMeta({ accuracy, capturedAt });
        setLocating(false);
        toast.success(`Residence location captured${accuracy === null ? "" : ` (${formatLocationAccuracy(accuracy)})`}.`);
      },
      (error) => {
        if (geolocationRequestRef.current !== requestId) return;
        setLocating(false);
        const messages = {
          1: "Location permission was denied. Allow location access and try again.",
          2: "Your current location could not be determined.",
          3: "Getting the current location timed out. Please try again.",
        };
        toast.error(messages[error?.code] || "Unable to get the current location.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

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
    const latitude = coordinateValue(vals?.latitude);
    const longitude = coordinateValue(vals?.longitude);
    if ((latitude === null) !== (longitude === null)) {
      const message = "Latitude and longitude must be entered together.";
      form.setFields([
        { name: "latitude", errors: [message] },
        { name: "longitude", errors: [message] },
      ]);
      return;
    }
    if (latitude !== null && longitude !== null) {
      fd.append("latitude", String(latitude));
      fd.append("longitude", String(longitude));
      if (coordinateValue(locationMeta.accuracy) !== null) {
        fd.append("location_accuracy_meters", String(locationMeta.accuracy));
      }
      if (locationMeta.capturedAt) {
        fd.append("location_captured_at", locationMeta.capturedAt);
      }
    } else if (editing?.recipient_id && voterMapUrl(editing?.latitude, editing?.longitude)) {
      fd.append("remove_location", "1");
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
    if (selectedHousePhoto) fd.append("house_picture", selectedHousePhoto);
    if (removeHousePhoto) fd.append("remove_house_picture", "1");
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

  const loadHousehold = useCallback(async (id) => {
    setLoadingHouseholds((current) => ({ ...current, [id]: true }));
    try {
      const response = await getVoterHousehold(id);
      const household = response?.data?.data || null;
      setHouseholds((current) => ({ ...current, [id]: household }));
      setLoadedHouseholds((current) => ({ ...current, [id]: true }));
      return household;
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to load household."));
      return null;
    } finally {
      setLoadingHouseholds((current) => ({ ...current, [id]: false }));
    }
  }, [unauthorized]);

  const toggleVoterDetails = async (record) => {
    const isOpening = !expanded[record.recipient_id];
    setExpanded((current) => ({ ...current, [record.recipient_id]: isOpening }));
    if (isOpening) {
      logStaffAction("VIEW_VOTER_DETAILS", { entityId: record.recipient_id });
    }
    if (isOpening && !loadedHouseholds[record.recipient_id]) {
      await loadHousehold(record.recipient_id);
    }
  };

  const openHouseholdManager = async (record) => {
    const household = loadedHouseholds[record.recipient_id]
      ? households[record.recipient_id]
      : await loadHousehold(record.recipient_id);
    const members = household?.members?.length
      ? household.members
      : [{ ...record, relationship_to_head: "Household head", is_head: true }];

    setHouseholdVoter(record);
    setHouseholdMembers(members);
    setHouseholdCandidates([]);
    setHouseholdModalOpen(true);
    logStaffAction("OPEN_HOUSEHOLD_MANAGER", { entityId: record.recipient_id });
  };

  const searchHouseholdVoters = async (value) => {
    const keyword = String(value || "").trim();
    if (keyword.length < 2) {
      setHouseholdCandidates([]);
      return;
    }

    try {
      const response = await GetRecipients({ search: keyword, page: 1, per_page: 20 });
      const memberIds = new Set(householdMembers.map((member) => Number(member.recipient_id)));
      const candidates = (response?.data?.data || []).filter((candidate) => !memberIds.has(Number(candidate.recipient_id)));
      setHouseholdCandidates(candidates);
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Failed to search voter records."));
    }
  };

  const addHouseholdMember = (recipientId) => {
    const candidate = householdCandidates.find((item) => Number(item.recipient_id) === Number(recipientId));
    if (!candidate) return;
    setHouseholdMembers((current) => [...current, {
      ...candidate,
      relationship_to_head: "Relative",
      is_head: false,
    }]);
    setHouseholdCandidates([]);
  };

  const updateHouseholdRelationship = (recipientId, relationship) => {
    setHouseholdMembers((current) => current.map((member) => (
      Number(member.recipient_id) === Number(recipientId)
        ? { ...member, relationship_to_head: relationship }
        : member
    )));
  };

  const removeHouseholdMember = (recipientId) => {
    setHouseholdMembers((current) => current.filter((member) => Number(member.recipient_id) !== Number(recipientId)));
  };

  const saveHousehold = async () => {
    if (!householdVoter) return;
    try {
      setSavingHousehold(true);
      const response = await updateVoterHousehold(householdVoter.recipient_id, householdMembers.map((member) => ({
        recipient_id: member.recipient_id,
        relationship_to_head: member.relationship_to_head,
      })));
      const household = response?.data?.data || null;
      const affectedIds = new Set([
        ...householdMembers.map((member) => Number(member.recipient_id)),
        ...(household?.members || []).map((member) => Number(member.recipient_id)),
      ]);

      setHouseholds((current) => {
        const next = { ...current };
        affectedIds.forEach((id) => {
          next[id] = household?.members?.some((member) => Number(member.recipient_id) === id) ? household : null;
        });
        return next;
      });
      setLoadedHouseholds((current) => {
        const next = { ...current };
        affectedIds.forEach((id) => { next[id] = true; });
        return next;
      });
      setHouseholdModalOpen(false);
      toast.success("Household updated.");
    } catch (error) {
      if (!unauthorized(error)) toast.error(extractApiErrorMessage(error, "Saving household failed."));
    } finally {
      setSavingHousehold(false);
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
      logStaffAction("DOWNLOAD_VOTER_QR", { entityId: record.recipient_id });
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
              <span>{registryResolved ? "Matching records" : "Masterlist status"}</span>
              <strong>{registryLoadError ? "Needs retry" : registryResolved ? filteredCount.toLocaleString() : "Loading..."}</strong>
              <small>
                {registryLoadError
                  ? "The record count is not available yet"
                  : registryResolved
                    ? "of " + totalCount.toLocaleString() + " registered voters"
                    : "Checking registered voter records"}
              </small>
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
          <p>
            {registryLoadError
              ? "Masterlist loading was interrupted"
              : registryResolved
                ? voters.length.toLocaleString() + " loaded · " + filteredCount.toLocaleString() + " matching"
                : "Checking available voter records..."}
          </p>
        </div>

        {registryLoadError && !loading ? (
          <Card className="voter-registry-load-error">
            <div>
              <strong>We could not finish loading the voter masterlist.</strong>
              <span>{registryLoadError}</span>
              <small>No empty result is being shown because the record check did not finish.</small>
            </div>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchPage(1, false)}>
              Try loading again
            </Button>
          </Card>
        ) : !ready || loading || !registryResolved ? (
          <>
            <Card className="voter-registry-initial-loading" role="status" aria-live="polite">
              <div className="voter-registry-initial-loading__heading">
                <Spin size="small" />
                <div>
                  <strong>Checking for voter records</strong>
                  <span>Please wait while we confirm that masterlist records are available.</span>
                </div>
              </div>
              <div className="voter-registry-indeterminate-progress" aria-hidden="true"><span /></div>
              <p>Available records will appear immediately after this check finishes.</p>
            </Card>
            <div className="voter-registry-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card className="voter-record-skeleton" key={i}>
                  <Skeleton active avatar paragraph={{ rows: 3 }} />
                </Card>
              ))}
            </div>
          </>
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
              const housePhoto = houseImageUrl(r);
              const residenceMapUrl = voterMapUrl(r?.latitude, r?.longitude);
              const household = households[r.recipient_id];
              const householdLoaded = !!loadedHouseholds[r.recipient_id];
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
                      <Button aria-expanded={open} icon={open ? <UpOutlined /> : <DownOutlined />} onClick={() => toggleVoterDetails(r)}>{open ? "Less details" : "View details"}</Button>
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
                          <section className="voter-household" aria-label={"Household for " + fullName(r)}>
                            <div className="voter-household-heading">
                              <div><TeamOutlined /><strong>Household</strong></div>
                              {canEditGeo ? <Button size="small" icon={<UserAddOutlined />} onClick={() => openHouseholdManager(r)}>{household?.members?.length ? "Manage household" : "Create household"}</Button> : null}
                            </div>
                            {loadingHouseholds[r.recipient_id] || !householdLoaded ? (
                              <span className="voter-household-note">Loading household members...</span>
                            ) : household?.members?.length ? (
                              <div className="voter-household-members">
                                {household.members.map((member) => (
                                  <div className="voter-household-member" key={member.recipient_id}>
                                    <span>{fullName(member)}</span>
                                    <small>{member.relationship_to_head}</small>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="voter-household-note">No household assigned yet.</span>
                            )}
                          </section>
                        </div>
                        <aside className="voter-record-sidecar">
                          <section className="voter-record-house-photo" aria-label={`House photo for ${fullName(r)}`}>
                            <div className="voter-record-sidecar-heading"><HomeOutlined /><span>Registered residence</span></div>
                            {housePhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={housePhoto} alt={`House of ${fullName(r)}`} />
                            ) : (
                              <div className="voter-record-house-photo__empty"><HomeOutlined /><span>No house photo recorded</span></div>
                            )}
                          </section>
                          <section className="voter-record-location" aria-label={`Residence location for ${fullName(r)}`}>
                            <div className="voter-record-sidecar-heading"><EnvironmentOutlined /><span>Residence location</span></div>
                            {residenceMapUrl ? (
                              <>
                                <dl>
                                  <div><dt>Latitude</dt><dd>{formatCoordinate(r?.latitude)}</dd></div>
                                  <div><dt>Longitude</dt><dd>{formatCoordinate(r?.longitude)}</dd></div>
                                </dl>
                                <p>
                                  {r?.location_accuracy_meters ? `GPS accuracy ${formatLocationAccuracy(r.location_accuracy_meters)}` : "Coordinates entered manually"}
                                  {r?.location_captured_at ? ` · ${fmtDateTime(r.location_captured_at)}` : ""}
                                </p>
                                <Button
                                  block
                                  icon={<EnvironmentOutlined />}
                                  href={residenceMapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => logStaffAction("OPEN_VOTER_MAP", { entityId: r.recipient_id })}
                                >
                                  View on map
                                </Button>
                              </>
                            ) : (
                              <div className="voter-record-location__empty"><EnvironmentOutlined /><span>No residence location recorded</span></div>
                            )}
                          </section>
                          <section className="voter-record-qr" aria-label={`Downloadable QR for ${fullName(r)}`}>
                          <div className="voter-record-qr-heading"><QrcodeOutlined /><span>Registry QR</span></div>
                          <div className="voter-record-qr-code">
                            <QRCode id={`voter-qr-${r.recipient_id}`} value={qrValue} size={112} level="M" bgColor="#ffffff" fgColor="#071f3c" />
                          </div>
                          <p>Record #{String(r.recipient_id).padStart(6, "0")} · Precinct {precinct}</p>
                          <Button block icon={<DownloadOutlined />} onClick={() => downloadVoterQr(r)}>Download QR</Button>
                          </section>
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
              <Form.Item label="Status" name="status" initialValue="ACTIVE"><Select options={[{ value: "ACTIVE", label: "KAPAMILYA" }, { value: "INACTIVE", label: "NON KAPAMILYA" }]} /></Form.Item>
            </div>
          </section>

          <section className="voter-form-section">
            <div className="voter-form-section__heading">
              <div>
                <strong>Residence location</strong>
                <span>Capture the voter&apos;s house position or enter coordinates manually</span>
              </div>
            </div>
            <div className="voter-form-location-card">
              <div className="voter-form-location-toolbar">
                <div>
                  <EnvironmentOutlined />
                  <div><strong>House coordinates</strong><span>For best accuracy, capture this while at the residence using a phone.</span></div>
                </div>
                <div className="voter-form-location-actions">
                  <Button className="voter-location-capture" type="primary" icon={<EnvironmentOutlined />} loading={locating} onClick={captureCurrentLocation}>Get current location</Button>
                  <Button disabled={!hasCoordinateInput(formLatitude) && !hasCoordinateInput(formLongitude) && !locating} onClick={clearResidenceLocation}>Clear</Button>
                </div>
              </div>
              <div className="voter-form-grid voter-form-grid--two voter-form-location-inputs">
                <Form.Item
                  label="Latitude"
                  name="latitude"
                  dependencies={["longitude"]}
                  rules={[
                    { type: "number", min: -90, max: 90, message: "Latitude must be between -90 and 90." },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (hasCoordinateInput(value) === hasCoordinateInput(getFieldValue("longitude"))) return Promise.resolve();
                        return Promise.reject(new Error("Enter both latitude and longitude."));
                      },
                    }),
                  ]}
                >
                  <InputNumber controls={false} precision={7} step={0.0000001} placeholder="e.g. 7.4475000" onChange={clearLocationMetadata} />
                </Form.Item>
                <Form.Item
                  label="Longitude"
                  name="longitude"
                  dependencies={["latitude"]}
                  rules={[
                    { type: "number", min: -180, max: 180, message: "Longitude must be between -180 and 180." },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (hasCoordinateInput(value) === hasCoordinateInput(getFieldValue("latitude"))) return Promise.resolve();
                        return Promise.reject(new Error("Enter both latitude and longitude."));
                      },
                    }),
                  ]}
                >
                  <InputNumber controls={false} precision={7} step={0.0000001} placeholder="e.g. 124.6733000" onChange={clearLocationMetadata} />
                </Form.Item>
              </div>
              {formResidenceMapUrl ? (
                <div className="voter-form-location-map-action">
                  <span className="voter-form-location-map-coordinates">
                    {formatCoordinate(formLatitude)}, {formatCoordinate(formLongitude)}
                  </span>
                  <Button
                    className="voter-location-map-button"
                    icon={<EnvironmentOutlined />}
                    href={formResidenceMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => logStaffAction("OPEN_FORM_COORDINATES_MAP", { entityId: editing?.recipient_id })}
                    aria-label={`Show coordinates ${formatCoordinate(formLatitude)}, ${formatCoordinate(formLongitude)} in Google Maps`}
                  >
                    Show exact location on Google Maps
                  </Button>
                </div>
              ) : null}
              <div className="voter-form-location-meta">
                <span>{locationMeta.capturedAt ? `Captured ${fmtDateTime(locationMeta.capturedAt)}` : "Coordinates may also be entered manually."}</span>
                {coordinateValue(locationMeta.accuracy) !== null ? <strong>GPS accuracy {formatLocationAccuracy(locationMeta.accuracy)}</strong> : null}
              </div>
              <p className="voter-form-location-privacy">Exact coordinates are kept in the authorized voter record and are not included in the QR code.</p>
            </div>
          </section>

          <section className="voter-form-section voter-form-section--picture">
            <div className="voter-form-section__heading">
              <div>
                <strong>Registry images</strong>
                <span>Add clear identification and residence photos</span>
              </div>
            </div>
            <div className="voter-form-photo-grid">
              <div className="voter-form-photo-card">
                <div className="voter-form-photo-card__heading">
                  <IdcardOutlined />
                  <div><strong>Voter picture</strong><span>Clear face and identification photo</span></div>
                </div>
                <Form.Item>
                  <Upload accept="image/*" beforeUpload={onPhotoPick} onRemove={() => { clearPhoto(); return true; }} maxCount={1} fileList={selectedPhoto ? [selectedPhoto] : []}>
                    <Button block icon={<UploadOutlined />}>Select voter picture</Button>
                  </Upload>
                </Form.Item>
                {photoPreview ? (
                  <div className="voter-form-photo-preview voter-form-photo-preview--profile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Voter preview" />
                    <Button danger size="small" onClick={clearPhoto}>Remove voter picture</Button>
                  </div>
                ) : (
                  <div className="voter-form-photo-empty voter-form-photo-empty--profile"><IdcardOutlined /><span>No voter picture selected</span></div>
                )}
              </div>

              <div className="voter-form-photo-card">
                <div className="voter-form-photo-card__heading">
                  <HomeOutlined />
                  <div><strong>House picture</strong><span>Front view of the voter&apos;s residence</span></div>
                </div>
                <Form.Item>
                  <Upload accept="image/*" beforeUpload={onHousePhotoPick} onRemove={() => { clearHousePhoto(); return true; }} maxCount={1} fileList={selectedHousePhoto ? [selectedHousePhoto] : []}>
                    <Button block icon={<UploadOutlined />}>Select house picture</Button>
                  </Upload>
                </Form.Item>
                {housePhotoPreview ? (
                  <div className="voter-form-photo-preview voter-form-photo-preview--house">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={housePhotoPreview} alt="House preview" />
                    <Button danger size="small" onClick={clearHousePhoto}>Remove house picture</Button>
                  </div>
                ) : (
                  <div className="voter-form-photo-empty voter-form-photo-empty--house"><HomeOutlined /><span>No house picture selected</span></div>
                )}
              </div>
            </div>
          </section>
        </Form>
      </Modal>

      <Modal
        title={householdVoter && households[householdVoter.recipient_id]?.household_id ? "Manage household" : "Create household"}
        open={householdModalOpen}
        width={720}
        centered
        className="household-modal"
        okText="Save household"
        confirmLoading={savingHousehold}
        onOk={saveHousehold}
        onCancel={() => { if (!savingHousehold) setHouseholdModalOpen(false); }}
      >
        <p className="household-modal-intro">Only voters already in the registry can be added. Each relationship is recorded against the household head.</p>
        <Select
          showSearch
          filterOption={false}
          value={undefined}
          onSearch={searchHouseholdVoters}
          onSelect={addHouseholdMember}
          placeholder="Search voter name or ID to add a member"
          notFoundContent="Type at least two characters to search voter records"
          options={householdCandidates.map((candidate) => ({
            value: candidate.recipient_id,
            label: fullName(candidate) + " · Record #" + String(candidate.recipient_id).padStart(6, "0"),
          }))}
          className="household-search"
        />
        <div className="household-editor-list">
          {householdMembers.map((member) => (
            <div className="household-editor-member" key={member.recipient_id}>
              <div>
                <strong>{fullName(member)}</strong>
                <span>Voter record #{String(member.recipient_id).padStart(6, "0")}</span>
              </div>
              {member.is_head ? (
                <span className="household-head-label">Household head</span>
              ) : (
                <div className="household-member-actions">
                  <Select
                    value={member.relationship_to_head || "Other household member"}
                    options={HOUSEHOLD_RELATIONSHIPS.map((relationship) => ({ value: relationship, label: relationship }))}
                    onChange={(relationship) => updateHouseholdRelationship(member.recipient_id, relationship)}
                  />
                  <Button danger type="text" onClick={() => removeHouseholdMember(member.recipient_id)}>Remove</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

    </Layout>
  );
}
