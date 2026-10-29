/* ==========================================================================
   POST /api/orders
   Crea un pedido validado en Supabase usando la service role key.

   Por qué existe: el navegador ya no necesita permisos de escritura directa
   sobre public.pedidos. Un troll que llame a Supabase con la anon key se
   topa con RLS; el único camino válido es esta función, que revalida todo.

   Variables de entorno en Vercel:
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
     MAX_DELIVERY_KM            (opcional, por defecto 15)
     N8N_WEBHOOK_URL            (opcional: reenvía el pedido a n8n)
   ========================================================================== */

const { validateOrder, digitsOnly } = require('./_lib/order-validation');
const { isConfigured, fetchRecentOrders, insertOrder } = require('./_lib/supabase-admin');

const SAME_PHONE_COOLDOWN_MIN = 10;
const MAX_PHONE_ORDERS_PER_DAY = 8;
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB (capturas de pago incluidas)

function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try { resolve(JSON.parse(req.body)); } catch (e) { reject(new Error('JSON inválido')); }
      return;
    }

    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('El pedido supera el tamaño máximo permitido'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function notifyN8n(order) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      event: 'pedido.nuevo',
      orderId: order.id,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      deliveryType: order.delivery_type,
      deliveryAddress: order.delivery_address,
      total: order.total,
      paymentMethod: order.payment_method,
      items: order.items,
      createdAt: order.created_at
    })
  })
    .catch((error) => console.warn('No se pudo avisar a n8n:', error.message))
    .finally(() => clearTimeout(timeout));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Método no permitido' });
  }

  if (!isConfigured()) {
    return json(res, 500, { ok: false, error: 'La tienda no está configurada para recibir pedidos.' });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message });
  }

  const validation = validateOrder(payload);
  if (!validation.ok) {
    return json(res, validation.status, { ok: false, error: validation.error });
  }

  const { row, optional, phoneDigits, distanceKm } = validation;

  // Antifraude: ráfagas con el mismo teléfono y tope diario por teléfono.
  try {
    const recent = await fetchRecentOrders({ limit: 200 });
    if (recent.ok) {
      const now = Date.now();
      const cooldownMs = SAME_PHONE_COOLDOWN_MIN * 60 * 1000;
      const dayMs = 24 * 60 * 60 * 1000;

      const samePhone = recent.rows.filter((order) => digitsOnly(order.customer_phone) === phoneDigits);
      const tooSoon = samePhone.some((order) => {
        const age = now - new Date(order.created_at || 0).getTime();
        return age >= 0 && age < cooldownMs;
      });
      if (tooSoon) {
        return json(res, 429, {
          ok: false,
          error: `Ya registramos un pedido con este teléfono hace menos de ${SAME_PHONE_COOLDOWN_MIN} minutos.`
        });
      }

      const todayCount = samePhone.filter((order) => {
        const age = now - new Date(order.created_at || 0).getTime();
        return age >= 0 && age < dayMs;
      }).length;
      if (todayCount >= MAX_PHONE_ORDERS_PER_DAY) {
        return json(res, 429, { ok: false, error: 'Este teléfono alcanzó el límite de pedidos por hoy.' });
      }
    }
  } catch (error) {
    // Si el chequeo falla, no se bloquea la venta: la validación principal ya pasó.
    console.warn('No se pudo verificar el límite de pedidos:', error.message);
  }

  const result = await insertOrder(row, optional);
  if (!result.ok) {
    console.error('Supabase rechazó el pedido:', result.status, result.error);
    return json(res, 502, { ok: false, error: 'No pudimos guardar el pedido. Intenta de nuevo o escríbenos por WhatsApp.' });
  }

  notifyN8n({ ...row, delivery_type: optional.delivery_type });

  return json(res, 201, {
    ok: true,
    orderId: row.id,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
    warning: result.warning || null
  });
};
