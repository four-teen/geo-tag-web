export function getApiBaseUrl() {
  return String(process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

export function buildApiUrl(path = "") {
  const base = getApiBaseUrl();
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function extractApiErrorMessage(error, fallback = "Request failed.") {
  const status = error?.response?.status;
  const payloadMessage = error?.response?.data?.message;
  const payloadError = error?.response?.data?.error;
  const payloadValidation = error?.response?.data?.data;

  if (typeof payloadMessage === "string" && payloadMessage.trim()) {
    return payloadMessage;
  }

  if (typeof payloadError === "string" && payloadError.trim()) {
    return payloadError;
  }

  if (payloadValidation && typeof payloadValidation === "object") {
    const firstField = Object.keys(payloadValidation)[0];
    const firstEntry = firstField ? payloadValidation[firstField] : null;
    if (Array.isArray(firstEntry) && firstEntry[0]) {
      return String(firstEntry[0]);
    }
  }

  if (status === 401) return "Session expired. Please login again.";
  if (status === 403) return "You do not have permission to access this transaction.";
  if (status >= 500) return "Server error. Please check API server and database connection.";

  if (error?.message === "Network Error") {
    return "Cannot connect to API server. Check NEXT_PUBLIC_API_URL and backend status.";
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
