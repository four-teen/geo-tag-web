import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function GetVoterInsights(options = {}) {
  return axios.get(buildApiUrl("/bow/dashboard/voter-insights"), {
    headers: authHeaders(),
    params: options.compact ? { compact: 1 } : undefined,
  });
}
