import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function GetRecipients(params = {}) {
  return axios.get(buildApiUrl("/bow/voters"), {
    headers: authHeaders(),
    params,
  });
}

export async function postRecipient(formData) {
  return axios.post(buildApiUrl("/bow/voters"), formData, {
    headers: authHeaders(),
  });
}

export async function updateRecipient(id, formData) {
  if (typeof formData?.append === "function") {
    formData.append("_method", "PUT");
  }

  return axios.post(buildApiUrl(`/bow/voters/${id}`), formData, {
    headers: authHeaders(),
  });
}

export async function deleteRecipient(id) {
  return axios.delete(buildApiUrl(`/bow/voters/${id}`), {
    headers: authHeaders(),
  });
}
