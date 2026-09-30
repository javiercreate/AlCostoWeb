// ==========================================================================
// CONFIGURACIÓN Y CLIENTE SUPABASE - AL COSTO SUPERMERCADO
// Funciona mediante REST API directo sin dependencias externas pesadas
// ==========================================================================

const OWNER_PHONE = '34602070846'; // +34 602 07 08 46

const SupabaseService = {
  // Obtener credenciales guardadas
  getConfig() {
    const saved = localStorage.getItem('alcosto_supabase_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parseando config de Supabase:', e);
      }
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

    const res = await fetch(`${config.url}/rest/v1/productos`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error de Supabase (${res.status}): ${errText}`);
    }

    return await res.json();
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

  // Generador de Enlace WhatsApp para el dueño (+34 602 07 08 46)
  createOwnerWhatsAppLink(order) {
    const itemsList = order.items.map(i => `• ${i.quantity}x ${i.product.name} ($${(i.product.price * i.quantity).toFixed(2)})`).join('%0A');
    
    const message = 
      `🛒 *¡NUEVO PEDIDO AL COSTO!* 🛒%0A%0A` +
      `*Orden:* %23${order.id}%0A` +
      `*Cliente:* ${order.customerName}%0A` +
      `*Teléfono:* ${order.customerPhone}%0A` +
      `*Dirección:* ${order.deliveryAddress}%0A` +
      `*Horario:* ${order.deliverySlot}%0A` +
      `*Pago:* ${order.paymentMethod}%0A` +
      (order.instructions ? `*Nota:* ${order.instructions}%0A` : '') +
      `%0A*--- PRODUCTOS ---*%0A` +
      `${itemsList}%0A%0A` +
      `*Total a Pagar:* $${order.total.toFixed(2)}`;

    return `https://wa.me/${OWNER_PHONE}?text=${message}`;
  }
};
