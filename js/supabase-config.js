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

    // Formatear productos para Supabase
    const payload = productsList.map(p => ({
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
      
      // Adaptar formato a la app
      return data.map(item => ({
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

  // Guardar un nuevo pedido en Supabase
  async sendOrderToSupabase(orderData) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) return null;

    try {
      const payload = {
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

      const res = await fetch(`${config.url}/rest/v1/pedidos`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        return await res.json();
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
    const itemsList = order.items.map(i => `• ${i.quantity}x ${i.product.name} ($${(i.product.price * i.quantity).toFixed(2)})`).join('%0A');
    
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
      `*Horario:* ${order.deliverySlot}%0A` +
      `*Método de Pago:* ${order.paymentMethod}%0A` +
      (order.instructions ? `*Nota:* ${order.instructions}%0A` : '') +
      `%0A*--- PRODUCTOS SOLICITADOS ---*%0A` +
      `${itemsList}%0A%0A` +
      `*Total a Pagar:* $${order.total.toFixed(2)}`;

    return `https://wa.me/${OWNER_PHONE}?text=${message}`;
  },

  // ==========================================================================
  // AUTENTICACIÓN Y GESTIÓN DE USUARIOS EN SUPABASE
  // ==========================================================================
  async registerUser(userData) {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      return { success: true, localOnly: true, user: userData };
    }

    try {
      const payload = {
        nombre: userData.name,
        email: userData.email ? userData.email.toLowerCase().trim() : null,
        telefono: userData.phone ? userData.phone.trim() : null,
        password_hash: userData.password, // En producción se recomienda hashear
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
        if (user.password_hash !== password) {
          return { success: false, message: 'Contraseña incorrecta. Inténtalo de nuevo.' };
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
