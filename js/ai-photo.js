// ==========================================================================
// IA DE FOTO DE PRODUCTO - REMOCIÓN DE FONDO + COMPRESIÓN (SOLO NAVEGADOR)
// --------------------------------------------------------------------------
// - Motor gratuito ejecutado en el cliente: @imgly/background-removal vía CDN
//   (jsDelivr +esm). No usa APIs de pago ni envía la foto a servidores propios.
// - La primera vez descarga el modelo (~42 MB) y el motor WebAssembly (~11 MB);
//   después el navegador los guarda en caché y todo es instantáneo.
// - Si la IA no está disponible (sin red, navegador antiguo, error de carga)
//   se aplica automáticamente un recorte básico de fondo oscuro (mismo criterio
//   que ya usaba el panel para imágenes con fondo negro).
// - Salida optimizada para e-commerce: máximo 800x800 px, formato WebP (con
//   transparencia) o PNG como respaldo, siempre que sea posible < 200 KB.
// ==========================================================================

(function (global) {
  'use strict';

  const IMGLY_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
  const DEFAULT_MAX_DIMENSION = 800;
  const DEFAULT_MAX_BYTES = 200 * 1024; // 200 KB
  const AI_MODEL = 'isnet_quint8'; // modelo ligero (~42 MB) tras la primera descarga
  const QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7, 0.62, 0.54, 0.46, 0.4];
  const SCALE_STEPS = [1, 0.85, 0.7, 0.58, 0.48];

  let bgRemovalModulePromise = null;

  // --------------------------------------------------------------------------
  // Carga perezosa del módulo de IA (solo cuando se necesita, una sola vez)
  // --------------------------------------------------------------------------
  function loadBackgroundRemoval() {
    if (!bgRemovalModulePromise) {
      bgRemovalModulePromise = import(IMGLY_MODULE_URL)
        .then((mod) => {
          if (!mod || typeof mod.removeBackground !== 'function') {
            throw new Error('El módulo de IA no expone removeBackground');
          }
          return mod;
        })
        .catch((err) => {
          bgRemovalModulePromise = null; // permitir reintento en la siguiente foto
          throw err;
        });
    }
    return bgRemovalModulePromise;
  }

  // --------------------------------------------------------------------------
  // Mensajes legibles de progreso (descarga del modelo + pasos de inferencia)
  // --------------------------------------------------------------------------
  function describeProgress(key, current, total) {
    const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;

    if (typeof key === 'string' && key.indexOf('fetch:') === 0) {
      const resource = key.slice('fetch:'.length);
      if (resource.indexOf('/models/') > -1) {
        return `Descargando modelo de IA ${pct}% · 42 MB la primera vez (queda en caché)`;
      }
      if (resource.indexOf('ort-wasm') > -1) {
        return `Descargando motor de cálculo ${pct}% · queda guardado en tu navegador`;
      }
      return `Descargando componentes de IA ${pct}%`;
    }

    switch (key) {
      case 'compute:decode':
        return 'Leyendo la foto capturada...';
      case 'compute:inference':
        return 'Detectando el producto con la IA...';
      case 'compute:mask':
        return 'Recortando el fondo...';
      case 'compute:encode':
        return 'Generando imagen con fondo transparente...';
      default:
        return 'Procesando recorte con IA...';
    }
  }

  // --------------------------------------------------------------------------
  // Utilidades de decodificación de imagen
  // --------------------------------------------------------------------------
  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = src;
    });
  }

  // Normaliza cualquier fuente (File/Blob, canvas, Image, ImageBitmap o URL/dataURL)
  async function toDrawable(source) {
    if (!source) throw new Error('No hay imagen para procesar');

    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) return source;
    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) return source;

    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      if (typeof createImageBitmap === 'function') {
        try {
          return await createImageBitmap(source);
        } catch (err) {
          console.warn('createImageBitmap falló, se usa <img>:', err);
        }
      }
      const url = URL.createObjectURL(source);
      try {
        return await loadImageElement(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
      if (!source.complete || source.naturalWidth === 0) {
        try {
          if (typeof source.decode === 'function') await source.decode();
        } catch (err) {
          console.warn('La imagen terminó en estado incompleto:', err);
        }
      }
      return source;
    }

    if (typeof source === 'string') return loadImageElement(source);

    throw new Error('Formato de imagen no soportado');
  }

  function drawableSize(drawable) {
    if (typeof HTMLCanvasElement !== 'undefined' && drawable instanceof HTMLCanvasElement) {
      return { width: drawable.width, height: drawable.height };
    }
    return {
      width: drawable.naturalWidth || drawable.width || 0,
      height: drawable.naturalHeight || drawable.height || 0
    };
  }

  function drawableToCanvas(drawable) {
    const { width, height } = drawableSize(drawable);
    if (!width || !height) throw new Error('La imagen capturada está vacía');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable, 0, 0, width, height);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el blob'))),
          type,
          quality
        );
        return;
      }
      // Respaldo para navegadores sin toBlob
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const [meta, base64] = dataUrl.split(',');
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        resolve(new Blob([bytes], { type: meta.slice(meta.indexOf(':') + 1) }));
      } catch (err) {
        reject(err);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Recorte básico de respaldo (mismo criterio conservador que ya existía)
  // --------------------------------------------------------------------------
  function basicBackgroundCleanup(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const corners = [
        0,
        (width - 1) * 4,
        (height - 1) * width * 4,
        ((height - 1) * width + width - 1) * 4
      ];

      let opaqueCorners = 0;
      let darkCorners = 0;
      corners.forEach((i) => {
        if (data[i + 3] > 200) {
          opaqueCorners += 1;
          if (data[i] < 26 && data[i + 1] < 26 && data[i + 2] < 26) darkCorners += 1;
        }
      });

      // Solo limpia si el fondo realmente es negro/artificial
      if (opaqueCorners >= 3 && darkCorners >= 3) {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 26 && data[i + 1] < 26 && data[i + 2] < 26) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (err) {
      console.warn('Recorte básico no disponible:', err);
    }

    return canvas;
  }

  // --------------------------------------------------------------------------
  // Remoción de fondo con IA (@imgly/background-removal, gratis y en cliente)
  // --------------------------------------------------------------------------
  async function removeBackgroundWithAI(sourceCanvas, onProgress) {
    const mod = await loadBackgroundRemoval();
    if (typeof onProgress === 'function') onProgress('Cargando el motor de IA en tu navegador...');

    const inputBlob = await canvasToBlob(sourceCanvas, 'image/jpeg', 0.92);
    const cutoutBlob = await mod.removeBackground(inputBlob, {
      model: AI_MODEL,
      device: 'cpu',
      output: { format: 'image/png', quality: 1, type: 'foreground' },
      progress: (key, current, total) => {
        if (typeof onProgress === 'function') onProgress(describeProgress(key, current, total));
      }
    });

    if (!cutoutBlob || !cutoutBlob.size) throw new Error('La IA no devolvió una imagen');
    const drawable = await toDrawable(cutoutBlob);
    return drawableToCanvas(drawable);
  }

  // --------------------------------------------------------------------------
  // Compresión y optimización de peso
  // --------------------------------------------------------------------------
  function supportsWebpEncoding(canvas) {
    try {
      return canvas.toDataURL('image/webp', 0.6).indexOf('data:image/webp') === 0;
    } catch (err) {
      return false;
    }
  }

  function fitCanvas(sourceCanvas, maxDim) {
    const { width, height } = drawableSize(sourceCanvas);
    const longest = Math.max(width, height);
    if (longest <= maxDim) return sourceCanvas;

    const scale = maxDim / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function scaleCanvas(sourceCanvas, factor) {
    const { width, height } = drawableSize(sourceCanvas);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function dataUrlToBytes(dataUrl) {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return 0;
    const base64 = dataUrl.slice(comma + 1);
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  }

  // Ajusta a maxDim y baja calidad/escala hasta respetar maxBytes (< 200 KB)
  function optimizeCanvas(sourceCanvas, maxDim, maxBytes) {
    const fitted = fitCanvas(sourceCanvas, maxDim);
    const webpSupported = supportsWebpEncoding(fitted);
    let best = null;

    const consider = (dataUrl, canvas, format, quality) => {
      const bytes = dataUrlToBytes(dataUrl);
      if (!best || bytes < best.bytes) {
        best = { dataUrl, bytes, width: canvas.width, height: canvas.height, format, quality };
      }
      return bytes <= maxBytes;
    };

    for (let s = 0; s < SCALE_STEPS.length; s++) {
      const scale = SCALE_STEPS[s];
      const canvas = scale === 1 ? fitted : scaleCanvas(fitted, scale);

      if (webpSupported) {
        for (let q = 0; q < QUALITY_STEPS.length; q++) {
          const dataUrl = canvas.toDataURL('image/webp', QUALITY_STEPS[q]);
          if (consider(dataUrl, canvas, 'webp', QUALITY_STEPS[q])) return best;
        }
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        if (consider(dataUrl, canvas, 'png')) return best;
      }
    }

    return best; // mejor esfuerzo (solo superaría el límite en PNG muy complejos)
  }

  // --------------------------------------------------------------------------
  // Pipeline completo: IA -> fallback básico -> redimensión -> compresión
  // --------------------------------------------------------------------------
  async function processImage(source, options) {
    const opts = options || {};
    const maxDim = opts.maxDimension || DEFAULT_MAX_DIMENSION;
    const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    const onFallback = typeof opts.onFallback === 'function' ? opts.onFallback : null;

    const drawable = await toDrawable(source);
    const rawCanvas = drawableToCanvas(drawable);

    let resultCanvas;
    let engine;

    if (opts.engine === 'basico') {
      resultCanvas = basicBackgroundCleanup(rawCanvas);
      engine = 'basico';
    } else {
      try {
        resultCanvas = await removeBackgroundWithAI(rawCanvas, onProgress);
        engine = 'ia';
      } catch (err) {
        console.warn('Remoción de fondo con IA no disponible, se usa recorte básico:', err);
        if (onFallback) onFallback(err);
        resultCanvas = basicBackgroundCleanup(rawCanvas);
        engine = 'basico';
      }
    }

    const optimized = optimizeCanvas(resultCanvas, maxDim, maxBytes);
    if (!optimized || !optimized.dataUrl) throw new Error('No se pudo comprimir la imagen');

    return {
      dataUrl: optimized.dataUrl,
      bytes: optimized.bytes,
      width: optimized.width,
      height: optimized.height,
      format: optimized.format,
      engine
    };
  }

  global.AIPhoto = {
    processImage,
    loadBackgroundRemoval,
    describeProgress,
    optimizeCanvas,
    DEFAULT_MAX_DIMENSION,
    DEFAULT_MAX_BYTES
  };
})(window);
