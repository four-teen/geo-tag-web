import axios from "axios";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function GetPrecinctsByPurok(purokId) {
  return axios.get(`${API_BASE}/bow/precinct/by-purok/${purokId}`, {
    headers: authHeaders(),
  });
}

export async function postPrecinct(body) {
  return axios.post(`${API_BASE}/bow/precinct`, body, {
    headers: authHeaders(),
  });
}

export async function updatePrecinct(id, body) {
  return axios.put(`${API_BASE}/bow/precinct/${id}`, body, {
    headers: authHeaders(),
  });
}

export async function deletePrecinct(id) {
  return axios.delete(`${API_BASE}/bow/precinct/${id}`, {
    headers: authHeaders(),
  });
}
