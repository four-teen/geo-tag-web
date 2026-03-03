import Cookies from "js-cookie";

export const GEO_PERMISSIONS = {
  MANAGE_GEO: "bow.manage_geo",
  VIEW_GEO: "bow.view_geo",
};

const SESSION_COOKIE_KEYS = [
  "accessToken",
  "id",
  "username",
  "avatar_url",
  "designation",
  "role",
  "is_active",
  "must_change_password",
  "barangay_scope",
  "permission_codes",
  "barangay_ids",
  "tokenApiUrl",
];

const ROUTE_PERMISSIONS = {
  "/dashboard": [GEO_PERMISSIONS.MANAGE_GEO, GEO_PERMISSIONS.VIEW_GEO],
  "/barangays": [GEO_PERMISSIONS.MANAGE_GEO, GEO_PERMISSIONS.VIEW_GEO],
  "/staff/dashboard": [GEO_PERMISSIONS.VIEW_GEO, GEO_PERMISSIONS.MANAGE_GEO],
};

function parseArrayCookie(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return String(value)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

export function getPermissionCodes() {
  return parseArrayCookie(Cookies.get("permission_codes"));
}

export function getUserRole() {
  return Cookies.get("role") || "staff";
}

export function isAdministrator() {
  return getUserRole() === "administrator";
}

export function isStaff() {
  return getUserRole() === "staff";
}

export function hasAnyPermission(codes = []) {
  if (isAdministrator()) return true;
  const owned = getPermissionCodes();
  return codes.some((code) => owned.includes(code));
}

export function getDefaultLandingPath() {
  return isAdministrator() ? "/dashboard" : "/staff/dashboard";
}

export function canAccessRoute(pathname = "") {
  if (!pathname || pathname === "/") return true;

  const baseRoute = pathname.split("?")[0];
  const required = ROUTE_PERMISSIONS[baseRoute];

  if (!required || required.length === 0) return true;

  return hasAnyPermission(required);
}

export function filterMenuByAccess(menuItems = []) {
  return menuItems.filter((item) => {
    if (item?.adminOnly && !isAdministrator()) return false;
    if (item?.staffOnly && !isStaff()) return false;

    if (Array.isArray(item?.requiredPermissions) && item.requiredPermissions.length > 0) {
      return hasAnyPermission(item.requiredPermissions);
    }

    return true;
  });
}

export function clearSessionCookies() {
  const apiUrl = Cookies.get("tokenApiUrl") || process.env.NEXT_PUBLIC_API_URL;
  const token = Cookies.get("accessToken");
  const userId = Cookies.get("id") || "guest";

  if (typeof window !== "undefined" && typeof fetch === "function" && apiUrl && token) {
    fetch(`${apiUrl}/admin/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      keepalive: true,
    }).catch(() => {});
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(`geoAvatar:${userId}`);
    window.dispatchEvent(new Event("geo-avatar-updated"));
  }

  SESSION_COOKIE_KEYS.forEach((key) => Cookies.remove(key));
}
