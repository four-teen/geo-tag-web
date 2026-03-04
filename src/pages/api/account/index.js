import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getAccountOptions() {
  return axios.get(buildApiUrl("/admin/accounts/options"), {
    headers: authHeaders(),
  });
}

export async function getAccounts() {
  return axios.get(buildApiUrl("/admin/accounts"), {
    headers: authHeaders(),
  });
}

export async function createAccount(formData) {
  return axios.post(buildApiUrl("/admin/accounts"), formData, {
    headers: authHeaders(),
  });
}

export async function updateAccount(id, formData) {
  if (typeof formData?.append === "function") {
    formData.append("_method", "PUT");
  }

  return axios.post(buildApiUrl(`/admin/accounts/${id}`), formData, {
    headers: authHeaders(),
  });
}

export async function deleteAccount(id) {
  return axios.delete(buildApiUrl(`/admin/accounts/${id}`), {
    headers: authHeaders(),
  });
}
