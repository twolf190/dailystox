// Shared helpers used by app.js and chart.js.

async function getJson(url) {
  const response = await fetch(url, { headers: await authHeaders() });
  if (response.status === 401) return redirectToLogin();
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function authHeaders() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function redirectToLogin() {
  location.href = `/login.html?next=${encodeURIComponent(location.pathname)}`;
  return new Promise(() => {}); // stop the caller; navigation is already underway
}

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function money(value, fallback = "$0.00") {
  if (!Number.isFinite(Number(value))) return fallback;
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function signed(value) {
  if (!Number.isFinite(Number(value))) return "0.00";
  const num = Number(value);
  return `${num > 0 ? "+" : ""}${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function compact(value) {
  if (!Number.isFinite(Number(value))) return "0";
  return Number(value).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
}

function tone(value) {
  const num = Number(value);
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
}
