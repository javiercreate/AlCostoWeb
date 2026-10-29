/* ==========================================================================
   CLIENTE SUPABASE DEL SERVIDOR (SERVICE ROLE)
   Solo se usa dentro de /api: la service key NUNCA viaja al navegador.
   Variables de entorno necesarias en Vercel:
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY   (Project Settings → API → service_role)
   ========================================================================== */

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    url: url ? String(url).replace(/\/+$/, '') : '',
    serviceKey: serviceKey || '',
    configured: Boolean(url && serviceKey)
  };
}

function isConfigured() {
  return getConfig().configured;
}

function authHeaders(extra = {}) {
  const { serviceKey } = getConfig();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

/** Pedidos recientes (por defecto últimas 24 h) para límites antifraude. */
async function fetchRecentOrders({ sinceIso, limit = 200 } = {}) {
  const { url, configured } = getConfig();
  if (!configured) return { ok: false, error: 'Supabase no configurado' };

  const since = sinceIso || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endpoint = `${url}/rest/v1/pedidos?select=id,customer_phone,created_at` +
    `&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=${limit}`;

  const res = await fetch(endpoint, { headers: authHeaders() });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text().catch(() => '') };
  }
  const rows = await res.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

async function postOrder(payload) {
  const { url, configured } = getConfig();
  if (!configured) return { ok: false, status: 500, error: 'Supabase no configurado en el servidor' };

  const res = await fetch(`${url}/rest/v1/pedidos`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data };
  }
  return { ok: false, status: res.status, error: await res.text().catch(() => '') };
}

/**
 * Inserta el pedido con las columnas opcionales y, si la tabla no las tiene
 * (error 42703), reintenta sin ellas. Mismo criterio que el frontend antiguo.
 */
async function insertOrder(row, optional = {}) {
  const full = await postOrder({ ...row, ...optional });
  if (full.ok) return { ...full, savedWithExtras: true };

  const missingColumn = full.status === 400 && /42703|does not exist/i.test(full.error || '');
  if (!missingColumn) return full;

  const basic = await postOrder(row);
  if (basic.ok) {
    return { ...basic, savedWithExtras: false, warning: 'Columnas opcionales ausentes: se omitieron payment_proof/gps_coordinates/delivery_type.' };
  }
  return basic;
}

module.exports = { isConfigured, fetchRecentOrders, insertOrder };
