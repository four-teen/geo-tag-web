import Cookies from "js-cookie";

export const GEO_PERMISSIONS = {
  MANAGE_GEO: "bow.manage_geo",
  EDIT_GEO: "bow.edit_geo",
  VIEW_GEO: "bow.view_geo",
};

export const USER_ROLES = {
  ADMIN: "administrator",
  STAFF: "staff",
  VOTER_EDITOR: "voter_editor",
  MUNICIPAL_STAFF: "municipal_staff",
  VIEWER: "viewer",
};

const SESSION_COOKIE_KEYS = [
  "accessToken",
  "id",
  "username",
  "avatar_url",
  "designation",
  "role",
  "is_active",
  "can_delete",
  "must_change_password",
  "barangay_scope",
  "barangay_ids",
  "tokenApiUrl",
];

const ROUTE_ROLE_ACCESS = {
  '/reports': [USER_ROLES.ADMIN],
  "/dashboard": [USER_ROLES.ADMIN],
  "/staff/dashboard": [USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR],
  "/municipal/dashboard": [USER_ROLES.MUNICIPAL_STAFF],
  "/viewer/dashboard": [USER_ROLES.VIEWER],
  "/barangays": [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  "/religions": [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  "/tribes": [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  "/voters": [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  "/recipients": [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  "/voter-imports": [USER_ROLES.ADMIN],
  "/account": [USER_ROLES.ADMIN],
  "/activity-logs": [USER_ROLES.ADMIN],
};

export function getUserRole() {
  return Cookies.get("role") || USER_ROLES.STAFF;
}

export function getRoleLabel(role = "") {
  const normalized = String(role || "").trim();

  if (normalized === USER_ROLES.ADMIN) return "Administrator";
  if (normalized === USER_ROLES.STAFF) return "Staff";
  if (normalized === USER_ROLES.VOTER_EDITOR) return "Voter Records Editor";
  if (normalized === USER_ROLES.MUNICIPAL_STAFF) return "Municipal Staff";
  if (normalized === USER_ROLES.VIEWER) return "Viewer";
  return "User";
}

export function isAdministrator() {
  return getUserRole() === USER_ROLES.ADMIN;
}

export function isStaff() {
  return getUserRole() === USER_ROLES.STAFF;
}

export function isVoterEditor() {
  return getUserRole() === USER_ROLES.VOTER_EDITOR;
}

export function isMunicipalStaff() {
  return getUserRole() === USER_ROLES.MUNICIPAL_STAFF;
}

export function isViewer() {
  return getUserRole() === USER_ROLES.VIEWER;
}

function canManageGeoByRole(role) {
  return [USER_ROLES.ADMIN, USER_ROLES.STAFF].includes(role);
}

function canEditGeoByRole(role) {
  return [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR].includes(role);
}

function canViewGeoByRole(role) {
  return [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER].includes(role);
}

export function canDeleteActions() {
  if (isAdministrator()) return true;
  if (isVoterEditor()) return false;

  const raw = String(Cookies.get("can_delete") || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function hasAnyPermission(codes = []) {
  const role = getUserRole();
  return codes.some((code) => {
    if (code === GEO_PERMISSIONS.MANAGE_GEO) return canManageGeoByRole(role);
    if (code === GEO_PERMISSIONS.EDIT_GEO) return canEditGeoByRole(role);
    if (code === GEO_PERMISSIONS.VIEW_GEO) return canViewGeoByRole(role);
    return false;
  });
}

export function getDefaultLandingPath() {
  const role = getUserRole();

  if (role === USER_ROLES.ADMIN) return "/dashboard";
  if (role === USER_ROLES.STAFF) return "/staff/dashboard";
  if (role === USER_ROLES.VOTER_EDITOR) return "/staff/dashboard";
  if (role === USER_ROLES.MUNICIPAL_STAFF) return "/municipal/dashboard";
  if (role === USER_ROLES.VIEWER) return "/viewer/dashboard";
  return "/staff/dashboard";
}

export function canAccessRoute(pathname = "") {
  if (!pathname || pathname === "/") return true;

  const baseRoute = pathname.split("?")[0];
  const allowedRoles = ROUTE_ROLE_ACCESS[baseRoute];

  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;

  return allowedRoles.includes(getUserRole());
}

export function filterMenuByAccess(menuItems = []) {
  const role = getUserRole();

  return menuItems.reduce((visibleItems, item) => {
    if (Array.isArray(item?.allowedRoles) && item.allowedRoles.length > 0) {
      if (!item.allowedRoles.includes(role)) return visibleItems;
    }

    if (item?.adminOnly && role !== USER_ROLES.ADMIN) return visibleItems;
    if (item?.staffOnly && role !== USER_ROLES.STAFF) return visibleItems;
    if (item?.municipalOnly && role !== USER_ROLES.MUNICIPAL_STAFF) return visibleItems;
    if (item?.viewerOnly && role !== USER_ROLES.VIEWER) return visibleItems;

    if (Array.isArray(item?.children)) {
      const children = filterMenuByAccess(item.children);
      if (children.length === 0) return visibleItems;

      visibleItems.push({
        ...item,
        children,
      });
      return visibleItems;
    }

    visibleItems.push(item);
    return visibleItems;
  }, []);
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
        "X-Page-Path": window.location.pathname,
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
