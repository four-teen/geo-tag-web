import Cookies from "js-cookie";
import { canAccessRoute, getDefaultLandingPath } from "../../../utils/access";



export async function Auth(route) {
  const token = Cookies.get("accessToken");
  const defaultPath = getDefaultLandingPath();

  if (!token) {
    return route ? "/" : "";
  }

  if (route && !canAccessRoute(route)) {
    return defaultPath;
  }

  if (route) {
    return route;
  }

  return defaultPath.replace(/^\//, "");

}
