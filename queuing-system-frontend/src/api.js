const API_BASE = '/api';
const DEFAULT_TIMEOUT_MS = 15000;
const ANALYTICS_TIMEOUT_MS = 60000;
const KIOSK_TIMEOUT_MS = 8000;

function getHeaders(includeAuth = false) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (includeAuth) {
    const token = sessionStorage.getItem('token');
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJson(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  if (externalSignal) externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.message || data?.error || 'Request failed';
      const error = new Error(message);
      error.status = response.status;
      error.response = data;
      throw error;
    }

    if (options.method && !['GET', 'HEAD'].includes(options.method) && !/\/(login|logout|queue\/verify-security)$/.test(url)) {
      window.dispatchEvent(new Event('queue-data-changed'));
      try { localStorage.setItem('queue-data-changed', `${Date.now()}-${Math.random()}`); } catch { /* Storage may be disabled. */ }
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (!timedOut) throw error;
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromExternalSignal);
  }
}

// ─── Auth ────────────────────────────────────────────
export async function login(username, password) {
  return fetchJson(`${API_BASE}/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  const res = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    headers: getHeaders(true),
  });
  return res.json();
}

export async function logoutStaff() {
  return fetchJson(`${API_BASE}/logout`, { method: 'POST', headers: getHeaders(true) });
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: getHeaders(true),
  });
  return res.json();
}

// ─── Queue (Public) ──────────────────────────────────
export async function generateTicket(serviceType, priorityType = null, securityCode = null, window = null, signal = null) {
  const requestSignal = signal || (typeof serviceType === 'object' ? serviceType.signal : null);
  const body = typeof serviceType === 'object' && serviceType !== null
    ? {
        service_type: serviceType.service_type,
        ...(serviceType.priority_type != null ? { priority_type: serviceType.priority_type } : {}),
        ...(serviceType.security_code ? { security_code: serviceType.security_code } : {}),
        ...(serviceType.window ? { window: serviceType.window } : {}),
        ...(serviceType.transaction_type ? { transaction_type: serviceType.transaction_type } : {}),
        ...(serviceType.student_number ? { student_number: serviceType.student_number } : {}),
      }
    : {
        service_type: serviceType,
        ...(priorityType != null ? { priority_type: priorityType } : {}),
        ...(securityCode ? { security_code: securityCode } : {}),
        ...(window ? { window: window } : {}),
      };

  const data = await fetchJson(`${API_BASE}/queue/generate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    signal: requestSignal,
  }, KIOSK_TIMEOUT_MS);

  const ticketObj = data.ticket ?? data.data?.ticket ?? data;
  if (data.print && typeof ticketObj === 'object') {
    ticketObj.print = data.print;
  }
  return ticketObj;
}

export async function printTicketApi(ticketId, signal = null) {
  return fetchJson(`${API_BASE}/queue/${ticketId}/print`, {
    method: 'POST',
    headers: getHeaders(),
    signal,
  }, KIOSK_TIMEOUT_MS);
}

export async function getStudent(studentNumber, signal = null) {
  return fetchJson(`${API_BASE}/students/${encodeURIComponent(studentNumber)}`, {
    headers: getHeaders(),
    signal,
  }, KIOSK_TIMEOUT_MS);
}

export async function verifySecurityCode(securityCode, signal = null) {
  return fetchJson(`${API_BASE}/queue/verify-security`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ security_code: securityCode }),
    signal,
  }, KIOSK_TIMEOUT_MS);
}

export async function getWaitingTickets(serviceType = null, window = null, staffMode = null, signal = null) {
  if (staffMode) {
    return fetchJson(`${API_BASE}/staff/queue/waiting?mode=${encodeURIComponent(staffMode)}`, { headers: getHeaders(true), signal, cache: 'no-store' }, DEFAULT_TIMEOUT_MS);
  }
  let url = serviceType
    ? `${API_BASE}/queue/waiting?service_type=${serviceType}`
    : `${API_BASE}/queue/waiting`;
  
  if (window) {
    url += `&window=${window}`;
  }
  
  return fetchJson(url, { headers: getHeaders(), signal, cache: 'no-store' }, DEFAULT_TIMEOUT_MS);
}

export async function getServingTickets(serviceType = null, signal = null) {
  let url = serviceType
    ? `${API_BASE}/queue/serving?service_type=${serviceType}`
    : `${API_BASE}/queue/serving`;
  
  return fetchJson(url, { headers: getHeaders(), signal, cache: 'no-store' });
}

export async function getMonitoringData(department = null, signal = null) {
  let actualDept = department;
  let actualSignal = signal;
  if (department && typeof department === 'object' && department.constructor?.name === 'AbortSignal') {
    actualSignal = department;
    actualDept = null;
  }
  let url = `${API_BASE}/queue/monitoring`;
  if (actualDept && actualDept !== 'All') {
    url += `?department=${encodeURIComponent(actualDept)}`;
  }
  return fetchJson(url, { headers: getHeaders(true), signal: actualSignal });
}

// ─── Queue (Auth Required) ───────────────────────────
export async function getAllTickets() {
  const res = await fetch(`${API_BASE}/queue`, {
    headers: getHeaders(true),
  });
  return res.json();
}

export async function callNextTicket(serviceType, mode = null) {
  return fetchJson(`${API_BASE}/queue/call`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ service_type: serviceType, mode }),
  });
}

export async function getCurrentStaffTicket(signal = null) {
  return fetchJson(`${API_BASE}/staff/current-ticket`, {
    headers: getHeaders(true),
    signal,
  });
}

export async function getDisplayConfiguration(signal = null) {
  return fetchJson(`${API_BASE}/display-configuration`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal,
  });
}

export async function publishDisplayConfiguration(config) {
  return fetchJson(`${API_BASE}/display-configuration`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(config),
  });
}

export async function uploadDisplayAsset(file) {
  const body = new FormData();
  body.append('image', file);
  const token = sessionStorage.getItem('token');
  return fetchJson(`${API_BASE}/display-configuration/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
    body,
  });
}

export async function completeTicket(ticketId, performanceRating = null, remarks = null) {
  const body = {};
  if (performanceRating) body.performance_rating = performanceRating;
  if (remarks) body.remarks = remarks;

  return fetchJson(`${API_BASE}/queue/${ticketId}/complete`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(body),
  });
}

export async function cancelTicket(ticketId) {
  return fetchJson(`${API_BASE}/queue/${ticketId}/cancel`, {
    method: 'PUT',
    headers: getHeaders(true),
  });
}

// ─── Staff Management ────────────────────────────────
export async function getStaffList(signal = null) {
  return fetchJson(`${API_BASE}/staff`, {
    headers: getHeaders(true), signal,
  });
}

export async function getStaff(id) {
  const res = await fetch(`${API_BASE}/staff/${id}`, {
    headers: getHeaders(true),
  });
  return res.json();
}

export async function updateStaff(id, data) {
  return fetchJson(`${API_BASE}/staff/${id}`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
}

export async function deleteStaff(id) {
  return fetchJson(`${API_BASE}/staff/${id}`, {
    method: 'DELETE',
    headers: getHeaders(true),
  });
}

export async function registerUser(data) {
  return fetchJson(`${API_BASE}/register`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
}

// ─── Analytics ───────────────────────────────────────
export async function getDashboardAnalytics(period = 'today', startDate = null, endDate = null, department = null, signal = null) {
  let url = `${API_BASE}/analytics/dashboard?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (department) url += `&department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

export async function getDepartmentComparison(period = 'today', startDate = null, endDate = null, department = null, signal = null) {
  let url = `${API_BASE}/analytics/department-comparison?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (department) url += `&department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

export async function getPeakHours(period = 'today', startDate = null, endDate = null, department = null, signal = null) {
  let url = `${API_BASE}/analytics/peak-hours?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (department) url += `&department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

export async function getBusiestDayAnalytics(period = 'today', startDate = null, endDate = null, department = null, signal = null) {
  let url = `${API_BASE}/analytics/busiest-day?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (department) url += `&department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

export async function getCustomersServed(period = 'today', startDate = null, endDate = null, department = null, signal = null) {
  let url = `${API_BASE}/analytics/customers-served?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (department) url += `&department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

export async function getReportData(period = 'today', startDate = null, endDate = null, department = 'all', signal = null) {
  let url = `${API_BASE}/reports?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  if (department && department !== 'all') url += `&department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

export async function getTransactionAnalytics(period = 'today', startDate = null, endDate = null, department, signal = null) {
  let url = `${API_BASE}/analytics/transactions?period=${encodeURIComponent(period)}&department=${encodeURIComponent(department)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  return fetchJson(url, { headers: getHeaders(true), signal }, ANALYTICS_TIMEOUT_MS);
}

// ─── Intelligence & Predictions ──────────────────────
export async function getPredictedWaitTimes(department = null, signal = null) {
  let url = `${API_BASE}/intelligence/predicted-wait`;
  if (department) url += `?department=${encodeURIComponent(department)}`;
  return fetchJson(url, { headers: getHeaders(true), signal });
}

// ─── Window Availability ─────────────────────────────
export async function getWindowAvailability(signal = null) {
  const data = await fetchJson(`${API_BASE}/windows/availability`, {
    headers: getHeaders(false),
    signal,
  }, KIOSK_TIMEOUT_MS);
  return Array.isArray(data) ? data : (Array.isArray(data?.windows) ? data.windows : []);
}

export async function toggleWindowAvailability(department, windowNumber, isAvailable) {
  const res = await fetch(`${API_BASE}/windows/toggle`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({
      department,
      window_number: windowNumber,
      is_available: isAvailable,
    }),
  });
  return res.json();
}

export async function getServiceWindows(department = null, signal = null) {
  const baseUrl = `${API_BASE}/service-windows`;
  const url = department ? `${baseUrl}?department=${encodeURIComponent(department)}` : baseUrl;
  return fetchJson(url, {
    headers: getHeaders(true),
    signal,
  }, KIOSK_TIMEOUT_MS);
}

export async function getAssignedWindow(signal = null) {
  return fetchJson(`${API_BASE}/staff/current-window`, {
    headers: getHeaders(true),
    signal,
  });
}

export async function getCurrentStaffWindow(signal = null) {
  return fetchJson(`${API_BASE}/staff/current-window`, {
    headers: getHeaders(true),
    signal,
  });
}

export async function setAssignedWindowStatus(status) {
  return fetchJson(`${API_BASE}/staff/window/status`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify({ status }),
  });
}

// ─── Activity Logs & Queue History ────────────────────
export async function getActivityLogs(signal = null, date = '', startDate = null, endDate = null) {
  const params = new URLSearchParams();
  if (startDate) {
    params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
  } else if (date) {
    params.set('date', date);
  }
  const query = params.toString();
  return fetchJson(`${API_BASE}/activity-logs${query ? `?${query}` : ''}`, {
    headers: getHeaders(true),
    signal,
  });
}

export async function getQueueHistory(period = 'today', startDate = null, endDate = null, signal = null) {
  let url = `${API_BASE}/queue-history?period=${encodeURIComponent(period)}`;
  if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
  if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
  return fetchJson(url, {
    headers: getHeaders(true),
    signal,
  });
}
