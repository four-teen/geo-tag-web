import Cookies from "js-cookie";
import {
  canAccessRoute,
  getDefaultLandingPath,
  isPasswordChangeRequired,
} from "../../../utils/access";



export async function Auth(route) {
  const token = Cookies.get("accessToken");
  const defaultPath = getDefaultLandingPath();

  if (!token) {
    return route ? "/" : "";
  }

  if (isPasswordChangeRequired()) {
    return route === "/change-password" ? route : "/change-password";
  }

  if (route === "/change-password") {
    return defaultPath;
  }

  if (route && !canAccessRoute(route)) {
    return defaultPath;
  }

  if (route) {
    return route;
  }

  return defaultPath.replace(/^\//, "");

}
