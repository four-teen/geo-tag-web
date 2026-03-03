/**
 * ============================================================================
 * BOTIKA ON WHEELS – FRONTEND API WRAPPER (BARANGAY)
 * ----------------------------------------------------------------------------
 * File        : /src/pages/api/barangay/index.js
 * Platform    : Next.js (frontend) -> Laravel API (backend)
 *
 * IMPORTANT:
 * - This is an axios wrapper (NOT a Next.js API route handler)
 * - Uses NEXT_PUBLIC_API_URL
 * - Uses Bearer token from Cookies: accessToken
 * ============================================================================
 */

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

export async function GetBarangays() {
  // GET /bow/barangay
  return axios.get(buildApiUrl("/bow/barangay"), {
    headers: authHeaders(),
  });
}

export async function postBarangay(body) {
  // POST /bow/barangay
  return axios.post(buildApiUrl("/bow/barangay"), body, {
    headers: authHeaders(),
  });
}

export async function updateBarangay(id, body) {
  // PUT /bow/barangay/{id}
  return axios.put(buildApiUrl(`/bow/barangay/${id}`), body, {
    headers: authHeaders(),
  });
}

export async function deleteBarangay(id) {
  // DELETE /bow/barangay/{id}
  return axios.delete(buildApiUrl(`/bow/barangay/${id}`), {
    headers: authHeaders(),
  });
}
