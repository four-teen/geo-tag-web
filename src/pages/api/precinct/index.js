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

export async function GetPrecinctsByPurok(purokId) {
  return axios.get(buildApiUrl(`/bow/precinct/by-purok/${purokId}`), {
    headers: authHeaders(),
  });
}

export async function postPrecinct(body) {
  return axios.post(buildApiUrl("/bow/precinct"), body, {
    headers: authHeaders(),
  });
}

export async function updatePrecinct(id, body) {
  return axios.put(buildApiUrl(`/bow/precinct/${id}`), body, {
    headers: authHeaders(),
  });
}

export async function deletePrecinct(id) {
  return axios.delete(buildApiUrl(`/bow/precinct/${id}`), {
    headers: authHeaders(),
  });
}
