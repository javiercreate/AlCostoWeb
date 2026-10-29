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

const DEFAULT_PRODUCTS = [];

// Hacer disponible DEFAULT_PRODUCTS globalmente para sincronización o restauración
if (typeof window !== 'undefined') {
  window.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;
}

// ==========================================================================
// LISTA NEGRA DE PRODUCTOS PREDETERMINADOS (DEMO) ELIMINADOS
// Estos 24 productos fueron creados por una IA anterior, sembrados en
// Supabase y borrados definitivamente el 2026-10-12. Este bloqueo evita
// que reaparezcan por cualquier vía: localStorage del admin, catálogo base,
// respaldos JSON importados o sincronizaciones con Supabase.
// Solo existirán los productos cargados manualmente por el dueño (prod-XXXX).
// ==========================================================================
const LEGACY_DEFAULT_PRODUCT_IDS = [
  'viv-01', 'viv-02', 'viv-03', 'viv-04', 'viv-05',
  'char-01', 'char-02', 'char-03',
  'lac-01', 'lac-02', 'lac-03',
  'may-01', 'may-02', 'may-03',
  'beb-01', 'beb-02',
  'cnf-01', 'cnf-02',
  'lim-01', 'lim-02',
  'car-01', 'car-02',
  'fru-01', 'fru-02'
];

if (typeof window !== 'undefined') {
  window.LEGACY_DEFAULT_PRODUCT_IDS = LEGACY_DEFAULT_PRODUCT_IDS;
}

function isLegacyDefaultProduct(product) {
  if (!product) return false;
  const id = (typeof product === 'string') ? product : product.id;
  if (typeof id === 'string' && LEGACY_DEFAULT_PRODUCT_IDS.indexOf(id) !== -1) return true;

  // BLOQUEO 2: los 400 "Producto de prueba" (IDs test-XXXX) fueron sembrados por
  // una prueba automatizada y borrados de Supabase el 2026-10-18. Nunca deben
  // mostrarse ni republicarse aunque reaparezcan en la base de datos.
  if (typeof id === 'string' && /^test-\d+$/i.test(id)) return true;
  const name = (product && typeof product === 'object' && typeof product.name === 'string') ? product.name : '';
  return /^producto de prueba\b/i.test(name);
}

// Filtra una lista eliminando cualquier producto demo predeterminado
function stripLegacyDefaultProducts(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(p => !isLegacyDefaultProduct(p));
}

// ==========================================================================
// FOTO GENÉRICA ANTIGUA DE PRODUCTO (ELIMINADA DEL CÓDIGO)
// La imagen de mercado de Unsplash se usaba en la plantilla original como
// foto predeterminada y de respaldo de los productos. Ya no se usa en ninguna
// parte: los productos sin foto (o guardados con esa imagen) se muestran con
// el placeholder local img/producto-sin-foto.svg.
// ==========================================================================
const LEGACY_DEFAULT_IMAGE_PATTERN = /images\.unsplash\.com\/photo-1542838132-92c53300491e/i;
const PRODUCT_IMAGE_PLACEHOLDER = 'img/producto-sin-foto.svg';

// Devuelve '' cuando la imagen falta o es la foto genérica antigua
function sanitizeProductImage(url) {
  if (typeof url !== 'string') return '';
  const clean = url.trim();
  if (!clean || LEGACY_DEFAULT_IMAGE_PATTERN.test(clean)) return '';
  return clean;
}

// Limpia las fotos genéricas antiguas de una lista completa de productos
function sanitizeProductImages(list) {
  if (!Array.isArray(list)) return [];
  return list.map(p => {
    if (!p || typeof p !== 'object') return p;
    return { ...p, image: sanitizeProductImage(p.image) };
  });
}

// URL a pintar en la interfaz: placeholder local si no hay foto válida
function getProductImageSrc(url) {
  return sanitizeProductImage(url) || PRODUCT_IMAGE_PLACEHOLDER;
}

var PRODUCTS_DATA = [];

// Función para obtener productos activos (carga de localStorage si tiene datos válidos, y si no, carga products.js)
function getActiveProducts() {
  try {
    const saved = localStorage.getItem('alcosto_custom_products');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Bloqueo: si en este navegador aún quedan productos demo guardados, se descartan
        PRODUCTS_DATA = sanitizeProductImages(stripLegacyDefaultProducts(parsed));
        if (PRODUCTS_DATA.length > 0) return PRODUCTS_DATA;
      }
    }
  } catch (e) {
    console.warn('Error al leer productos de localStorage:', e);
  }

  // Cargar catálogo base de products.js (hoy vacío: solo existen productos cargados manualmente por el dueño)
  PRODUCTS_DATA = sanitizeProductImages(stripLegacyDefaultProducts(DEFAULT_PRODUCTS));
  return PRODUCTS_DATA;
}

// ==========================================================================
// COMPRESIÓN DE IMÁGENES ANTES DE PERSISTIR (localStorage / base de datos)
// Toda foto en base64 que vaya a guardarse se re-dimensiona con un lienzo
// HTML5 a un máximo de 600 x 600 px y se exporta en image/webp (o image/jpeg
// como respaldo) con calidad 0.8. Esto mantiene cada foto por debajo de
// ~60-80 KB y evita el QuotaExceededError de localStorage.
// ==========================================================================
const STORAGE_IMAGE_MAX_DIM = 600;
const STORAGE_IMAGE_QUALITY = 0.8;
// Umbral en caracteres del dataURL (~100K caracteres base64 ≈ 75 KB binarios)
const STORAGE_HEAVY_IMAGE_CHARS = 100 * 1024;

function loadImageFromDataUrlForStorage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
    img.src = dataUrl;
  });
}

// Re-dimensiona (máx. 600 x 600 px) y comprime una foto base64 con Canvas
async function compressImageForStorage(dataUrl) {
  const img = await loadImageFromDataUrlForStorage(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) return dataUrl;

  const scale = Math.min(1, STORAGE_IMAGE_MAX_DIM / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // WebP comprime mucho mejor conservando la transparencia; JPEG es el respaldo
  try {
    const webp = canvas.toDataURL('image/webp', STORAGE_IMAGE_QUALITY);
    if (webp.indexOf('data:image/webp') === 0) return webp;
  } catch (e) {}
  return canvas.toDataURL('image/jpeg', STORAGE_IMAGE_QUALITY);
}

function isHeavyStorageImage(image) {
  return typeof image === 'string' &&
    image.indexOf('data:image') === 0 &&
    image.length > STORAGE_HEAVY_IMAGE_CHARS;
}

// Comprime en paralelo todas las fotos pesadas de una lista de productos
async function compressProductsImagesForStorage(list) {
  if (!Array.isArray(list)) return [];
  const compressed = await Promise.all(list.map(async (p) => {
    if (!p || typeof p !== 'object' || !isHeavyStorageImage(p.image)) return p;
    try {
      const smaller = await compressImageForStorage(p.image);
      return (smaller && smaller.length < p.image.length) ? { ...p, image: smaller } : p;
    } catch (err) {
      console.warn(`No se pudo comprimir la foto de "${p.name || p.id}":`, err);
      return p;
    }
  }));
  return compressed;
}

// Secuencia de escrituras: un guardado lento (compresión async) que llegue
// tarde nunca pisa a uno más reciente ya persistido.
let activeProductsSaveSeq = 0;

// Guardar productos y sincronizar instantáneamente con todas las pestañas de index.html
function saveActiveProducts(productsList) {
  if (!Array.isArray(productsList)) return;
  // Bloqueo: jamás permitir que productos demo predeterminados se guarden o republicuen
  productsList = sanitizeProductImages(stripLegacyDefaultProducts(productsList));
  PRODUCTS_DATA = productsList;

  const seq = ++activeProductsSaveSeq;
  const hasHeavyImages = productsList.some(p => isHeavyStorageImage(p && p.image));

  if (!hasHeavyImages) {
    // Ruta rápida: las fotos ya están por debajo del límite, se guarda de inmediato
    persistActiveProducts(productsList, seq);
  } else {
    // Fotos pesadas: comprimir con Canvas ANTES de escribir en localStorage
    console.info('Comprimiendo fotos del catálogo a máx. 600 x 600 px (WebP/JPEG 0.8) antes de guardar...');
    compressProductsImagesForStorage(productsList)
      .then((list) => {
        if (seq !== activeProductsSaveSeq) return; // un guardado más reciente ya ganó
        persistActiveProducts(list, seq);
      })
      .catch((err) => {
        console.warn('No se pudieron comprimir las fotos, se intenta guardar sin comprimir:', err);
        if (seq === activeProductsSaveSeq) persistActiveProducts(productsList, seq);
      });
  }
}

function persistActiveProducts(productsList, seq) {
  try {
    localStorage.setItem('alcosto_custom_products', JSON.stringify(productsList));
  } catch (quotaError) {
    console.warn('Alcanzado límite de localStorage, optimizando imágenes...', quotaError);
    // Último recurso: se descartan las fotos aún pesadas para no perder el catálogo
    const optimized = productsList.map(p => {
      if (p && isHeavyStorageImage(p.image)) {
        return { ...p, image: '' };
      }
      return p;
    });
    try {
      localStorage.setItem('alcosto_custom_products', JSON.stringify(optimized));
      productsList = optimized;
    } catch (e2) {
      console.error('Error crítico guardando productos:', e2);
    }
  }
  if (seq !== activeProductsSaveSeq) return;

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
