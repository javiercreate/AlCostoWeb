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
// - Realce automático de color estilo iPhone inmediatamente después de
//   remover el fondo: exposición +12%, vivacidad/saturación +28% (con extra
//   para colores apagados) y contraste +12% (define sombras y punto negro).
// - Salida optimizada para e-commerce: lienzo cuadrado fijo de 600x600 px,
//   formato WebP (con transparencia) o PNG como respaldo, < 260 KB.
// ==========================================================================

(function (global) {
  'use strict';

  const IMGLY_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
  // 900px de lado máximo (ajustado a las tarjetas Retina del catálogo); antes 800px
  // con escalados agresivos provocaba fotos pixeladas en la tienda.
  const DEFAULT_MAX_DIMENSION = 900;
  // Lienzo cuadrado de exportación del editor de fotos: 600 x 600 px HD.
  const DEFAULT_EXPORT_SIZE = 600;
  // Realce automático "foto vivo" (estilo iPhone) aplicado tras remover el fondo.
  // Dentro de los rangos pedidos: brillo +10~15%, vivacidad +25~30%, contraste +10~15%.
  const AUTO_ENHANCE = {
    exposure: 1.12, // +12% de exposición: ilumina sin blanquear
    saturation: 1.28, // +28% de saturación base
    vibrance: 0.12, // +12% extra SOLO en colores apagados (vivacidad)
    contrast: 1.12 // +12% de contraste: define bordes, texturas y punto negro
  };
  const DEFAULT_MAX_BYTES = 260 * 1024; // 260 KB
  const AI_MODEL = 'isnet_quint8'; // modelo ligero (~42 MB) tras la primera descarga
  // Calidad mínima 0.66 y escala mínima 0.72: antes bajaba a 0.40 / 0.48 y la foto salía borrosa
  const QUALITY_STEPS = [0.92, 0.86, 0.8, 0.74, 0.7, 0.66];
  const SCALE_STEPS = [1, 0.9, 0.82, 0.72];

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
  // REALCE AUTOMÁTICO DE COLOR (ESTILO IPHONE) SOBRE EL LIENZO PROCESADO
  // Exposición +12% -> Contraste +12% -> Vivacidad/Saturación +28%.
  // Trabaja píxel a píxel respetando la transparencia del fondo eliminado.
  // --------------------------------------------------------------------------
  function applyEnhanceToData(data, params) {
    const p = params || AUTO_ENHANCE;
    const exposure = typeof p.exposure === 'number' ? p.exposure : 1.12;
    const contrast = typeof p.contrast === 'number' ? p.contrast : 1.12;
    const saturation = typeof p.saturation === 'number' ? p.saturation : 1.28;
    const vibrance = typeof p.vibrance === 'number' ? p.vibrance : 0.12;
    const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // píxeles transparentes: intactos

      // 1) Exposición / brillo leve (+12%): ilumina sin blanquear
      let r = data[i] * exposure;
      let g = data[i + 1] * exposure;
      let b = data[i + 2] * exposure;

      // 2) Contraste profundo (+12%): define bordes, texturas y punto negro
      r = (r - 127.5) * contrast + 127.5;
      g = (g - 127.5) * contrast + 127.5;
      b = (b - 127.5) * contrast + 127.5;

      // 3) Vivacidad: saturación +28%, con extra proporcional para los colores
      //    apagados (así se resalta sin quemar los colores ya intensos)
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const currentSat = maxC > 0 ? (maxC - minC) / maxC : 0;
      const satFactor = saturation + vibrance * (1 - Math.min(1, Math.max(0, currentSat)));
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * satFactor;
      g = lum + (g - lum) * satFactor;
      b = lum + (b - lum) * satFactor;

      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
    }

    return data;
  }

  function enhanceCanvasColors(sourceCanvas, params) {
    const { width, height } = drawableSize(sourceCanvas);
    if (!width || !height) return sourceCanvas;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      applyEnhanceToData(imageData.data, params);
      ctx.putImageData(imageData, 0, 0);
    } catch (err) {
      console.warn('No se pudo aplicar el realce de color:', err);
      return sourceCanvas;
    }
    return canvas;
  }

  // --------------------------------------------------------------------------
  // LIENZO CUADRADO DE EXPORTACIÓN (600 x 600 px): encaja el producto al
  // centro con proporción conservada y fondo transparente (letterbox).
  // --------------------------------------------------------------------------
  function fitToSquareCanvas(sourceCanvas, size) {
    const target = size || DEFAULT_EXPORT_SIZE;
    const { width, height } = drawableSize(sourceCanvas);
    if (!width || !height) throw new Error('La imagen capturada está vacía');

    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const scale = Math.min(target / width, target / height);
    const drawW = Math.max(1, Math.round(width * scale));
    const drawH = Math.max(1, Math.round(height * scale));
    ctx.drawImage(sourceCanvas, Math.round((target - drawW) / 2), Math.round((target - drawH) / 2), drawW, drawH);
    return canvas;
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

  // Ajusta a maxDim y baja calidad/escala hasta respetar maxBytes (< 260 KB).
  // scaleSteps opcional: el editor pasa [1] para no bajar de 600 x 600 px.
  function optimizeCanvas(sourceCanvas, maxDim, maxBytes, scaleSteps) {
    const fitted = fitCanvas(sourceCanvas, maxDim);
    const steps = Array.isArray(scaleSteps) && scaleSteps.length ? scaleSteps : SCALE_STEPS;
    const webpSupported = supportsWebpEncoding(fitted);
    let best = null;

    const consider = (dataUrl, canvas, format, quality) => {
      const bytes = dataUrlToBytes(dataUrl);
      if (!best || bytes < best.bytes) {
        best = { dataUrl, bytes, width: canvas.width, height: canvas.height, format, quality };
      }
      return bytes <= maxBytes;
    };

    for (let s = 0; s < steps.length; s++) {
      const scale = steps[s];
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
  // Pipeline completo: IA -> fallback básico -> realce de color automático
  // -> lienzo cuadrado 600x600 -> compresión sin bajar de esa resolución
  // --------------------------------------------------------------------------
  async function processImage(source, options) {
    const opts = options || {};
    const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
    const exportSize = opts.exportSize || DEFAULT_EXPORT_SIZE;
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

    // Realce automático de color "foto vivo" (estilo iPhone) inmediatamente
    // después de remover el fondo: brillo +12%, vivacidad +28%, contraste +12%
    const enhanced = opts.autoEnhance === false
      ? resultCanvas
      : enhanceCanvasColors(resultCanvas, opts.enhance || AUTO_ENHANCE);

    // Lienzo cuadrado HD de salida (600 x 600 px) centrado con fondo transparente
    const square = fitToSquareCanvas(enhanced, exportSize);

    // Compresión respetando 600 x 600: solo se baja la calidad, nunca la escala
    const optimized = optimizeCanvas(square, exportSize, maxBytes, [1]);
    if (!optimized || !optimized.dataUrl) throw new Error('No se pudo comprimir la imagen');

    return {
      dataUrl: optimized.dataUrl,
      bytes: optimized.bytes,
      width: optimized.width,
      height: optimized.height,
      format: optimized.format,
      engine,
      enhanced: opts.autoEnhance !== false,
      exportSize
    };
  }

  global.AIPhoto = {
    processImage,
    loadBackgroundRemoval,
    describeProgress,
    optimizeCanvas,
    enhanceCanvasColors,
    applyEnhanceToData,
    fitToSquareCanvas,
    AUTO_ENHANCE,
    DEFAULT_EXPORT_SIZE,
    DEFAULT_MAX_DIMENSION,
    DEFAULT_MAX_BYTES
  };
})(window);
