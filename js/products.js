// Tasas de cambio multimoneda (USD base, Bs y COP)
let CURRENCY_RATES = {
  USD: 1,
  BS: 860.18,   // Tasa oficial Banco Central de Venezuela
  COP: 3800     // Tasa actual de COP
};

// Cargar tasas dinÃ¡micas guardadas en localStorage
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
 * y cuenta con fuentes de contingencia automÃ¡ticas.
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
      message: 'No se pudo contactar con los servidores de tasa del dÃ­a, se mantuvieron las tasas actuales.'
    };
  }
}

// Iniciar sincronizaciÃ³n automÃ¡tica diaria al cargar la pÃ¡gina
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
  { id: 'todos', name: 'Todos', icon: 'fa-solid fa-border-all', badge: 'CatÃ¡logo' },
  { id: 'al-mayor', name: 'Al Mayor', icon: 'fa-solid fa-boxes-stacked', badge: 'Ahorro Bulto' },
  { id: 'charcuteria', name: 'CharcuterÃ­a', icon: 'fa-solid fa-bacon', badge: 'Fresco' },
  { id: 'viveres', name: 'VÃ­veres', icon: 'fa-solid fa-wheat-awn', badge: 'BÃ¡sicos' },
  { id: 'lacteos', name: 'LÃ¡cteos', icon: 'fa-solid fa-cheese', badge: 'Frescura' },
  { id: 'bebidas', name: 'Bebidas', icon: 'fa-solid fa-bottle-water', badge: 'FrÃ­as' },
  { id: 'confiteria', name: 'ConfiterÃ­a', icon: 'fa-solid fa-candy-cane', badge: 'Snacks' },
  { id: 'limpieza', name: 'Limpieza', icon: 'fa-solid fa-pump-soap', badge: 'Aseo' }
];

const PROMOS = [
  {
    code: 'ALCOSTO10',
    discount: 10,
    type: 'percent',
    minOrder: 25,
    description: '10% de descuento en tu primera compra (mÃ­nimo $25)'
  },
  {
    code: 'ENVIOGRATIS',
    discount: 3.99,
    type: 'shipping',
    minOrder: 35,
    description: 'EnvÃ­o gratis en compras mayores a $35'
  },
  {
    code: 'MAYORISTA',
    discount: 15,
    type: 'percent',
    minOrder: 60,
    description: '15% de descuento adicional en pedidos mayoristas de mÃ¡s de $60'
  }
];

// ==========================================================================
// CATÃLOGO BASE MAESTRO Y ALMACENAMIENTO DINÃMICO
// CatÃ¡logo predeterminado cargado directamente en products.js.
// Si el usuario edita o agrega productos en el panel admin (admin.html),
// se guardan en localStorage y se sincronizan en tiempo real.
// ==========================================================================

const DEFAULT_PRODUCTS = [];

// Hacer disponible DEFAULT_PRODUCTS globalmente para sincronizaciÃ³n o restauraciÃ³n
if (typeof window !== 'undefined') {
  window.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;
}

var PRODUCTS_DATA = [];

// FunciÃ³n para obtener productos activos (carga de localStorage si tiene datos vÃ¡lidos, y si no, carga products.js)
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

  // Cargar catÃ¡logo predeterminado de products.js
  PRODUCTS_DATA = [...DEFAULT_PRODUCTS];
  return PRODUCTS_DATA;
}

// Guardar productos y sincronizar instantÃ¡neamente con todas las pestaÃ±as de index.html
function saveActiveProducts(productsList) {
  if (!Array.isArray(productsList)) return;
  try {
    localStorage.setItem('alcosto_custom_products', JSON.stringify(productsList));
  } catch (quotaError) {
    console.warn('Alcanzado lÃ­mite de localStorage, optimizando imÃ¡genes...', quotaError);
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
      console.error('Error crÃ­tico guardando productos:', e2);
    }
  }
  PRODUCTS_DATA = productsList;

  // Notificar en la ventana actual y en otras ventanas/pestaÃ±as
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

// La tienda carga su catÃ¡logo desde Supabase; los productos locales quedan para el admin.
PRODUCTS_DATA = [];

// UbicaciÃ³n y Coordenadas del Local Al Costo
const STORE_COORDINATES = '7Âº48\'25.6"N 71Âº11\'12.3"W';
const STORE_MAPS_URL = 'https://www.google.com/maps?q=7.807111,-71.186750';

// Direcciones preconfiguradas para entrega rÃ¡pida
const PRESET_ADDRESSES = [
  { 
    id: 'addr-delivery', 
    label: 'Entrega a Domicilio', 
    address: 'Configura tu direcciÃ³n en "Mis Datos"',
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
