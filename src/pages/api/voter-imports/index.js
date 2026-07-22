import axios from "axios";
import Cookies from "js-cookie";
import { buildApiUrl } from "../../../utils/api";

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${Cookies.get("accessToken")}`,
    ...extra,
  };
}

export function GetVoterImports(params = {}) {
  return axios.get(buildApiUrl("/bow/voter-imports"), { headers: authHeaders(), params });
}

export function PreviewVoterImport(file, targetBarangayId) {
  const formData = new FormData();
  formData.append("file", file);
  if (targetBarangayId) formData.append("target_barangay_id", targetBarangayId);

  return axios.post(buildApiUrl("/bow/voter-imports/preview"), formData, {
    headers: authHeaders({ "Content-Type": "multipart/form-data" }),
  });
}

export function GetVoterImport(id) {
  return axios.get(buildApiUrl(`/bow/voter-imports/${id}`), { headers: authHeaders() });
}

export function GetVoterImportRows(id, params = {}) {
  return axios.get(buildApiUrl(`/bow/voter-imports/${id}/rows`), {
    headers: authHeaders(),
    params,
  });
}

export function SaveVoterImportMappings(id, mappings) {
  return axios.put(buildApiUrl(`/bow/voter-imports/${id}/mappings`), { mappings }, {
    headers: authHeaders(),
  });
}

export function AutoResolveVoterImport(id) {
  return axios.post(buildApiUrl(`/bow/voter-imports/${id}/auto-resolve`), {}, {
    headers: authHeaders(),
  });
}

export function GetVoterImportCommitProgress(progressToken) {
  return axios.get(buildApiUrl(`/bow/voter-imports/commit-progress/${progressToken}`), {
    headers: authHeaders(),
  });
}

export function CommitVoterImport(id, mode, confirmation, progressToken) {
  return axios.post(buildApiUrl(`/bow/voter-imports/${id}/commit`), {
    mode,
    confirmation,
    progress_token: progressToken,
  }, {
    headers: authHeaders(),
  });
}

export function DeleteVoterImport(id) {
  return axios.delete(buildApiUrl(`/bow/voter-imports/${id}`), { headers: authHeaders() });
}

export function DeleteBarangayVoterImports(id, confirmation) {
  return axios.delete(buildApiUrl(`/bow/voter-imports/${id}/barangay`), {
    headers: authHeaders(),
    data: { confirmation },
  });
}
