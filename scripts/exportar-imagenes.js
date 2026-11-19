#!/usr/bin/env node
// ==========================================================================
// EXPORTAR IMÁGENES DE PRODUCTOS A DISCO
// --------------------------------------------------------------------------
// Las fotos que se suben desde el panel no se guardan como archivos: se
// comprimen en el navegador y quedan como texto base64 dentro del producto
// (localStorage y tabla "productos" de Supabase). Este script lee esa tabla
// y escribe cada foto como archivo real en img/productos/, para tenerlas en
// el disco del proyecto.
//
// Uso:   node scripts/exportar-imagenes.js
//        node scripts/exportar-imagenes.js --desde-local   (no soportado: localStorage vive en el navegador)
//
// Requiere Node 18+ (usa fetch nativo). Sin dependencias.
// ==========================================================================

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'img', 'productos');
const CONFIG_FILE = path.join(__dirname, '..', 'js', 'supabase-config.js');

// Las credenciales se leen de js/supabase-config.js para no duplicarlas.
function readSupabaseConfig() {
  const fallback = {
    url: 'https://azbrwlamlltimghrhxsj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6YnJ3bGFtbGx0aW1naHJoeHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTIyNTAsImV4cCI6MjEwNjM2ODI1MH0.cR85t6G8FGNKxVstbxdSTxo9FmOyf-0_f3EJ_fxsAqI'
  };
  try {
    const src = fs.readFileSync(CONFIG_FILE, 'utf8');
    const url = (src.match(/url:\s*'([^']+)'/) || [])[1];
    const anonKey = (src.match(/anonKey:\s*'([^']+)'/) || [])[1];
    return { url: url || fallback.url, anonKey: anonKey || fallback.anonKey };
  } catch (err) {
    console.warn('No se pudo leer js/supabase-config.js, se usan las credenciales públicas por defecto.');
    return fallback;
  }
}

// "Aceitunas verdes (400g)" -> "aceitunas-verdes-400g"
function slugify(text) {
  return String(text || 'producto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'producto';
}

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
};

// Devuelve { buffer, ext } a partir de un data URL base64 (o null si no lo es)
function decodeDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;
  return { buffer, ext: MIME_EXT[mime] || 'png' };
}

async function fetchProducts(config) {
  const url = `${config.url.replace(/\/+$/, '')}/rest/v1/productos?select=id,name,image`;
  const res = await fetch(url, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase respondió ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Respuesta inesperada de Supabase (no es una lista)');
  return data;
}

async function main() {
  const config = readSupabaseConfig();
  console.log('Leyendo productos de Supabase...');
  const products = await fetchProducts(config);
  console.log(`Productos encontrados: ${products.length}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Archivos exportados en la ejecución anterior, para borrar los que ya no
  // correspondan a ningún nombre nuevo (sin tocar los que hayas añadido tú).
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  let previousFiles = [];
  try {
    const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    previousFiles = (prev.imagenes || []).map((e) => e.file).filter(Boolean);
  } catch (err) {
    previousFiles = [];
  }

  const manifest = [];
  const skipped = [];
  const usedNames = new Set();

  for (const product of products) {
    const decoded = decodeDataUrl(product.image);
    if (!decoded) {
      skipped.push({
        id: product.id,
        name: product.name,
        reason: !product.image ? 'sin foto' : 'la foto es una URL externa, no base64'
      });
      continue;
    }

    // Nombre legible: marca + producto + peso, sin el id interno del proyecto.
    // Si dos productos se llaman igual, se numeran: -2, -3...
    const base = slugify(product.name);
    let fileName = `${base}.${decoded.ext}`;
    let counter = 2;
    while (usedNames.has(fileName)) {
      fileName = `${base}-${counter}.${decoded.ext}`;
      counter += 1;
    }
    usedNames.add(fileName);

    const target = path.join(OUT_DIR, fileName);
    fs.writeFileSync(target, decoded.buffer);

    manifest.push({
      id: product.id,
      name: product.name,
      file: fileName,
      bytes: decoded.buffer.length
    });
    console.log(`✓ ${fileName}  (${(decoded.buffer.length / 1024).toFixed(1)} KB)  ${product.name}`);
  }

  const current = new Set(manifest.map((e) => e.file));
  const removed = previousFiles.filter((file) => !current.has(file) && fs.existsSync(path.join(OUT_DIR, file)));
  removed.forEach((file) => fs.unlinkSync(path.join(OUT_DIR, file)));
  if (removed.length) console.log(`Archivos antiguos renombrados y retirados: ${removed.length}`);

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ exportado: new Date().toISOString(), imagenes: manifest }, null, 2)
  );

  console.log('');
  console.log(`Imágenes guardadas en img/productos: ${manifest.length}`);
  console.log(`Omitidos: ${skipped.length}`);
  skipped.forEach((s) => console.log(`  - ${s.id} | ${s.name} | ${s.reason}`));
  console.log('Mapa producto → archivo: img/productos/manifest.json');
}

main().catch((err) => {
  console.error('Error exportando imágenes:', err.message);
  process.exit(1);
});
