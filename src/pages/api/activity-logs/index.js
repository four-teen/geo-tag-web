import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders() {
  return {
    Authorization: "Bearer " + Cookies.get("accessToken"),
  };
}

export async function getStaffActivityLogs(params = {}) {
  return axios.get(buildApiUrl("/admin/activity-logs"), {
    headers: authHeaders(),
    params,
  });
}
