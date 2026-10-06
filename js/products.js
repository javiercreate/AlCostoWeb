// Tasas de cambio multimoneda (USD base, Bs y COP)
let CURRENCY_RATES = {
  USD: 1,
  BS: 860.18,   // Tasa oficial Banco Central de Venezuela
  COP: 3800     // Tasa actual de COP
};

// Cargar tasas dinámicas guardadas en localStorage
(function loadSavedRates() {
  try {
    const saved = localStorage.getItem('alcosto_rates');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.BS) CURRENCY_RATES.BS = parseFloat(parsed.BS);
      if (parsed.COP) CURRENCY_RATES.COP = parseFloat(parsed.COP);
    }
  } catch (e) {
    console.warn('No se pudieron leer tasas guardadas:', e);
  }
})();

function updateCurrencyRates(newBs, newCop, notify = true) {
  if (newBs && !isNaN(newBs) && parseFloat(newBs) > 0) {
    CURRENCY_RATES.BS = parseFloat(newBs);
  }
  if (newCop && !isNaN(newCop) && parseFloat(newCop) > 0) {
    CURRENCY_RATES.COP = parseFloat(newCop);
  }
  const payload = {
    USD: 1,
    BS: CURRENCY_RATES.BS,
    COP: CURRENCY_RATES.COP,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem('alcosto_rates', JSON.stringify(payload));
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alcosto:rates-updated', { detail: payload }));
  }
}

/**
 * Helper con timeout para llamadas de red seguras que no cuelgan el navegador
 */
async function fetchWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Consulta las tasas de cambio de Venezuela (Bs / VES) y Colombia (COP)
 * Prioriza Open Exchange API (con soporte oficial para VES y COP sin bloqueos)
 * y cuenta con fuentes de contingencia automáticas.
 */
async function syncDailyExchangeRates(force = false) {
  const today = new Date().toISOString().slice(0, 10);
  const lastSync = localStorage.getItem('alcosto_rates_last_sync');

  if (!force && lastSync === today) {
    return { success: true, rates: CURRENCY_RATES, fromCache: true };
  }

  let newBs = null;
  let newCop = null;

  // 1. Fuente Principal: Open Exchange API (devuelve VES y COP juntos, alta disponibilidad mundial)
  try {
    const res = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', 3500);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        if (data.rates.VES) {
          newBs = parseFloat(data.rates.VES);
        }
        if (data.rates.COP) {
          newCop = Math.round(parseFloat(data.rates.COP));
        }
      }
    }
  } catch (e) {
    // Continuar a fuentes de contingencia
  }

  // 2. Si falta VES o COP, probar con ExchangeRate-API V4
  if (!newBs || !newCop) {
    try {
      const resV4 = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD', 3500);
      if (resV4.ok) {
        const dataV4 = await resV4.json();
        if (dataV4 && dataV4.rates) {
          if (!newBs && dataV4.rates.VES) newBs = parseFloat(dataV4.rates.VES);
          if (!newCop && dataV4.rates.COP) newCop = Math.round(parseFloat(dataV4.rates.COP));
        }
      }
    } catch (e2) {}
  }

  // 3. Contingencia para tasa venezolana: DolarApi (con timeout seguro)
  if (!newBs) {
    try {
      const resOficial = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/oficial', 3000);
      if (resOficial.ok) {
        const dataOficial = await resOficial.json();
        if (dataOficial && dataOficial.promedio) {
          newBs = parseFloat(dataOficial.promedio);
        }
      }
    } catch (e3) {
      try {
        const resParalelo = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/paralelo', 3000);
        if (resParalelo.ok) {
          const dataPar = await resParalelo.json();
          if (dataPar && dataPar.promedio) {
            newBs = parseFloat(dataPar.promedio);
          }
        }
      } catch (e4) {}
    }
  }

  if (newBs || newCop) {
    updateCurrencyRates(newBs || CURRENCY_RATES.BS, newCop || CURRENCY_RATES.COP, true);
    localStorage.setItem('alcosto_rates_last_sync', today);
    return {
      success: true,
      bs: CURRENCY_RATES.BS,
      cop: CURRENCY_RATES.COP,
      updatedAt: new Date().toLocaleString()
    };
  } else {
    return {
      success: false,
      message: 'No se pudo contactar con los servidores de tasa del día, se mantuvieron las tasas actuales.'
    };
  }
}

// Iniciar sincronización automática diaria al cargar la página
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncDailyExchangeRates(false).catch(() => {});
  }, 1000);
}

function formatMultiPrice(priceInUSD) {
  const usd = parseFloat(priceInUSD || 0);
  const bs = (usd * CURRENCY_RATES.BS).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cop = Math.round(usd * CURRENCY_RATES.COP).toLocaleString('es-CO');
  return {
    usd: `$${usd.toFixed(2)}`,
    bs: `${bs} Bs`,
    cop: `${cop} COP`,
    rawUsd: usd,
    rawBs: usd * CURRENCY_RATES.BS,
    rawCop: usd * CURRENCY_RATES.COP
  };
}

const CATEGORIES = [
  { id: 'todos', name: 'Todos', icon: 'fa-solid fa-border-all', badge: 'Catálogo' },
  { id: 'al-mayor', name: 'Al Mayor', icon: 'fa-solid fa-boxes-stacked', badge: 'Ahorro Bulto' },
  { id: 'charcuteria', name: 'Charcutería', icon: 'fa-solid fa-bacon', badge: 'Fresco' },
  { id: 'viveres', name: 'Víveres', icon: 'fa-solid fa-wheat-awn', badge: 'Básicos' },
  { id: 'lacteos', name: 'Lácteos', icon: 'fa-solid fa-cheese', badge: 'Frescura' },
  { id: 'bebidas', name: 'Bebidas', icon: 'fa-solid fa-bottle-water', badge: 'Frías' },
  { id: 'confiteria', name: 'Confitería', icon: 'fa-solid fa-candy-cane', badge: 'Snacks' },
  { id: 'limpieza', name: 'Limpieza', icon: 'fa-solid fa-pump-soap', badge: 'Aseo' }
];

const PROMOS = [
  {
    code: 'ALCOSTO10',
    discount: 10,
    type: 'percent',
    minOrder: 25,
    description: '10% de descuento en tu primera compra (mínimo $25)'
  },
  {
    code: 'ENVIOGRATIS',
    discount: 3.99,
    type: 'shipping',
    minOrder: 35,
    description: 'Envío gratis en compras mayores a $35'
  },
  {
    code: 'MAYORISTA',
    discount: 15,
    type: 'percent',
    minOrder: 60,
    description: '15% de descuento adicional en pedidos mayoristas de más de $60'
  }
];

// ==========================================================================
// CATÁLOGO BASE MAESTRO Y ALMACENAMIENTO DINÁMICO
// Catálogo predeterminado cargado directamente en products.js.
// Si el usuario edita o agrega productos en el panel admin (admin.html),
// se guardan en localStorage y se sincronizan en tiempo real.
// ==========================================================================

const DEFAULT_PRODUCTS = [
  // --- VÍVERES Y GRANOS ---
  {
    id: 'viv-01',
    name: 'Harina de Maíz Blanco P.A.N. 1kg',
    category: 'viveres',
    price: 1.25,
    originalPrice: 1.45,
    wholesalePrice: 1.10,
    wholesaleMin: 10,
    unit: 'Paquete 1kg',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
    badge: '🔥 Más Vendido',
    description: 'Harina de maíz blanco precocida tradicional, ideal para arepas doradas, empanadas y hallacas venezolanas.',
    origin: 'Nacional 🇻🇪',
    rating: 4.9,
    reviewsCount: 142,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'viv-02',
    name: 'Arroz Blanco de Mesa Mary Esmeralda 1kg',
    category: 'viveres',
    price: 1.30,
    originalPrice: 1.50,
    wholesalePrice: 1.15,
    wholesaleMin: 12,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
    badge: 'Básico',
    description: 'Granos enteros seleccionados de primera calidad, cocción suave y suelta para tus comidas diarias.',
    origin: 'Nacional 🇻🇪',
    rating: 4.8,
    reviewsCount: 89,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'viv-03',
    name: 'Pasta Larga Spaghetti Primor 1kg',
    category: 'viveres',
    price: 1.40,
    originalPrice: 1.65,
    wholesalePrice: 1.20,
    wholesaleMin: 12,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=500&auto=format&fit=crop&q=80',
    badge: 'Oferta',
    description: 'Sémola 100% de trigo durum seleccionada. Textura al dente y sabor consistente para toda la familia.',
    origin: 'Nacional 🇻🇪',
    rating: 4.7,
    reviewsCount: 64,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'viv-04',
    name: 'Aceite Puro de Maíz Mazeite 1 Litro',
    category: 'viveres',
    price: 3.20,
    originalPrice: 3.65,
    wholesalePrice: 2.85,
    wholesaleMin: 6,
    unit: 'Botella 1L',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
    badge: 'Calidad Oro',
    description: 'Aceite vegetal refinado de maíz, libre de colesterol y rico en vitamina E. Ideal para freír y cocinar.',
    origin: 'Nacional 🇻🇪',
    rating: 4.9,
    reviewsCount: 110,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'viv-05',
    name: 'Caraotas Negras Criollas Seleccionadas 1kg',
    category: 'viveres',
    price: 1.85,
    originalPrice: 2.10,
    wholesalePrice: 1.60,
    wholesaleMin: 10,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?w=500&auto=format&fit=crop&q=80',
    badge: 'Granos',
    description: 'Granos negros limpios de fácil cocción, caldo espeso y rico en proteínas y hierro.',
    origin: 'Nacional 🇻🇪',
    rating: 4.8,
    reviewsCount: 52,
    isWholesale: false,
    inStock: true
  },

  // --- CHARCUTERÍA Y EMBUTIDOS ---
  {
    id: 'char-01',
    name: 'Queso Blanco Llanero Criollo Duro 1kg',
    category: 'charcuteria',
    price: 5.20,
    originalPrice: 5.90,
    wholesalePrice: 4.60,
    wholesaleMin: 5,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=500&auto=format&fit=crop&q=80',
    badge: '🧀 Fresco del Día',
    description: 'Punto exacto de sal para rallar en arepas, empanadas o tostones. Elaborado artesanalmente con leche fresca.',
    origin: 'Llanos Venezolanos 🇻🇪',
    rating: 5.0,
    reviewsCount: 215,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'char-02',
    name: 'Jamón Cocido Superior de Pierna Plumrose 1kg',
    category: 'charcuteria',
    price: 7.90,
    originalPrice: 8.80,
    wholesalePrice: 7.10,
    wholesaleMin: 3,
    unit: '1 kg (Rebanado)',
    image: 'https://images.unsplash.com/photo-1524438418049-ab2acb7aa48f?w=500&auto=format&fit=crop&q=80',
    badge: 'Premium',
    description: 'Jamón cocido de pierna entera de cerdo, tierno, bajo en grasa y rebanado al momento con empaque hermético.',
    origin: 'Nacional 🇻🇪',
    rating: 4.9,
    reviewsCount: 98,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'char-03',
    name: 'Mortadela Especial Tapara La Monserratina 1kg',
    category: 'charcuteria',
    price: 3.75,
    originalPrice: 4.20,
    wholesalePrice: 3.20,
    wholesaleMin: 5,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
    badge: 'Económico',
    description: 'Embutido clásico condimentado con especias naturales, ideal para desayunos, cenas y meriendas.',
    origin: 'Nacional 🇻🇪',
    rating: 4.6,
    reviewsCount: 47,
    isWholesale: false,
    inStock: true
  },

  // --- LÁCTEOS Y QUESOS ---
  {
    id: 'lac-01',
    name: 'Queso Amarillo Tipo Gouda Torondoy 500g',
    category: 'lacteos',
    price: 4.50,
    originalPrice: 5.20,
    wholesalePrice: 3.95,
    wholesaleMin: 4,
    unit: 'Pieza 500g',
    image: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=500&auto=format&fit=crop&q=80',
    badge: 'Gouda Criollo',
    description: 'Sabor madurado, textura suave y fundido perfecto para sándwiches, pastas y hamburguesas.',
    origin: 'Mérida 🇻🇪',
    rating: 4.9,
    reviewsCount: 76,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'lac-02',
    name: 'Margarina Mavesa con Sal Clásica 500g',
    category: 'lacteos',
    price: 2.80,
    originalPrice: 3.10,
    wholesalePrice: 2.45,
    wholesaleMin: 6,
    unit: 'Pote 500g',
    image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&auto=format&fit=crop&q=80',
    badge: 'Tradición',
    description: 'Suavidad inconfundible y el toque perfecto de sal para tus arepas calientes y tostadas.',
    origin: 'Nacional 🇻🇪',
    rating: 4.8,
    reviewsCount: 88,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'lac-03',
    name: 'Leche Completa en Polvo La Campiña 900g',
    category: 'lacteos',
    price: 8.60,
    originalPrice: 9.70,
    wholesalePrice: 7.90,
    wholesaleMin: 4,
    unit: 'Lata/Bolsa 900g',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
    badge: 'Nutritiva',
    description: 'Enriquecida con vitaminas A y D, disolución instantánea y sabor cremoso incomparable.',
    origin: 'Nacional 🇻🇪',
    rating: 4.9,
    reviewsCount: 104,
    isWholesale: false,
    inStock: true
  },

  // --- VENTAS AL MAYOR 📦 ---
  {
    id: 'may-01',
    name: 'Bulto Harina P.A.N. Maíz Blanco (20 x 1kg)',
    category: 'al-mayor',
    price: 21.90,
    originalPrice: 24.50,
    wholesalePrice: 20.50,
    wholesaleMin: 1,
    unit: 'Bulto 20 Unidades',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
    badge: '📦 Super Mayorista',
    description: 'Fardo completo cerrado de 20 paquetes de 1kg. El mayor ahorro para bodegas, restaurantes y despensas familiares.',
    origin: 'Distribuidor Mayorista 🏭',
    rating: 5.0,
    reviewsCount: 180,
    isWholesale: true,
    inStock: true
  },
  {
    id: 'may-02',
    name: 'Fardo Arroz Mary Esmeralda (24 x 1kg)',
    category: 'al-mayor',
    price: 26.50,
    originalPrice: 29.90,
    wholesalePrice: 24.90,
    wholesaleMin: 1,
    unit: 'Fardo 24 Unidades',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
    badge: '📦 Precio Distribuidor',
    description: 'Bulto mayorista de arroz de primera calidad. Máximo rendimiento por kilo y garantía sellada de fábrica.',
    origin: 'Distribuidor Mayorista 🏭',
    rating: 4.9,
    reviewsCount: 132,
    isWholesale: true,
    inStock: true
  },
  {
    id: 'may-03',
    name: 'Caja Aceite Mazeite Puro de Maíz (12 x 1L)',
    category: 'al-mayor',
    price: 34.00,
    originalPrice: 38.50,
    wholesalePrice: 32.50,
    wholesaleMin: 1,
    unit: 'Caja 12 Botellas',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
    badge: '📦 Ahorro Bulto',
    description: 'Caja de 12 litros de aceite Mazeite. Precio directo de paleta para abastecimiento comercial.',
    origin: 'Distribuidor Mayorista 🏭',
    rating: 4.8,
    reviewsCount: 67,
    isWholesale: true,
    inStock: true
  },

  // --- BEBIDAS Y REFRESCOS ---
  {
    id: 'beb-01',
    name: 'Refresco Coca-Cola Sabor Original 2 Litros',
    category: 'bebidas',
    price: 2.10,
    originalPrice: 2.50,
    wholesalePrice: 1.85,
    wholesaleMin: 6,
    unit: 'Botella 2L',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80',
    badge: 'Fría',
    description: 'La bebida refrescante favorita para acompañar tus almuerzos, reuniones y celebraciones.',
    origin: 'Nacional 🇻🇪',
    rating: 4.9,
    reviewsCount: 153,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'beb-02',
    name: 'Malta Polar Familiar 1.5 Litros',
    category: 'bebidas',
    price: 1.95,
    originalPrice: 2.30,
    wholesalePrice: 1.70,
    wholesaleMin: 6,
    unit: 'Botella 1.5L',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
    badge: 'Energía Natural',
    description: 'Bebida de malta nutritiva y energizante, refrescante y adorada por toda la familia venezolana.',
    origin: 'Nacional 🇻🇪',
    rating: 4.9,
    reviewsCount: 119,
    isWholesale: false,
    inStock: true
  },

  // --- CONFITERÍA Y DULCES ---
  {
    id: 'cnf-01',
    name: 'Chocolate Savoy Carré con Almendras 100g',
    category: 'confiteria',
    price: 1.85,
    originalPrice: 2.20,
    wholesalePrice: 1.55,
    wholesaleMin: 10,
    unit: 'Tableta 100g',
    image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=80',
    badge: '🍫 Puro Cacao',
    description: 'Cacao venezolano premium con crujientes trozos de almendra entera seleccionada.',
    origin: 'Nacional 🇻🇪',
    rating: 5.0,
    reviewsCount: 94,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'cnf-02',
    name: 'Galletas Susy Paquete Familiar (Pack 6u)',
    category: 'confiteria',
    price: 2.25,
    originalPrice: 2.70,
    wholesalePrice: 1.90,
    wholesaleMin: 6,
    unit: 'Pack 6 Unidades',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    badge: 'Snacks',
    description: 'Obleas rellenas con deliciosa crema de chocolate. La merienda venezolana consentida de siempre.',
    origin: 'Nacional 🇻🇪',
    rating: 4.8,
    reviewsCount: 82,
    isWholesale: false,
    inStock: true
  },

  // --- LIMPIEZA Y HOGAR ---
  {
    id: 'lim-01',
    name: 'Detergente en Polvo Las Llaves Limón 1kg',
    category: 'limpieza',
    price: 2.65,
    originalPrice: 3.10,
    wholesalePrice: 2.25,
    wholesaleMin: 8,
    unit: 'Bolsa 1kg',
    image: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=500&auto=format&fit=crop&q=80',
    badge: 'Poder Activo',
    description: 'Fórmula ultra activa que remueve grasa difícil y deja tu ropa impecable con aroma a limón fresco.',
    origin: 'Nacional 🇻🇪',
    rating: 4.7,
    reviewsCount: 65,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'lim-02',
    name: 'Lavaplatos Líquido Axion Limón Desengrasante 750ml',
    category: 'limpieza',
    price: 2.40,
    originalPrice: 2.80,
    wholesalePrice: 2.05,
    wholesaleMin: 6,
    unit: 'Botella 750ml',
    image: 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=500&auto=format&fit=crop&q=80',
    badge: '100% Grasa',
    description: 'Corta la grasa al instante con una sola gota, protegiendo tus manos y rindiendo el doble.',
    origin: 'Nacional 🇻🇪',
    rating: 4.8,
    reviewsCount: 54,
    isWholesale: false,
    inStock: true
  },

  // --- CARNES Y AVES ---
  {
    id: 'car-01',
    name: 'Pechuga de Pollo Fresca sin Hueso 1kg',
    category: 'carnes-pescados',
    price: 4.60,
    originalPrice: 5.20,
    wholesalePrice: 4.10,
    wholesaleMin: 5,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&auto=format&fit=crop&q=80',
    badge: '🥩 Magro & Fresco',
    description: 'Fileteada o entera, carne blanca fresca de granjas inspeccionadas y con rigurosa cadena de frío.',
    origin: 'Granjas del Centro 🇻🇪',
    rating: 4.9,
    reviewsCount: 112,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'car-02',
    name: 'Carne Molida Especial de Primera 1kg',
    category: 'carnes-pescados',
    price: 7.20,
    originalPrice: 7.90,
    wholesalePrice: 6.60,
    wholesaleMin: 4,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=500&auto=format&fit=crop&q=80',
    badge: 'Corte Limpio',
    description: 'Carne magra molida al instante, ideal para pastichos, albóndigas, hamburguesas y guisos caseros.',
    origin: 'Ganado Venezolano 🇻🇪',
    rating: 4.8,
    reviewsCount: 88,
    isWholesale: false,
    inStock: true
  },

  // --- FRUTAS Y VERDURAS ---
  {
    id: 'fru-01',
    name: 'Aguacates Criollos Mantecosos 1kg',
    category: 'frutas-verduras',
    price: 2.30,
    originalPrice: 2.80,
    wholesalePrice: 1.95,
    wholesaleMin: 5,
    unit: '1 kg (aprox 2-3u)',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&auto=format&fit=crop&q=80',
    badge: '🥑 Campo Fresco',
    description: 'Pulpa mantecosa y cremosa, textura perfecta para ensaladas, arepas reina pepiada o guasacaca.',
    origin: 'Andes y Valles 🇻🇪',
    rating: 5.0,
    reviewsCount: 78,
    isWholesale: false,
    inStock: true
  },
  {
    id: 'fru-02',
    name: 'Plátanos Maduros Dulces de Primera (Mano 5u)',
    category: 'frutas-verduras',
    price: 1.50,
    originalPrice: 1.80,
    wholesalePrice: 1.25,
    wholesaleMin: 4,
    unit: 'Mano 5 Unidades',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80',
    badge: 'Dulzor Natural',
    description: 'Plátanos en el punto óptimo de maduración para tajadas doradas, tostones o asados con queso.',
    origin: 'Sur del Lago 🇻🇪',
    rating: 4.9,
    reviewsCount: 95,
    isWholesale: false,
    inStock: true
  }
];

// Hacer disponible DEFAULT_PRODUCTS globalmente para sincronización o restauración
if (typeof window !== 'undefined') {
  window.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;
}

var PRODUCTS_DATA = [];

// Función para obtener productos activos (carga de localStorage si tiene datos válidos, y si no, carga products.js)
function getActiveProducts() {
  try {
    const saved = localStorage.getItem('alcosto_custom_products');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        PRODUCTS_DATA = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error al leer productos de localStorage:', e);
  }

  // Cargar catálogo predeterminado de products.js
  PRODUCTS_DATA = [...DEFAULT_PRODUCTS];
  return PRODUCTS_DATA;
}

// Guardar productos y sincronizar instantáneamente con todas las pestañas de index.html
function saveActiveProducts(productsList) {
  if (!Array.isArray(productsList)) return;
  try {
    localStorage.setItem('alcosto_custom_products', JSON.stringify(productsList));
  } catch (quotaError) {
    console.warn('Alcanzado límite de localStorage, optimizando imágenes...', quotaError);
    // Si la cuota de localStorage se llena por fotos pesadas, aseguramos que los datos se guarden
    const optimized = productsList.map(p => {
      if (p.image && p.image.length > 200000 && p.image.startsWith('data:image')) {
        return { ...p, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80' };
      }
      return p;
    });
    try {
      localStorage.setItem('alcosto_custom_products', JSON.stringify(optimized));
    } catch (e2) {
      console.error('Error crítico guardando productos:', e2);
    }
  }
  PRODUCTS_DATA = productsList;

  // Notificar en la ventana actual y en otras ventanas/pestañas
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alcosto:products-updated', { detail: productsList }));
    try {
      if (window.BroadcastChannel) {
        const bc = new BroadcastChannel('alcosto_sync_channel');
        bc.postMessage({ type: 'products_updated', timestamp: Date.now() });
        bc.close();
      }
    } catch (e) {}
  }
}

// La tienda carga su catálogo desde Supabase; los productos locales quedan para el admin.
PRODUCTS_DATA = [];

// Ubicación y Coordenadas del Local Al Costo
const STORE_COORDINATES = '7º48\'25.6"N 71º11\'12.3"W';
const STORE_MAPS_URL = 'https://www.google.com/maps?q=7.807111,-71.186750';

// Direcciones preconfiguradas para entrega rápida
const PRESET_ADDRESSES = [
  { 
    id: 'addr-delivery', 
    label: 'Entrega a Domicilio', 
    address: 'Configura tu dirección en "Mis Datos"', 
    zip: '5101', 
    timeEst: '25-45 min' 
  },
  { 
    id: 'addr-pickup', 
    label: 'Recoger en Tienda Al Costo (Gratis)', 
    address: `Sede Al Costo (Coords: ${STORE_COORDINATES})`, 
    zip: '5101', 
    timeEst: 'Listo en 15 min',
    coords: STORE_COORDINATES,
    mapsUrl: STORE_MAPS_URL
  }
];