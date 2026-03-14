import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
}

function resolveAccountBase(scope = "admin") {
  return scope === "staff" ? "/staff/accounts" : "/admin/accounts";
}

export async function getAccountOptions(scope = "admin") {
  return axios.get(buildApiUrl(`${resolveAccountBase(scope)}/options`), {
    headers: authHeaders(),
  });
}

export async function getAccounts(scope = "admin") {
  return axios.get(buildApiUrl(resolveAccountBase(scope)), {
    headers: authHeaders(),
  });
}

export async function createAccount(formData, scope = "admin") {
  return axios.post(buildApiUrl(resolveAccountBase(scope)), formData, {
    headers: authHeaders(),
  });
}

export async function updateAccount(id, formData, scope = "admin") {
  if (typeof formData?.append === "function") {
    formData.append("_method", "PUT");
  }

  return axios.post(buildApiUrl(`${resolveAccountBase(scope)}/${id}`), formData, {
    headers: authHeaders(),
  });
}

export async function deleteAccount(id, scope = "admin") {
  return axios.delete(buildApiUrl(`${resolveAccountBase(scope)}/${id}`), {
    headers: authHeaders(),
  });
}

export async function disableAccount(id, scope = "staff") {
  return axios.patch(buildApiUrl(`${resolveAccountBase(scope)}/${id}/disable`), {}, {
    headers: authHeaders(),
  });
}
