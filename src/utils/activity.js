import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "./api";
import { USER_ROLES } from "./access";

const STAFF_ACTIVITY_ROLES = [USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR];
let lastPagePath = "";
let lastPageLoggedAt = 0;

function normalizePagePath(value = "") {
  const raw = String(value || "").split("?")[0].split("#")[0];
  const normalized = "/" + raw.replace(/^\/+|\/+$/g, "");
  return normalized === "/" ? "/" : normalized;
}

function canRecordStaffActivity() {
  return STAFF_ACTIVITY_ROLES.includes(Cookies.get("role"));
}

async function sendStaffActivity(payload, keepalive = false) {
  const token = Cookies.get("accessToken");
  if (!token || !canRecordStaffActivity() || typeof window === "undefined") return;

  try {
    await fetch(buildApiUrl("/staff/activity"), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive,
    });
  } catch (_error) {
    // Activity logging must never interrupt staff work.
  }
}

export function logStaffPageView(pathname) {
  const pagePath = normalizePagePath(pathname);
  const now = Date.now();

  if (pagePath === lastPagePath && now - lastPageLoggedAt < 1500) return;
  lastPagePath = pagePath;
  lastPageLoggedAt = now;

  void sendStaffActivity({
    event_type: "PAGE_VIEW",
    page_path: pagePath,
  });
}

export function logStaffAction(actionCode, { entityId = null, pagePath = "" } = {}) {
  if (typeof window === "undefined") return;

  void sendStaffActivity({
    event_type: "ACTION",
    action_code: actionCode,
    entity_id: entityId === undefined || entityId === null ? null : String(entityId),
    page_path: normalizePagePath(pagePath || window.location.pathname),
  });
}

export function installStaffPageContext() {
  const interceptorId = axios.interceptors.request.use((config) => {
    if (typeof window === "undefined" || !canRecordStaffActivity()) return config;

    const headers = config.headers || {};
    if (typeof headers.set === "function") {
      headers.set("X-Page-Path", window.location.pathname);
    } else {
      headers["X-Page-Path"] = window.location.pathname;
    }
    config.headers = headers;
    return config;
  });

  return () => axios.interceptors.request.eject(interceptorId);
}
