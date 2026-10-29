/* ==========================================================================
   VALIDACIÓN DE PEDIDOS (SERVIDOR)
   Vive en /api/_lib: Vercel no la expone como endpoint (prefijo _).
   Es la fuente de verdad: el navegador también valida, pero aquí se aplica
   de nuevo por si alguien llama /api/orders directamente.
   ========================================================================== */

const STORE_LAT = 7.807111;
const STORE_LNG = -71.186750;
const DEFAULT_MAX_DELIVERY_KM = 15;

const MAX_ITEMS = 150;
const MAX_NAME = 80;
const MAX_ADDRESS = 240;
const MAX_INSTRUCTIONS = 300;
const MAX_MONEY = 100000;

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function toNumber(value) {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isGibberish(text) {
  const value = String(text || '').toLowerCase().trim();
  if (!value) return true;
  const compact = value.replace(/[\s.,-]/g, '');
  if (/^(.)\1{2,}$/.test(compact)) return true;
  if (/(asdf|qwer|zxcv|hjkl|prueba|test|testeo|xxx|ninguna|ningun|n\/a|jjjj)/i.test(value)) return true;
  if (!/[aeiou\u00e1\u00e9\u00ed\u00f3\u00fa]/i.test(compact) && compact.length < 12) return true;
  return false;
}

function isFakePhone(digits) {
  if (!digits) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  if (/^(1234567890|0123456789|12345678|1234567|0000000)$/.test(digits)) return true;
  if (/^(\d{2,3})\1+$/.test(digits)) return true;
  return false;
}

function generateOrderId() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AC-${random}`;
}

function parseGps(gps) {
  if (!gps || typeof gps !== 'object') return null;
  const lat = toNumber(gps.lat);
  const lng = toNumber(gps.lng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'El carrito llegó vacío al servidor.' };
  }
  if (items.length > MAX_ITEMS) {
    return { error: 'El pedido tiene demasiados productos distintos.' };
  }

  const normalized = [];
  for (const item of items) {
    const quantity = Math.round(toNumber(item && item.quantity) || 0);
    if (quantity < 1 || quantity > 999) {
      return { error: 'Hay un producto con cantidad inválida.' };
    }

    const product = (item && item.product) || {};
    const name = cleanText(product.name, 160);
    const price = toNumber(product.price);
    if (!name || price === null || price < 0 || price > MAX_MONEY) {
      return { error: 'Hay un producto con nombre o precio inválido.' };
    }

    normalized.push({
      product: {
        id: cleanText(product.id, 80) || name,
        name,
        price,
        unit: cleanText(product.unit, 40) || 'Unidad'
      },
      quantity
    });
  }

  return { items: normalized };
}

/**
 * Valida y normaliza un pedido recibido por HTTP.
 * @returns {{ok: boolean, status: number, error?: string, row?: object, distanceKm: number|null}}
 */
function validateOrder(payload, options = {}) {
  const maxDeliveryKm = Number(options.maxDeliveryKm || process.env.MAX_DELIVERY_KM || DEFAULT_MAX_DELIVERY_KM);
  if (!payload || typeof payload !== 'object') {
    return { ok: false, status: 400, error: 'No recibimos datos del pedido.', distanceKm: null };
  }

  const name = cleanText(payload.customerName, MAX_NAME);
  if (name.length < 3 || !/[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/i.test(name) || isGibberish(name)) {
    return { ok: false, status: 400, error: 'El nombre no parece real. Escribe tu nombre y apellido.', distanceKm: null };
  }

  const phone = cleanText(payload.customerPhone, 40);
  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length < 7 || phoneDigits.length > 15 || isFakePhone(phoneDigits)) {
    return { ok: false, status: 400, error: 'Revisa el teléfono de contacto: no parece válido.', distanceKm: null };
  }

  const deliveryType = payload.deliveryType === 'pickup' ? 'pickup' : 'delivery';
  const gps = parseGps(payload.gpsCoordinates);
  const addressRaw = cleanText(payload.deliveryAddress, MAX_ADDRESS);

  let distanceKm = null;
  if (gps) {
    distanceKm = haversineKm(gps.lat, gps.lng, STORE_LAT, STORE_LNG);
  }

  if (deliveryType === 'delivery') {
    if (!gps && (addressRaw.length < 10 || isGibberish(addressRaw))) {
      return { ok: false, status: 400, error: 'Falta una dirección de entrega completa.', distanceKm };
    }
    if (distanceKm !== null && distanceKm > maxDeliveryKm) {
      return {
        ok: false,
        status: 400,
        error: `El destino está a ${distanceKm.toFixed(0)} km de la tienda y repartimos hasta ${maxDeliveryKm} km.`,
        distanceKm
      };
    }
  }

  const itemsResult = validateItems(payload.items);
  if (itemsResult.error) {
    return { ok: false, status: 400, error: itemsResult.error, distanceKm };
  }

  const subtotal = toNumber(payload.subtotal);
  const discount = toNumber(payload.discount) ?? 0;
  const deliveryFee = toNumber(payload.deliveryFee) ?? 0;
  const tip = toNumber(payload.tip) ?? 0;
  const total = toNumber(payload.total);
  const moneyInvalid = [subtotal, discount, deliveryFee, tip, total]
    .some((value) => value === null || value < 0 || value > MAX_MONEY);
  if (moneyInvalid || total <= 0) {
    return { ok: false, status: 400, error: 'Los montos del pedido no son válidos.', distanceKm };
  }

  const deliveryAddress = deliveryType === 'pickup'
    ? 'Recogida en Tienda Al Costo'
    : addressRaw;

  const row = {
    id: generateOrderId(),
    customer_name: name,
    customer_phone: phone,
    delivery_address: deliveryAddress,
    delivery_slot: cleanText(payload.deliverySlot, 80) || 'Lo antes posible',
    instructions: cleanText(payload.instructions, MAX_INSTRUCTIONS),
    payment_method: cleanText(payload.paymentMethod, 60) || 'Efectivo',
    items: itemsResult.items,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    tip,
    total,
    status: 'nuevo',
    created_at: new Date().toISOString()
  };

  // Columnas opcionales: si la tabla no las tiene, el endpoint reintenta sin ellas.
  const optional = {
    payment_proof: typeof payload.paymentProof === 'string' ? payload.paymentProof : null,
    gps_coordinates: gps ? { ...gps, distanceKm } : null,
    delivery_type: deliveryType
  };

  return { ok: true, status: 201, row, optional, distanceKm, phoneDigits };
}

module.exports = {
  STORE_LAT,
  STORE_LNG,
  DEFAULT_MAX_DELIVERY_KM,
  haversineKm,
  validateOrder,
  digitsOnly,
  cleanText
};
