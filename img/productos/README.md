# Fotos de productos (archivos locales)

Aquí quedan las fotos de los productos como **archivos reales** (.png, .jpg, .webp).
Las que se suben desde el panel no se guardan como archivo: el navegador las
comprime y las deja como texto base64 dentro del producto (en Supabase y en
`localStorage`). Este script las extrae a disco:

```bash
node scripts/exportar-imagenes.js
```

- Vuelve a ejecutarlo cuando subas productos nuevos desde el panel: descarga las
  fotos que falten y reescribe las existentes.
- `manifest.json` dice qué archivo corresponde a qué producto (id y nombre).
- Los nombres son legibles: marca + producto + peso (`aceitunas-negras-enteras-osole.png`).
  Si dos productos se llaman igual, se numeran `-2`, `-3`.
- El id interno del proyecto (`prod-XXXX`) no se usa en el nombre porque no aporta nada
  al buscar la foto a ojo.
- El script sobrescribe los archivos con el mismo nombre; los que ya tengas
  añadidos a mano con otros nombres no se tocan.

## Cómo usar estas fotos en la tienda

En el panel (`admin.html` → Productos), en el campo de la foto escribe la ruta
relativa al proyecto, por ejemplo:

```
img/productos/sardina-marbella.png
```

Ventaja: la imagen pesa lo que pesa el archivo (sin recompresión) y se sirve
desde tu propio dominio. Ten en cuenta que la carpeta debe ir incluida en el
despliegue para que la ruta funcione online.

## Para añadir fotos tuyas

Copia los archivos aquí dentro con nombres sin espacios ni acentos (por ejemplo
`pollo-1kg.jpg`) y usa la misma ruta relativa en el panel.
