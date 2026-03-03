/**
 * ============================================================================
 * BOTIKA ON WHEELS – FRONTEND API WRAPPER (PUROK)
 * ----------------------------------------------------------------------------
 * File        : /src/pages/api/purok/index.js
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = Cookies.get("accessToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * NOTE:
 * This assumes your Laravel API supports filtering puroks by barangay_id via query:
 * GET /bow/purok?barangay_id=#
 *
 * If you instead implement:
 * GET /bow/purok/by-barangay/{barangay_id}
 * then adjust this function URL accordingly (we will keep it consistent later).
 */
export async function GetPuroksByBarangay(barangay_id) {
  return axios.get(
    `${API_BASE}/bow/purok/by-barangay/${barangay_id}`,
    {
      headers: authHeaders(),
    }
  );
}


export async function postPurok(body) {
  // POST /bow/purok
  return axios.post(`${API_BASE}/bow/purok`, body, {
    headers: authHeaders(),
  });
}

export async function updatePurok(id, body) {
  // PUT /bow/purok/{id}
  return axios.put(`${API_BASE}/bow/purok/${id}`, body, {
    headers: authHeaders(),
  });
}

export async function deletePurok(id) {
  // DELETE /bow/purok/{id}
  return axios.delete(`${API_BASE}/bow/purok/${id}`, {
    headers: authHeaders(),
  });
}
