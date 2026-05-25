import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function GetReligions() {
  return axios.get(buildApiUrl("/bow/religions"), {
    headers: authHeaders(),
  });
}

export async function postReligion(body) {
  return axios.post(buildApiUrl("/bow/religions"), body, {
    headers: authHeaders(),
  });
}

export async function updateReligion(id, body) {
  return axios.put(buildApiUrl(`/bow/religions/${id}`), body, {
    headers: authHeaders(),
  });
}

export async function deleteReligion(id) {
  return axios.delete(buildApiUrl(`/bow/religions/${id}`), {
    headers: authHeaders(),
  });
}
