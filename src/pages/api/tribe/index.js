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

export async function GetTribes() {
  return axios.get(buildApiUrl("/bow/tribes"), {
    headers: authHeaders(),
  });
}

export async function postTribe(body) {
  return axios.post(buildApiUrl("/bow/tribes"), body, {
    headers: authHeaders(),
  });
}

export async function updateTribe(id, body) {
  return axios.put(buildApiUrl(`/bow/tribes/${id}`), body, {
    headers: authHeaders(),
  });
}

export async function deleteTribe(id) {
  return axios.delete(buildApiUrl(`/bow/tribes/${id}`), {
    headers: authHeaders(),
  });
}
