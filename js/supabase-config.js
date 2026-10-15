// ==========================================================================
// CONFIGURACIÓN Y CLIENTE SUPABASE - AL COSTO SUPERMERCADO
// Funciona mediante REST API directo sin dependencias externas pesadas
// ==========================================================================

const OWNER_PHONE = '34602070846'; // +34 602 07 08 46

// Credenciales base de Supabase para la tienda (catálogo y pedidos de clientes)
const PUBLIC_SUPABASE_CONFIG = {
  url: 'https://azbrwlamlltimghrhxsj.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6YnJ3bGFtbGx0aW1naHJoeHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTIyNTAsImV4cCI6MjEwNjM2ODI1MH0.cR85t6G8FGNKxVstbxdSTxo9FmOyf-0_f3EJ_fxsAqI'
};

// Alias de columnas de la tabla public.pedidos: el código escribe nombres en inglés
// (customer_name, delivery_fee...), pero algunas tablas fueron creadas con nombres
// en español (nombre_cliente, telefono, direccion, horario, metodo_pago, envio...).
const ORDER_COLUMN_ALIASES = {
  customer_name: ['nombre_cliente'],
  customer_phone: ['telefono'],
  delivery_address: ['direccion'],
  delivery_slot: ['horario'],
  payment_method: ['metodo_pago'],
  delivery_fee: ['envio'],
  instructions: ['instrucciones', 'nota']
};

// Columnas opcionales del pedido: si faltan en la tabla se descartan con advertencia
// (el pedido SIEMPRE se guarda, aunque sea sin la captura, sin el GPS o sin la nota).
const OPTIONAL_ORDER_COLUMNS = ['payment_proof', 'gps_coordinates', 'delivery_type', 'instructions', 'discount', 'tip'];

// Extrae los nombres de columna faltantes del error 42703 de PostgREST/Postgres
function extractMissingColumns(errorText) {
  if (!errorText) return [];
  const regex = /column\s+\\?"?([a-zA-Z_][a-zA-Z0-9_]*)\\?"?\s+(?:of relation|does not exist)/g;
  const columns = [];
  let match;
  while ((match = regex.exec(errorText)) !== null) columns.push(match[1]);
  return [...new Set(columns)];
}

const SupabaseService = {
  // Obtener credenciales para la tienda (usuario cliente: usa configuración guardada o por defecto la pública)
  getConfig() {
    const saved = localStorage.getItem('alcosto_supabase_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const url = (parsed.url || '').trim().replace(/\/+$/, '');
        const anonKey = (parsed.anonKey || '').trim();
        if (url && anonKey) {
          return {
            url,
            anonKey,
            connected: true
          };
        }
      } catch (e) {
        console.error('Error parseando config de Supabase:', e);
      }
    }
    // Usuario general: carga los productos directamente con la nube oficial
    const url = (PUBLIC_SUPABASE_CONFIG.url || '').trim().replace(/\/+$/, '');
    const anonKey = (PUBLIC_SUPABASE_CONFIG.anonKey || '').trim();
    return {
      url,
      anonKey,
      connected: Boolean(url && anonKey)
    };
  },

  // Obtener credenciales exclusivas del panel de administración (no expone las predeterminadas a cualquiera en los campos del admin)
  getAdminConfig() {
    const saved = localStorage.getItem('alcosto_supabase_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          url: (parsed.url || '').trim(),
          anonKey: (parsed.anonKey || '').trim(),
          connected: Boolean(parsed.url && parsed.anonKey)
        };
      } catch (e) {}
    }
    return {
      url: '',
      anonKey: '',
      connected: false
    };
  },

  // Guardar credenciales
  saveConfig(url, anonKey) {
    // Limpiar url
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const config = {
      url: cleanUrl,
      anonKey: anonKey.trim(),
      connected: Boolean(cleanUrl && anonKey.trim())
    };
    localStorage.setItem('alcosto_supabase_config', JSON.stringify(config));
    return config;
  },

  // Headers estándar para las peticiones a Supabase
  getHeaders() {
    const config = this.getConfig();
    return {
      'apikey': config.anonKey,
      'Authorization': `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  // Probar conexión con Supabase
  async testConnection() {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      return { success: false, message: 'Falta ingresar la URL o la Anon Key de Supabase.' };
    }

    try {
      // Hacemos una petición rápida a la tabla de productos o a la raíz de la API
      const res = await fetch(`${config.url}/rest/v1/productos?select=id&limit=1`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (res.ok) {
        return { success: true, message: '🟢 ¡Conexión exitosa con Supabase! Tabla "productos" lista.' };
      } else if (res.status === 404 || res.status === 400) {
        return { 
          success: true, 
          message: '🟡 Servidor conectado, pero la tabla "productos" aún no existe. Ejecuta el script SQL en Supabase.',
          needTables: true
        };
      } else {
        const errorText = await res.text();
        return { success: false, message: `Error (${res.status}): Revisa tu Anon Key o URL.` };
      }
    } catch (err) {
      return { success: false, message: `No se pudo conectar a Supabase: ${err.message}` };
    }
  },

  // Publicar todos los productos a Supabase (Upsert masivo)
  async syncProductsToSupabase(productsList) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      throw new Error('Supabase no está configurado. Ingresa la URL y Anon Key primero.');
    }

    // BLOQUEO DE SEGURIDAD: los 24 productos demo predeterminados (IDs viv-/char-/lac-/may-/beb-/cnf-/lim-/car-/fru-)
    // fueron eliminados de la base el 2026-10-12 y nunca más deben republicarse.
    const safeList = (typeof stripLegacyDefaultProducts === 'function')
      ? stripLegacyDefaultProducts(productsList)
      : (Array.isArray(productsList) ? productsList : []);
    if (safeList.length === 0) {
      return { data: [], skipped: true };
    }

    // Formatear productos para Supabase
    const payload = safeList.map(p => ({
      id: p.id,
      ...(p.barcode ? { barcode: p.barcode } : {}),
      name: p.name,
      category: p.category,
      price: p.price,
      original_price: p.originalPrice || null,
      wholesale_price: p.wholesalePrice || null,
      wholesale_min: p.wholesaleMin || 1,
      unit: p.unit,
      image: p.image,
      badge: p.badge || null,
      description: p.description || '',
      origin: p.origin || '',
      is_wholesale: Boolean(p.isWholesale || p.category === 'al-mayor'),
      in_stock: true,
      updated_at: new Date().toISOString()
    }));

    const sendProducts = async (productsPayload) => {
      const res = await fetch(`${config.url}/rest/v1/productos`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(productsPayload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error de Supabase (${res.status}): ${errText}`);
      }
      return res.json();
    };

    try {
      return await sendProducts(payload);
    } catch (err) {
      const isMissingBarcodeColumn = payload.some(product => product.barcode) &&
        err.message.includes('barcode') && err.message.includes('schema cache');
      if (!isMissingBarcodeColumn) throw err;

      const legacyPayload = payload.map(({ barcode, ...product }) => product);
      const data = await sendProducts(legacyPayload);
      return { data, barcodeNotSynced: true };
    }
  },

  // Obtener productos desde Supabase
  async fetchProductsFromSupabase() {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) return null;

    try {
      const res = await fetch(`${config.url}/rest/v1/productos?select=*&order=category.asc`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!res.ok) return null;
      const data = await res.json();

      // BLOQUEO DE SEGURIDAD: excluir cualquier producto demo predeterminado que exista aún en la tabla
      const safeData = (typeof stripLegacyDefaultProducts === 'function')
        ? stripLegacyDefaultProducts(data)
        : (Array.isArray(data) ? data : []);

      // Adaptar formato a la app
      return safeData.map(item => ({
        id: item.id,
        barcode: item.barcode || '',
        name: item.name,
        category: item.category,
        price: parseFloat(item.price),
        originalPrice: item.original_price ? parseFloat(item.original_price) : null,
        wholesalePrice: item.wholesale_price ? parseFloat(item.wholesale_price) : null,
        wholesaleMin: item.wholesale_min || 1,
        unit: item.unit,
        image: item.image,
        badge: item.badge,
        tag: item.original_price ? 'oferta' : 'popular',
        description: item.description,
        origin: item.origin,
        isWholesale: item.is_wholesale,
        rating: 4.9,
        reviews: 120
      }));
    } catch (e) {
      console.warn('No se pudieron obtener productos de Supabase, usando locales:', e);
      return null;
    }
  },

  // Inserta un pedido adaptando el payload a las columnas REALES de public.pedidos.
  // Si Supabase responde 42703 (columna inexistente) traduce la columna a su alias en
  // español y reintenta; las columnas opcionales se descartan con un aviso + SQL.
  async insertOrderAdapted(insertOrder, initialPayload) {
    let payload = { ...initialPayload };
    // Cada iteración adapta al menos una columna, así que el tope es holgado
    const maxAttempts = Object.keys(initialPayload).length * 2 + 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await insertOrder(payload);
      if (result.ok) return result;

      const isMissingColumn = result.status === 400 && /42703|does not exist/i.test(result.error || '');
      const missing = isMissingColumn ? extractMissingColumns(result.error) : [];
      if (!missing.length) return result; // Otro tipo de error: lo decide el llamador

      let adapted = false;
      missing.forEach((column) => {
        if (!(column in payload)) return;

        const alias = (ORDER_COLUMN_ALIASES[column] || []).find((name) => !(name in payload));
        if (alias) {
          payload[alias] = payload[column];
          delete payload[column];
          adapted = true;
          console.warn(`Supabase: la columna "${column}" no existe en public.pedidos; se usó su alias "${alias}".`);
          return;
        }

        if (OPTIONAL_ORDER_COLUMNS.includes(column)) {
          delete payload[column];
          adapted = true;
          const sqlType = column === 'gps_coordinates' ? 'jsonb' : 'text';
          console.warn(
            `Supabase: la columna opcional "${column}" no existe en public.pedidos; se omitió. ` +
            `Ejecuta: ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ${column} ${sqlType};`
          );
          return;
        }

        // Columna imprescindible (items, total, status...) sin alias: no se arriesga
        // a guardar un pedido incompleto, se reporta el error con su SQL.
        console.warn(
          `Supabase: la columna "${column}" no existe en public.pedidos ni tiene alias; ` +
          `el pedido NO se guardó en la nube. SQL: ` +
          `ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ${column} <tipo>;`
        );
      });

      if (!adapted) return result;
    }

    return { ok: false, status: 400, error: 'No fue posible mapear las columnas de public.pedidos' };
  },

  // Guardar un nuevo pedido en Supabase
  // NOTA: el payload se adapta a las columnas reales de public.pedidos (ver
  // insertOrderAdapted). payment_proof / gps_coordinates / delivery_type son
  // OPCIONALES: si faltan, se descartan y el pedido SIEMPRE se guarda.
  async sendOrderToSupabase(orderData) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) return null;

    const basePayload = {
      id: orderData.id,
      customer_name: orderData.customerName,
      customer_phone: orderData.customerPhone,
      delivery_address: orderData.deliveryAddress,
      delivery_slot: orderData.deliverySlot,
      instructions: orderData.instructions || '',
      payment_method: orderData.paymentMethod,
      items: orderData.items,
      subtotal: orderData.subtotal,
      discount: orderData.discount,
      delivery_fee: orderData.deliveryFee,
      tip: orderData.tip,
      total: orderData.total,
      status: orderData.status || 'nuevo',
      created_at: new Date().toISOString()
    };

    // Campos extra que permiten al admin ver la captura del pago y la ubicación GPS
    const extraPayload = {
      payment_proof: orderData.paymentProof || null,
      gps_coordinates: orderData.gpsCoordinates || null,
      delivery_type: orderData.deliveryType || 'delivery'
    };

    const insertOrder = async (payload) => {
      const res = await fetch(`${config.url}/rest/v1/pedidos`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return { ok: true, data: await res.json() };
      }
      const errText = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: errText };
    };

    try {
      // 1º Intento: con captura de pago, GPS y modalidad
      const full = await this.insertOrderAdapted(insertOrder, { ...basePayload, ...extraPayload });
      if (full.ok) return full.data;

      // 2º Intento: reintento sin las columnas opcionales (payment_proof / gps / delivery_type)
      const isMissingColumn = full.status === 400 && /42703|does not exist/i.test(full.error || '');
      if (isMissingColumn) {
        console.warn(
          'Supabase: la tabla "pedidos" no tiene las columnas payment_proof / gps_coordinates / ' +
          'delivery_type. El pedido se guardó SIN la captura. Ejecuta este SQL en el editor de Supabase para habilitarlas:\n' +
          'ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS payment_proof text;\n' +
          'ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS gps_coordinates jsonb;\n' +
          'ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS delivery_type text;'
        );
        const fallback = await this.insertOrderAdapted(insertOrder, basePayload);
        if (fallback.ok) return fallback.data;
        console.warn('Supabase: el reintento del pedido también falló:', fallback.error);
      } else {
        console.warn('Supabase: error guardando pedido:', full.error);
      }
    } catch (e) {
      console.warn('Error enviando pedido a Supabase:', e);
    }
    return null;
  },

  // Actualizar estado del pedido en Supabase
  async updateOrderStatus(orderId, newStatus) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) return false;

    try {
      const res = await fetch(`${config.url}/rest/v1/pedidos?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      return res.ok;
    } catch (e) {
      console.error('Error actualizando pedido en Supabase:', e);
      return false;
    }
  },

  // Consultar solo el estado actual de un pedido puntual (para el tracker en vivo del cliente)
  async fetchOrderStatusFromSupabase(orderId) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) return null;

    try {
      const res = await fetch(`${config.url}/rest/v1/pedidos?select=status&id=eq.${encodeURIComponent(orderId)}&limit=1`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (res.ok) {
        // 200 con lista vacía: el pedido no existe en la tabla (null)
        const rows = await res.json();
        return (Array.isArray(rows) && rows[0] && rows[0].status) ? rows[0].status : null;
      }
      // Respuesta inválida: estado desconocido (undefined). NO se limpia la sesión.
      return undefined;
    } catch (e) {
      console.warn('Error consultando estado del pedido en Supabase:', e);
      // Sin conexión: estado desconocido (undefined). NO se limpia la sesión.
      return undefined;
    }
    return null;
  },

  // Configuración predeterminada de métodos de pago (Pago Móvil, Zelle, Binance Pay, Efectivo)
  getDefaultPaymentConfig() {
    return {
      pagoMovil: {
        banco: 'Banco de Venezuela (0102)',
        telefono: '0412-1234567',
        cedula: 'V-26.123.456',
        titular: 'Al Costo Supermercado C.A.'
      },
      zelle: {
        correo: 'pagos@alcostosuper.com',
        titular: 'Al Costo Supermarket LLC'
      },
      binance: {
        payId: '284910283',
        correo: 'binance@alcostosuper.com',
        red: 'USDT (Red TRC20 / BEP20)'
      },
      updatedAt: new Date().toISOString()
    };
  },

  // Obtener datos de pago (desde Supabase con fallback a localStorage y defaults)
  async fetchPaymentConfig() {
    const config = this.getConfig();
    let localData = null;
    try {
      const saved = localStorage.getItem('alcosto_payment_config');
      if (saved) localData = JSON.parse(saved);
    } catch(e) {}

    if (!config.url || !config.anonKey) {
      return localData || this.getDefaultPaymentConfig();
    }

    try {
      const res = await fetch(`${config.url}/rest/v1/configuracion_pagos?id=eq.default&select=*`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].datos) {
          const cloudData = rows[0].datos;
          localStorage.setItem('alcosto_payment_config', JSON.stringify(cloudData));
          return cloudData;
        }
      }
    } catch (e) {
      console.warn('No se pudo leer configuracion_pagos de Supabase, usando local:', e);
    }
    return localData || this.getDefaultPaymentConfig();
  },

  // Guardar configuración de pagos en Supabase y localmente
  async savePaymentConfig(paymentData) {
    paymentData.updatedAt = new Date().toISOString();
    localStorage.setItem('alcosto_payment_config', JSON.stringify(paymentData));

    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      return { success: true, localOnly: true };
    }

    try {
      const res = await fetch(`${config.url}/rest/v1/configuracion_pagos`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: 'default',
          datos: paymentData,
          updated_at: paymentData.updatedAt
        })
      });
      return { success: res.ok, cloud: res.ok };
    } catch (e) {
      console.warn('Error guardando configuracion_pagos en Supabase:', e);
      return { success: true, localOnly: true };
    }
  },

  // Obtener pedidos desde Supabase
  async fetchOrdersFromSupabase() {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) return null;

    try {
      const res = await fetch(`${config.url}/rest/v1/pedidos?select=*&order=created_at.desc`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Error leyendo pedidos de Supabase:', e);
    }
    return null;
  },

  // Generador de Enlace WhatsApp para el dueño (+34 602 07 08 46) con Ubicación GPS Real
  createOwnerWhatsAppLink(order) {
    const itemsList = (Array.isArray(order.items) ? order.items : []).map(i => {
      const source = i.product || i;
      const qty = parseFloat(i.quantity) || 0;
      const price = parseFloat(source.price) || 0;
      return `• ${qty}x ${source.name || 'Producto'} ($${(price * qty).toFixed(2)})`;
    }).join('%0A');
    
    let gpsText = '';
    if (order.gpsCoordinates && order.gpsCoordinates.lat && order.gpsCoordinates.lng) {
      const mapsUrl = `https://www.google.com/maps?q=${order.gpsCoordinates.lat},${order.gpsCoordinates.lng}`;
      gpsText = `%0A📍 *UBICACIÓN REAL DEL CLIENTE (GPS):*%0A` +
        `🗺️ Google Maps: ${mapsUrl}%0A` +
        `🎯 Coordenadas: ${order.gpsCoordinates.lat.toFixed(6)}, ${order.gpsCoordinates.lng.toFixed(6)} (Precisión: ±${order.gpsCoordinates.accuracy || 10}m)%0A`;
    }

    const routeLabel = order.deliveryType === 'pickup' 
      ? '🏪 Recogida en Tienda Al Costo (Gratis)' 
      : '🛵 Delivery a Domicilio Express (Con GPS)';

    const message = 
      `🛒 *¡NUEVO PEDIDO AL COSTO!* 🛒%0A%0A` +
      `*Orden:* %23${order.id}%0A` +
      `*Modalidad:* ${routeLabel}%0A` +
      `*Cliente:* ${order.customerName}%0A` +
      `*Teléfono:* ${order.customerPhone}%0A` +
      `*Dirección:* ${order.deliveryAddress}%0A` +
      gpsText +
      `*Horario:* ${order.deliverySlot || 'A coordinar'}%0A` +
      `*Método de Pago:* ${order.paymentMethod || 'No especificado'}%0A` +
      (order.instructions ? `*Nota:* ${order.instructions}%0A` : '') +
      `%0A*--- PRODUCTOS SOLICITADOS ---*%0A` +
      `${itemsList}%0A%0A` +
      `*Total a Pagar:* $${(parseFloat(order.total) || 0).toFixed(2)}`;

    return `https://wa.me/${OWNER_PHONE}?text=${message}`;
  },

  // ==========================================================================
  // AUTENTICACIÓN Y GESTIÓN DE USUARIOS EN SUPABASE
  // ==========================================================================
  // Devuelve el hash SHA-256 (hex, 64 caracteres) de una contraseña.
  // La contraseña en claro NUNCA se envía al servidor ni se guarda: solo su hash.
  async hashPassword(password) {
    const text = String(password || '');
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Web Crypto solo existe en contextos seguros (HTTPS o localhost):
    // si no está disponible, no se permite guardar ni verificar la contraseña.
    return null;
  },

  // Detecta si el valor guardado ya es un hash SHA-256 (64 hex) y no texto plano
  isHashedPassword(stored) {
    return /^[0-9a-f]{64}$/i.test(String(stored || ''));
  },

  async registerUser(userData) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      return { success: true, localOnly: true, user: userData };
    }

    try {
      // Cifrar la contraseña ANTES de enviarla (nunca viaja en texto plano)
      const hashedPassword = await this.hashPassword(userData.password);
      if (!hashedPassword) {
        return {
          success: false,
          message: 'Tu navegador no permite cifrar la contraseña de forma segura (se requiere HTTPS). Recarga la página e inténtalo de nuevo.'
        };
      }

      const payload = {
        nombre: userData.name,
        email: userData.email ? userData.email.toLowerCase().trim() : null,
        telefono: userData.phone ? userData.phone.trim() : null,
        password_hash: hashedPassword, // Hash SHA-256: la contraseña en claro queda solo en el navegador
        direccion_predeterminada: userData.address || '',
        rol: 'cliente',
        created_at: new Date().toISOString()
      };

      const res = await fetch(`${config.url}/rest/v1/usuarios`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const rows = await res.json();
        return { success: true, user: rows[0] };
      } else {
        const errText = await res.text();
        if (errText.includes('duplicate') || errText.includes('usuarios_email_key')) {
          return { success: false, message: 'Este correo ya se encuentra registrado.' };
        }
        if (errText.includes('usuarios_telefono_key')) {
          return { success: false, message: 'Este teléfono ya está asociado a otra cuenta.' };
        }
        return { success: false, message: `Error (${res.status}): ${errText}` };
      }
    } catch (e) {
      console.warn('Error registrando usuario en Supabase:', e);
      return { success: true, localOnly: true, user: userData };
    }
  },

  async loginUser(identifier, password) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      return { success: false, localOnly: true, message: 'Supabase no está configurado.' };
    }

    try {
      const cleanIdent = identifier.toLowerCase().trim();
      const isEmail = cleanIdent.includes('@');
      const queryParam = isEmail 
        ? `email=eq.${encodeURIComponent(cleanIdent)}` 
        : `telefono=eq.${encodeURIComponent(cleanIdent)}`;

      const res = await fetch(`${config.url}/rest/v1/usuarios?${queryParam}&select=*&limit=1`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (res.ok) {
        const rows = await res.json();
        if (!rows || rows.length === 0) {
          return { success: false, message: 'Usuario no encontrado. Verifica tu correo o teléfono.' };
        }
        const user = rows[0];

        // Cifrar la contraseña ingresada para compararla con el hash guardado
        const hashedInput = await this.hashPassword(password);
        if (!hashedInput) {
          return {
            success: false,
            message: 'Tu navegador no permite verificar la contraseña de forma segura (se requiere HTTPS). Recarga la página e inténtalo de nuevo.'
          };
        }

        const storedPassword = String(user.password_hash || '');
        const accountIsHashed = this.isHashedPassword(storedPassword);

        // Cuentas nuevas: comparación por hash. Cuentas antiguas (texto plano):
        // se acepta la contraseña original y se encripta el registro al instante.
        const passwordMatches = accountIsHashed
          ? storedPassword.toLowerCase() === hashedInput
          : storedPassword === String(password || '');

        if (!passwordMatches) {
          return { success: false, message: 'Contraseña incorrecta. Inténtalo de nuevo.' };
        }

        // Migración automática: cuenta antigua con contraseña en texto plano →
        // se reemplaza por su hash SHA-256 para no volver a guardarla sin cifrar.
        if (!accountIsHashed) {
          try {
            await fetch(`${config.url}/rest/v1/usuarios?${queryParam}`, {
              method: 'PATCH',
              headers: { ...this.getHeaders(), 'Prefer': 'return=minimal' },
              body: JSON.stringify({ password_hash: hashedInput })
            });
          } catch (e) {
            console.warn('No se pudo encriptar la contraseña guardada (se reintentará en el próximo inicio):', e);
          }
        }

        return {
          success: true,
          user: {
            id: user.id,
            name: user.nombre,
            email: user.email,
            phone: user.telefono,
            address: user.direccion_predeterminada,
            role: user.rol
          }
        };
      } else {
        return { success: false, message: 'No se pudo verificar las credenciales en el servidor.' };
      }
    } catch (e) {
      console.warn('Error en login con Supabase:', e);
      return { success: false, message: `Error de red: ${e.message}` };
    }
  }
};
