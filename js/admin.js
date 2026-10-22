// ==========================================================================
// GESTOR DE PEDIDOS Y CATÁLOGO - AL COSTO SUPERMERCADO
// Soporte completo para PC, Móvil, WhatsApp (+34 602 07 08 46) y Supabase
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Estado local
  let products = [];
  let orders = [];
  let editingProductId = null;
  let currentOrderFilter = 'all';

  // --- VISTA DE PEDIDOS (LISTA / TARJETAS) CON PREFERENCIA PERSISTENTE ---
  // El administrador elige libremente la vista (estilo Google Drive). La
  // selección se guarda en localStorage (preferredOrdersView = 'list' | 'grid')
  // y NO se fuerza con media queries: en móvil también respeta la elección.
  let currentOrdersView = (() => {
    try {
      const saved = localStorage.getItem('preferredOrdersView');
      return saved === 'grid' ? 'grid' : 'list';
    } catch (e) {
      return 'list';
    }
  })();

  // --- ESTADO DEL CENTRO DE DESPACHO EN TIEMPO REAL ---
  // IDs de pedidos entregados archivados (fuera de la vista de operación del día)
  let archivedOrderIds = new Set();
  // IDs conocidos: se usa para detectar pedidos NUEVOS y disparar la alarma
  let knownOrderIds = null;
  // Control de concurrencia de loadOrders (evita pisados con realtime + polling)
  let ordersLoadInFlight = false;
  let ordersLoadQueued = false;
  // Realtime Supabase (canal postgres_changes) + polling de respaldo
  let ordersRealtimeChannel = null;
  let ordersPollTimer = null;
  // Alarma sonora de nuevo pedido (Web Audio API, en bucle hasta "Aceptar")
  let alarmActive = false;
  let alarmPendingOrders = [];
  let audioCtx = null;
  let alarmOsc = null;
  let alarmGain = null;
  let alarmSchedulerId = null;
  let alarmNextPulseTime = 0;
  // Pedido abierto en el modal de detalle (para refrescarlo al cambiar el estado)
  let openOrderId = null;
  const ORIGINAL_DOCUMENT_TITLE = document.title;

  // --- ELEMENTOS DEL DOM ---
  // Pestañas
  const tabButtons = document.querySelectorAll('.tab-btn, .mobile-nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const tabNewOrdersBadge = document.getElementById('tabNewOrdersBadge');
  const supabaseNavStatus = document.getElementById('supabaseNavStatus');

  // Pedidos
  const ordersCardsContainer = document.getElementById('ordersCardsContainer');
  const statNewOrdersCount = document.getElementById('statNewOrdersCount');
  const statPreparingCount = document.getElementById('statPreparingCount');
  const statShippingCount = document.getElementById('statShippingCount');
  const statTotalSalesAmount = document.getElementById('statTotalSalesAmount');
  const countAllOrders = document.getElementById('countAllOrders');
  const orderFilterButtons = document.querySelectorAll('[data-order-filter]');
  const ordersViewButtons = document.querySelectorAll('[data-orders-view]');
  const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
  const simulateDemoOrderBtn = document.getElementById('simulateDemoOrderBtn');
  const orderDetailModal = document.getElementById('orderDetailModal');
  const closeOrderDetailModalBtn = document.getElementById('closeOrderDetailModalBtn');
  const orderDetailModalBody = document.getElementById('orderDetailModalBody');
  const archiveDeliveredBtn = document.getElementById('archiveDeliveredBtn');
  const countArchivedOrders = document.getElementById('countArchivedOrders');

  // Alarma de nuevo pedido (banner + botónAceptar)
  const newOrderAlarmBanner = document.getElementById('newOrderAlarmBanner');
  const newOrderAlarmInfo = document.getElementById('newOrderAlarmInfo');
  const acceptNewOrderBtn = document.getElementById('acceptNewOrderBtn');
  const newOrderAlarmDetailBtn = document.getElementById('newOrderAlarmDetailBtn');

  // Catálogo
  const productsTableBody = document.getElementById('productsTableBody');
  const tableSearchInput = document.getElementById('tableSearchInput');
  const tableCategoryFilter = document.getElementById('tableCategoryFilter');
  const productForm = document.getElementById('productForm');
  const formTitle = document.getElementById('formTitle');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const publishToSupabaseBtn = document.getElementById('publishToSupabaseBtn');
  const exportBackupJsonBtn = document.getElementById('exportBackupJsonBtn');
  const importBackupJsonBtn = document.getElementById('importBackupJsonBtn');
  const importBackupJsonInput = document.getElementById('importBackupJsonInput');
  const priceAdjustmentScope = document.getElementById('priceAdjustmentScope');
  const priceAdjustmentProductGroup = document.getElementById('priceAdjustmentProductGroup');
  const priceAdjustmentProduct = document.getElementById('priceAdjustmentProduct');
  const priceAdjustmentAction = document.getElementById('priceAdjustmentAction');
  const priceAdjustmentType = document.getElementById('priceAdjustmentType');
  const priceAdjustmentValue = document.getElementById('priceAdjustmentValue');
  const priceAdjustmentPreview = document.getElementById('priceAdjustmentPreview');
  const applyPriceAdjustmentBtn = document.getElementById('applyPriceAdjustmentBtn');

  // Formulario Producto
  const prodIdInput = document.getElementById('prodId');
  const prodBarcodeInput = document.getElementById('prodBarcode');
  const prodNameInput = document.getElementById('prodName');
  const prodCategoryInput = document.getElementById('prodCategory');
  const prodPriceInput = document.getElementById('prodPrice');
  const prodOriginalPriceInput = document.getElementById('prodOriginalPrice');
  const prodWholesalePriceInput = document.getElementById('prodWholesalePrice');
  const prodWholesaleMinInput = document.getElementById('prodWholesaleMin');
  const prodUnitInput = document.getElementById('prodUnit');
  const prodImageInput = document.getElementById('prodImage');
  const prodBadgeInput = document.getElementById('prodBadge');
  const prodDescriptionInput = document.getElementById('prodDescription');

  // Supabase
  const supabaseConfigForm = document.getElementById('supabaseConfigForm');
  const supabaseUrlInput = document.getElementById('supabaseUrl');
  const supabaseAnonKeyInput = document.getElementById('supabaseAnonKey');
  const supabaseConnectionBadge = document.getElementById('supabaseConnectionBadge');
  const testSupabaseBtn = document.getElementById('testSupabaseBtn');
  const pushToSupabaseDirectBtn = document.getElementById('pushToSupabaseDirectBtn');
  const supabaseFeedbackAlert = document.getElementById('supabaseFeedbackAlert');
  const copySqlBtn = document.getElementById('copySqlBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Deslizante y Cálculo de Porcentaje de Ventas Totales
  const salesPercentageSlider = document.getElementById('salesPercentageSlider');
  const salesPercentageNumberInput = document.getElementById('salesPercentageNumberInput');
  const salesPercentageValueDisplay = document.getElementById('salesPercentageValueDisplay');
  const salesPercentageResultAmount = document.getElementById('salesPercentageResultAmount');
  const salesPercentageBsEquiv = document.getElementById('salesPercentageBsEquiv');
  const salesPctChipsGroup = document.getElementById('salesPctChipsGroup');

  // Acordeón del Resumen Financiero + selector de periodo (Hoy/Semana/Mes/Todos)
  const financeSummaryToggleBtn = document.getElementById('financeSummaryToggleBtn');
  const financeSummaryPanel = document.getElementById('financeSummaryPanel');
  const financePeriodButtons = document.querySelectorAll('[data-finance-period]');
  const financePeriodLabel = document.getElementById('financePeriodLabel');

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================
  function init() {
    setupTabSwitching();
    initSupabaseConfig();
    initPaymentConfig();
    loadCatalogProducts();
    loadArchivedOrders();
    loadOrders();
    setupSalesPercentageEvents();
    setupFinanceAccordion();
    setupEventListeners();
    updateOrdersViewButtons();
    setupNewOrderAlarmListeners();
    setupOrdersRealtime();
  }

  // ==========================================================================
  // GESTIÓN DE CONFIGURACIÓN DE MÉTODOS DE PAGO (PAGO MÓVIL, ZELLE, BINANCE)
  // ==========================================================================
  async function initPaymentConfig() {
    const paymentForm = document.getElementById('paymentConfigForm');
    const badge = document.getElementById('paymentConfigSyncBadge');
    const btnReset = document.getElementById('btnResetPaymentDefaults');

    // Inputs
    const pmBanco = document.getElementById('pmBanco');
    const pmTelefono = document.getElementById('pmTelefono');
    const pmCedula = document.getElementById('pmCedula');
    const pmTitular = document.getElementById('pmTitular');
    const zelleCorreo = document.getElementById('zelleCorreo');
    const zelleTitular = document.getElementById('zelleTitular');
    const binancePayId = document.getElementById('binancePayId');
    const binanceCorreo = document.getElementById('binanceCorreo');
    const binanceRed = document.getElementById('binanceRed');

    // Cargar datos actuales
    try {
      let config = null;
      if (typeof SupabaseService !== 'undefined') {
        config = await SupabaseService.fetchPaymentConfig();
      }
      if (!config && typeof SupabaseService !== 'undefined') {
        config = SupabaseService.getDefaultPaymentConfig();
      }

      if (config) {
        if (config.pagoMovil) {
          if (pmBanco) pmBanco.value = config.pagoMovil.banco || '';
          if (pmTelefono) pmTelefono.value = config.pagoMovil.telefono || '';
          if (pmCedula) pmCedula.value = config.pagoMovil.cedula || '';
          if (pmTitular) pmTitular.value = config.pagoMovil.titular || '';
        }
        if (config.zelle) {
          if (zelleCorreo) zelleCorreo.value = config.zelle.correo || '';
          if (zelleTitular) zelleTitular.value = config.zelle.titular || '';
        }
        if (config.binance) {
          if (binancePayId) binancePayId.value = config.binance.payId || '';
          if (binanceCorreo) binanceCorreo.value = config.binance.correo || '';
          if (binanceRed) binanceRed.value = config.binance.red || '';
        }
      }
    } catch (e) {
      console.warn('Error cargando configuración de pagos:', e);
    }

    // Guardar cambios
    if (paymentForm) {
      paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          pagoMovil: {
            banco: pmBanco?.value.trim() || '',
            telefono: pmTelefono?.value.trim() || '',
            cedula: pmCedula?.value.trim() || '',
            titular: pmTitular?.value.trim() || ''
          },
          zelle: {
            correo: zelleCorreo?.value.trim() || '',
            titular: zelleTitular?.value.trim() || ''
          },
          binance: {
            payId: binancePayId?.value.trim() || '',
            correo: binanceCorreo?.value.trim() || '',
            red: binanceRed?.value.trim() || 'USDT'
          }
        };

        if (badge) badge.textContent = '⏳ Guardando...';

        try {
          if (typeof SupabaseService !== 'undefined') {
            const res = await SupabaseService.savePaymentConfig(payload);
            if (badge) {
              badge.textContent = res.localOnly ? '💾 Guardado localmente' : '🟢 Sincronizado en Supabase';
              badge.style.background = '#DCFCE7';
              badge.style.color = '#166534';
            }
            showToast('✅ ¡Datos de Pago Móvil, Zelle y Binance guardados exitosamente!', 'success');
          }
        } catch (err) {
          if (badge) {
            badge.textContent = '❌ Error al sincronizar';
            badge.style.background = '#FEE2E2';
            badge.style.color = '#991B1B';
          }
          showToast(`Error guardando datos: ${err.message}`, 'error');
        }
      });
    }

    // Restaurar valores por defecto
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (!confirm('¿Deseas restaurar los datos de pago a los valores sugeridos por defecto?')) return;
        if (typeof SupabaseService !== 'undefined') {
          const defaults = SupabaseService.getDefaultPaymentConfig();
          if (pmBanco) pmBanco.value = defaults.pagoMovil.banco;
          if (pmTelefono) pmTelefono.value = defaults.pagoMovil.telefono;
          if (pmCedula) pmCedula.value = defaults.pagoMovil.cedula;
          if (pmTitular) pmTitular.value = defaults.pagoMovil.titular;
          if (zelleCorreo) zelleCorreo.value = defaults.zelle.correo;
          if (zelleTitular) zelleTitular.value = defaults.zelle.titular;
          if (binancePayId) binancePayId.value = defaults.binance.payId;
          if (binanceCorreo) binanceCorreo.value = defaults.binance.correo;
          if (binanceRed) binanceRed.value = defaults.binance.red;
          showToast('Valores por defecto restablecidos. Pulsa "Guardar" para sincronizarlos.', 'normal');
        }
      });
    }
  }

  // ==========================================================================
  // PESTAÑAS (MÓVIL Y ESCRITORIO)
  // ==========================================================================
  function setupTabSwitching() {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return; // Puede ser un enlace externo

        // Actualizar botones
        tabButtons.forEach(b => {
          if (b.getAttribute('data-tab') === targetTab) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });

        // Actualizar paneles
        tabPanes.forEach(pane => {
          pane.classList.toggle('active', pane.id === targetTab);
        });

        // Scroll al inicio
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // ==========================================================================
  // GESTIÓN DE PEDIDOS / COMPRAS (ORDERS DASHBOARD)
  // ==========================================================================
  // Carga de pedidos con control de concurrencia: el canal realtime y el polling
  // pueden solaparse; si una carga ya está en curso se encola otra al terminar.
  async function loadOrders() {
    if (ordersLoadInFlight) {
      ordersLoadQueued = true;
      return;
    }
    ordersLoadInFlight = true;
    try {
      await fetchAndMergeOrders();
    } finally {
      ordersLoadInFlight = false;
      if (ordersLoadQueued) {
        ordersLoadQueued = false;
        loadOrders();
      }
    }
  }

  async function fetchAndMergeOrders() {
    // Convierte una fila de public.pedidos (cualquiera sea el idioma de sus columnas)
    // al formato camelCase que usa el panel. Se aceptan alias en inglés (customer_name,
    // delivery_fee...) y en español (nombre_cliente, telefono, direccion, horario,
    // metodo_pago, envio...), así nunca aparecen "undefined" en la tarjeta ni en el modal.
    function normalizeSupabaseOrder(row) {
      const pick = (...names) => {
        for (const n of names) {
          if (row[n] !== undefined && row[n] !== null) return row[n];
        }
        return null;
      };
      return {
        ...row,
        id: row.id,
        customerName: pick('customerName', 'customer_name', 'nombre_cliente') || 'Cliente Al Costo',
        customerPhone: pick('customerPhone', 'customer_phone', 'telefono') || '',
        deliveryAddress: pick('deliveryAddress', 'delivery_address', 'direccion') || '',
        deliverySlot: pick('deliverySlot', 'delivery_slot', 'horario') || '',
        instructions: pick('instructions') || '',
        // Sin valor por defecto: se muestra exactamente lo que envió el checkout (null → "No especificado")
        paymentMethod: pick('paymentMethod', 'payment_method', 'metodo_pago'),
        paymentProof: pick('paymentProof', 'payment_proof') || null,
        gpsCoordinates: pick('gpsCoordinates', 'gps_coordinates') || null,
        deliveryType: pick('deliveryType', 'delivery_type') || 'delivery',
        // Siempre numérico: evita "$NaN" cuando el envío viene vacío, como texto o en pedidos de retiro
        deliveryFee: (parseFloat(pick('deliveryFee', 'delivery_fee', 'envio')) || 0),
        items: Array.isArray(row.items) ? row.items : [],
        subtotal: (parseFloat(row.subtotal) || 0),
        discount: (parseFloat(row.discount) || 0),
        tip: (parseFloat(row.tip) || 0),
        total: (parseFloat(row.total) || 0),
        status: row.status || 'nuevo',
        created_at: row.created_at || new Date().toISOString()
      };
    }

    // 1. Intentar cargar desde Supabase si está configurado
    const supabaseOrders = await SupabaseService.fetchOrdersFromSupabase();

    // Pedidos guardados en este navegador (incluyen la captura de pago subida en la misma tienda)
    let localOrders = [];
    try {
      localOrders = JSON.parse(localStorage.getItem('alcosto_orders')) || [];
    } catch (e) {
      localOrders = [];
    }

    if (supabaseOrders && supabaseOrders.length > 0) {
      orders = supabaseOrders.map(normalizeSupabaseOrder);

      // Completar la captura de pago / GPS con la copia local cuando la nube no la tiene
      orders.forEach(order => {
        const local = localOrders.find(l => String(l.id) === String(order.id));
        if (local) {
          if (!order.paymentProof && local.paymentProof) order.paymentProof = local.paymentProof;
          if (!order.gpsCoordinates && local.gpsCoordinates) order.gpsCoordinates = local.gpsCoordinates;
          if ((!order.deliveryType || order.deliveryType === 'delivery') && local.deliveryType) {
            order.deliveryType = local.deliveryType;
          }
        }
      });

      // Sumar pedidos locales que aún no llegaron a la nube (ej: fallo de red)
      const cloudIds = new Set(orders.map(o => String(o.id)));
      localOrders.forEach(local => {
        if (!cloudIds.has(String(local.id))) orders.push(normalizeSupabaseOrder(local));
      });
    } else {
      // 2. Cargar desde LocalStorage
      orders = localOrders.map(normalizeSupabaseOrder);
    }

    updateOrdersStats();
    renderOrdersCards();
    detectNewOrdersAndAlarm();
    scheduleEmptyOrdersRetry();
  }

  // Si el listado queda vacío con Supabase activo (la primera petición pudo fallar
  // por red), se reintenta en unos segundos sin esperar al siguiente ciclo de
  // polling: el panel nunca se queda en "No hay pedidos" si sí que los hay.
  let emptyOrdersRetryTimer = null;
  let emptyOrdersRetried = false;

  function scheduleEmptyOrdersRetry() {
    if (orders.length > 0 || emptyOrdersRetried || emptyOrdersRetryTimer) return;
    if (!SupabaseService.getConfig().connected) return;
    emptyOrdersRetryTimer = setTimeout(() => {
      emptyOrdersRetryTimer = null;
      emptyOrdersRetried = true;
      loadOrders();
    }, 2500);
  }

  // ==========================================================================
  // MÓDULO DE ARCHIVO DE PEDIDOS ENTREGADOS
  // Oculta de la vista de operación (del día) los pedidos entregados archivados
  // y permite volver a verlos en el filtro "Archivados".
  // ==========================================================================
  const ARCHIVED_ORDERS_STORAGE_KEY = 'alcosto_archived_order_ids';

  function loadArchivedOrders() {
    try {
      const saved = JSON.parse(localStorage.getItem(ARCHIVED_ORDERS_STORAGE_KEY));
      archivedOrderIds = new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (e) {
      archivedOrderIds = new Set();
    }
  }

  function persistArchivedOrders() {
    try {
      localStorage.setItem(ARCHIVED_ORDERS_STORAGE_KEY, JSON.stringify([...archivedOrderIds]));
    } catch (e) {
      console.warn('No se pudo guardar el archivo de pedidos:', e);
    }
  }

  function isOrderArchived(order) {
    return archivedOrderIds.has(String(order.id));
  }

  function archiveDeliveredOrders() {
    const pending = orders.filter(o => o.status === 'entregado' && !isOrderArchived(o));
    if (pending.length === 0) {
      showToast('📦 No hay pedidos entregados pendientes por archivar');
      return;
    }
    pending.forEach(o => archivedOrderIds.add(String(o.id)));
    persistArchivedOrders();
    updateOrdersStats();
    renderOrdersCards();
    showToast(`📦 ${pending.length} pedido(s) entregado(s) archivado(s): la vista del día queda limpia`, 'success');
  }

  function unarchiveOrder(orderId) {
    archivedOrderIds.delete(String(orderId));
    persistArchivedOrders();
    updateOrdersStats();
    renderOrdersCards();
    showToast(`↩️ Pedido #${orderId} restaurado en la vista principal`, 'success');
  }

  // ==========================================================================
  // REALTIME SUPABASE: CANAL postgres_changes + POLLING ASÍNCRONO DE RESPALDO
  // Los pedidos nuevos aparecen en pantalla sin refrescar la página.
  // ==========================================================================
  const ORDERS_POLL_INTERVAL_MS = 8000;

  function setupOrdersRealtime() {
    connectSupabaseOrdersChannel();
    startOrdersPolling();
  }

  function startOrdersPolling() {
    if (ordersPollTimer) return;
    // Polling constante: mantiene el panel vivo aunque el websocket falle
    ordersPollTimer = setInterval(() => {
      if (!document.hidden) loadOrders();
    }, ORDERS_POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadOrders();
    });
  }

  function connectSupabaseOrdersChannel() {
    try {
      const config = SupabaseService.getConfig();
      if (!config.connected) return;
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.info('SDK de Supabase no cargado: el realtime de pedidos lo cubre el polling.');
        return;
      }

      const client = window.supabase.createClient(config.url, config.anonKey);
      ordersRealtimeChannel = client
        .channel('admin-pedidos-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, (payload) => {
          console.log('🔔 Realtime: nuevo pedido en Supabase', payload.new && payload.new.id);
          loadOrders();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => {
          loadOrders();
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('Realtime de pedidos no disponible: sigue activo el polling de respaldo.');
          }
        });

      window.addEventListener('pagehide', () => {
        try {
          if (ordersRealtimeChannel && typeof ordersRealtimeChannel.unsubscribe === 'function') {
            ordersRealtimeChannel.unsubscribe();
          }
        } catch (e) {}
      });
    } catch (err) {
      console.warn('No se pudo abrir el canal realtime de pedidos (se usa polling):', err);
    }
  }

  // Detecta pedidos que aún no estaban en pantalla y dispara la alarma.
  // La primera carga (histórico) NUNCA dispara alarma.
  function detectNewOrdersAndAlarm() {
    const currentIds = new Set(orders.map(o => String(o.id)));
    if (knownOrderIds === null) {
      knownOrderIds = currentIds;
      return;
    }
    const fresh = orders.filter(o => !knownOrderIds.has(String(o.id)) && o.status === 'nuevo');
    knownOrderIds = currentIds;
    if (fresh.length) triggerNewOrderAlarm(fresh);
  }

  // ==========================================================================
  // ALARMA SONORA ESTILO APP DE DELIVERY (WEB AUDIO API, EN BUCLE)
  // Suena SIN DETENERSE hasta que el admin pulsa "Aceptar / Atender Pedido".
  // ==========================================================================
  function scheduleAlarmPulse(startTime) {
    if (!alarmGain || !alarmOsc) return;
    const gain = alarmGain.gain;
    // Tres pitidos agudos por pulso: patrón inconfundible de "pedido entrante"
    for (let i = 0; i < 3; i++) {
      const t = startTime + i * 0.17;
      alarmOsc.frequency.setValueAtTime(i === 1 ? 940 : 1320, t);
      gain.setValueAtTime(0, t);
      gain.linearRampToValueAtTime(0.5, t + 0.02);
      gain.setValueAtTime(0.5, t + 0.11);
      gain.linearRampToValueAtTime(0, t + 0.14);
    }
  }

  function alarmSchedulerTick() {
    if (!audioCtx || !alarmGain) return;
    const now = audioCtx.currentTime;
    if (alarmNextPulseTime < now) alarmNextPulseTime = now + 0.05;
    // Programa siempre ~1.5s por delante para que el bucle nunca se interrumpa
    while (alarmNextPulseTime < now + 1.5) {
      scheduleAlarmPulse(alarmNextPulseTime);
      alarmNextPulseTime += 0.95;
    }
  }

  function startNewOrderSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('Web Audio API no disponible en este navegador.');
        return;
      }
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

      if (!alarmOsc) {
        alarmOsc = audioCtx.createOscillator();
        alarmOsc.type = 'square';
        alarmGain = audioCtx.createGain();
        alarmGain.gain.value = 0;
        alarmOsc.connect(alarmGain);
        alarmGain.connect(audioCtx.destination);
        alarmOsc.start();
      }

      alarmGain.gain.cancelScheduledValues(audioCtx.currentTime);
      alarmGain.gain.setValueAtTime(0, audioCtx.currentTime);
      alarmNextPulseTime = 0;
      alarmSchedulerTick();
      if (alarmSchedulerId === null) alarmSchedulerId = setInterval(alarmSchedulerTick, 250);
      if (navigator.vibrate) navigator.vibrate([400, 180, 400, 180, 400]);
    } catch (err) {
      console.warn('No se pudo iniciar la alarma sonora:', err);
    }
  }

  function stopNewOrderSound() {
    if (alarmSchedulerId !== null) {
      clearInterval(alarmSchedulerId);
      alarmSchedulerId = null;
    }
    if (audioCtx && alarmGain) {
      try {
        const now = audioCtx.currentTime;
        alarmGain.gain.cancelScheduledValues(now);
        alarmGain.gain.setValueAtTime(0, now);
      } catch (e) {}
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(0); } catch (e) {}
    }
  }

  function triggerNewOrderAlarm(newOrders) {
    if (!Array.isArray(newOrders) || newOrders.length === 0) return;
    if (knownOrderIds !== null) {
      newOrders.forEach(o => knownOrderIds.add(String(o.id)));
    }
    newOrders.forEach(o => {
      if (!alarmPendingOrders.some(p => String(p.id) === String(o.id))) alarmPendingOrders.push(o);
    });

    const latest = alarmPendingOrders[0];
    if (newOrderAlarmInfo) {
      newOrderAlarmInfo.textContent = alarmPendingOrders.length === 1
        ? `Pedido #${latest.id} • ${latest.customerName} • $${(parseFloat(latest.total) || 0).toFixed(2)}`
        : `${alarmPendingOrders.length} pedidos nuevos: ${alarmPendingOrders.map(o => '#' + o.id).join(' • ')}`;
    }
    if (newOrderAlarmBanner) newOrderAlarmBanner.classList.add('show');
    // Baja el modal y el contenido para que el banner no tape el botón de cierre
    document.body.classList.add('new-order-alarm-open');
    syncAlarmBannerOffset();
    document.title = `🔔 (${alarmPendingOrders.length}) ¡NUEVO PEDIDO! | Al Costo Admin`;

    if (!alarmActive) {
      alarmActive = true;
      startNewOrderSound();
    }
    showToast(`🔔 ¡NUEVO PEDIDO RECIBIDO! #${latest.id}`, 'success');
  }

  // Publica la altura REAL del banner de alarma como variable CSS
  // (--alarm-banner-height): el modal nunca queda tapado por el banner.
  function syncAlarmBannerOffset() {
    if (!newOrderAlarmBanner || !newOrderAlarmBanner.classList.contains('show')) return;
    const height = Math.ceil(newOrderAlarmBanner.getBoundingClientRect().height) || 0;
    if (height > 0) {
      document.documentElement.style.setProperty('--alarm-banner-height', `${height}px`);
    }
  }

  function setupNewOrderAlarmListeners() {
    if (acceptNewOrderBtn) acceptNewOrderBtn.addEventListener('click', acceptNewOrderAlarm);

    // El modal se ajusta a la altura REAL del banner (var --alarm-banner-height)
    window.addEventListener('resize', syncAlarmBannerOffset);

    if (newOrderAlarmDetailBtn) {
      newOrderAlarmDetailBtn.addEventListener('click', () => {
        const target = alarmPendingOrders[0];
        if (target) openOrderDetail(target.id);
        // Ver el detalle NO detiene la alarma: solo lo hace "Aceptar / Atender"
      });
    }

    // Políticas de autoplay: si el navegador bloquea el AudioContext, se reanuda
    // en el primer gesto del usuario mientras la alarma siga sonando.
    const resumeAudio = () => {
      if (alarmActive && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, resumeAudio, { passive: true });
    });
  }

  function acceptNewOrderAlarm() {
    const target = alarmPendingOrders[0];
    alarmActive = false;
    alarmPendingOrders = [];
    stopNewOrderSound();
    if (newOrderAlarmBanner) newOrderAlarmBanner.classList.remove('show');
    document.body.classList.remove('new-order-alarm-open');
    document.documentElement.style.removeProperty('--alarm-banner-height');
    document.title = ORIGINAL_DOCUMENT_TITLE;
    if (target) openOrderDetail(target.id);
    showToast('✅ Pedido aceptado y atendido: alarma detenida', 'success');
  }

  function createSampleOrder() {
    const sampleItems = (products && products.length > 0)
      ? [
          { product: products[0], quantity: 2 },
          ...(products.length > 1 ? [{ product: products[1], quantity: 1 }] : [])
        ]
      : [];
    const sub = sampleItems.reduce((acc, it) => acc + (it.product.price * it.quantity), 0);
    return {
      id: 'AC-' + Math.floor(1000 + Math.random() * 9000),
      customerName: 'Cliente Ejemplo',
      customerPhone: '+58 412 000 00 00',
      deliveryAddress: 'Dirección de prueba',
      deliverySlot: 'Hoy en 30-45 min',
      instructions: '',
      paymentMethod: 'Efectivo',
      items: sampleItems,
      subtotal: sub,
      discount: 0,
      deliveryFee: 0,
      tip: 0,
      total: sub,
      status: 'nuevo',
      created_at: new Date().toISOString()
    };
  }

  function updateOrdersStats() {
    const newCount = orders.filter(o => o.status === 'nuevo').length;
    const prepCount = orders.filter(o => o.status === 'preparacion').length;
    const shipCount = orders.filter(o => o.status === 'camino').length;
    
    let totalSales = 0;
    orders.forEach(o => {
      if (o.status !== 'cancelado' && isOrderInFinancePeriod(o)) totalSales += (parseFloat(o.total) || 0);
    });

    if (statNewOrdersCount) statNewOrdersCount.textContent = newCount;
    if (statPreparingCount) statPreparingCount.textContent = prepCount;
    if (statShippingCount) statShippingCount.textContent = shipCount;
    if (statTotalSalesAmount) statTotalSalesAmount.textContent = `$${totalSales.toFixed(2)}`;
    if (countAllOrders) {
      // "Todos" cuenta solo la vista del día (sin los archivados)
      countAllOrders.textContent = orders.filter(o => !isOrderArchived(o)).length;
    }
    if (countArchivedOrders) countArchivedOrders.textContent = archivedOrderIds.size;

    if (tabNewOrdersBadge) {
      tabNewOrdersBadge.textContent = `${newCount} nuevos`;
      tabNewOrdersBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
    }

    // Actualizar cálculo de porcentaje sobre las ventas totales
    updateSalesPercentageCalculation(totalSales);
  }

  // ==========================================================================
  // CÁLCULO Y CONTROL DEL DESLIZANTE DE PORCENTAJE SOBRE VENTAS TOTALES
  // ==========================================================================
  let currentSalesPercentage = parseFloat(localStorage.getItem('alcosto_admin_sales_percentage')) || 20;

  function updateSalesPercentageCalculation(totalSalesAmount) {
    if (typeof totalSalesAmount === 'undefined') {
      let calcTotal = 0;
      orders.forEach(o => {
        if (o.status !== 'cancelado' && isOrderInFinancePeriod(o)) calcTotal += (parseFloat(o.total) || 0);
      });
      totalSalesAmount = calcTotal;
    }

    const pct = Math.max(0, Math.min(100, currentSalesPercentage));
    const resultUSD = totalSalesAmount * (pct / 100);
    const rateBs = (typeof CURRENCY_RATES !== 'undefined' && CURRENCY_RATES.BS) ? CURRENCY_RATES.BS : 860.18;
    const resultBs = resultUSD * rateBs;

    if (salesPercentageSlider) salesPercentageSlider.value = pct;
    if (salesPercentageNumberInput) salesPercentageNumberInput.value = pct;
    if (salesPercentageValueDisplay) salesPercentageValueDisplay.textContent = pct;
    if (salesPercentageResultAmount) salesPercentageResultAmount.textContent = `$${resultUSD.toFixed(2)}`;
    if (salesPercentageBsEquiv) {
      salesPercentageBsEquiv.textContent = `~ ${resultBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
    }

    if (salesPctChipsGroup) {
      salesPctChipsGroup.querySelectorAll('.pct-chip-btn').forEach(btn => {
        const val = parseFloat(btn.getAttribute('data-pct'));
        btn.classList.toggle('active', val === pct);
      });
    }

    localStorage.setItem('alcosto_admin_sales_percentage', pct);
  }

  function setupSalesPercentageEvents() {
    if (salesPercentageSlider) {
      salesPercentageSlider.addEventListener('input', () => {
        currentSalesPercentage = parseFloat(salesPercentageSlider.value) || 0;
        updateSalesPercentageCalculation();
      });
    }

    if (salesPercentageNumberInput) {
      salesPercentageNumberInput.addEventListener('input', () => {
        let val = parseFloat(salesPercentageNumberInput.value);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        currentSalesPercentage = val;
        updateSalesPercentageCalculation();
      });
    }

    if (salesPctChipsGroup) {
      salesPctChipsGroup.querySelectorAll('.pct-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseFloat(btn.getAttribute('data-pct'));
          if (!isNaN(val)) {
            currentSalesPercentage = val;
            updateSalesPercentageCalculation();
          }
        });
      });
    }
  }

  // ==========================================================================
  // ACORDEÓN DEL RESUMEN FINANCIERO + SELECTOR DE PERÍODO
  // (Hoy / Esta Semana / Este Mes / Todos). Ventas Totales y el Resultado
  // de Ganancia (%) se recalculan dinámicamente según el periodo elegido.
  // El periodo "Hoy" se reinicia solo al cruzar la medianoche.
  // ==========================================================================
  const FINANCE_PERIOD_LABELS = {
    hoy: 'Hoy',
    semana: 'Esta Semana',
    mes: 'Este Mes',
    todos: 'Histórico total'
  };

  let currentFinancePeriod = localStorage.getItem('alcosto_admin_finance_period') || 'hoy';

  // Inicio del rango activo: medianoche local de hoy, lunes de esta semana o
  // primer día del mes. "Todos" devuelve null (sin filtro de fecha).
  function getFinancePeriodStart(period) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'semana') {
      const daysSinceMonday = (start.getDay() + 6) % 7; // lunes = 0
      start.setDate(start.getDate() - daysSinceMonday);
    } else if (period === 'mes') {
      start.setDate(1);
    } else if (period === 'todos') {
      return null;
    }
    return start;
  }

  function isOrderInFinancePeriod(order) {
    const periodStart = getFinancePeriodStart(currentFinancePeriod);
    if (!periodStart) return true;
    const createdAt = new Date((order && order.created_at) || '');
    if (isNaN(createdAt.getTime())) return true; // sin fecha válida: no ocultar
    return createdAt >= periodStart;
  }

  function updateFinancePeriodButtons() {
    financePeriodButtons.forEach(btn => {
      const active = btn.getAttribute('data-finance-period') === currentFinancePeriod;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (financePeriodLabel) {
      financePeriodLabel.textContent = `· ${FINANCE_PERIOD_LABELS[currentFinancePeriod] || 'Hoy'}`;
    }
  }

  function setupFinanceAccordion() {
    // Acordeón cerrado por defecto: los pedidos quedan arriba de inmediato.
    if (financeSummaryToggleBtn && financeSummaryPanel) {
      financeSummaryToggleBtn.addEventListener('click', () => {
        const isOpen = financeSummaryToggleBtn.getAttribute('aria-expanded') === 'true';
        financeSummaryToggleBtn.setAttribute('aria-expanded', String(!isOpen));
        financeSummaryPanel.hidden = isOpen;
      });
    }

    // Selector de periodo: recalcula Ventas Totales y Resultado de Ganancia (%)
    financePeriodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentFinancePeriod = btn.getAttribute('data-finance-period') || 'hoy';
        localStorage.setItem('alcosto_admin_finance_period', currentFinancePeriod);
        updateFinancePeriodButtons();
        updateOrdersStats();
      });
    });

    updateFinancePeriodButtons();

    // Reinicio automático del acumulado "Hoy" al cruzar la medianoche,
    // sin necesidad de recargar la página.
    let lastTrackedDay = new Date().toDateString();
    setInterval(() => {
      const today = new Date().toDateString();
      if (today !== lastTrackedDay) {
        lastTrackedDay = today;
        updateOrdersStats();
      }
    }, 60 * 1000);
  }

  // --- Ítems de pedido tolerantes a la estructura que llega desde Supabase ---
  // Acepta { product: {...}, quantity } (checkout de la tienda) o campos planos
  // ({ nombre, precio, cantidad }); evita "undefined" y "NaN" en la vista del pedido.
  function getItemSource(item) {
    return (item && item.product) ? item.product : (item || {});
  }
  function getItemName(item) {
    const source = getItemSource(item);
    return source.name || source.nombre || 'Producto';
  }
  function getItemUnit(item) {
    const source = getItemSource(item);
    return source.unit || source.unidad || '';
  }
  function getItemQuantity(item) {
    return parseFloat(item && (item.quantity || item.cantidad)) || 0;
  }
  function getItemUnitPrice(item) {
    const source = getItemSource(item);
    return parseFloat(source.price || source.precio) || 0;
  }
  function getItemLineTotal(item) {
    return (getItemUnitPrice(item) * getItemQuantity(item)).toFixed(2);
  }

  function getOrderStatusBadge(status) {
    if (status === 'nuevo') return '<span class="status-badge nuevo">🟡 Nuevo</span>';
    if (status === 'preparacion') return '<span class="status-badge preparacion">👨‍🌾 En Preparación</span>';
    if (status === 'camino') return '<span class="status-badge camino">🛵 En Camino</span>';
    if (status === 'entregado') return '<span class="status-badge entregado">✅ Entregado</span>';
    if (status === 'cancelado') return '<span class="status-badge" style="background:#F3F4F6; color:#4B5569;">❌ Cancelado</span>';
    return `<span class="status-badge">${status || ''}</span>`;
  }

  function getStatusSelectHtml(order) {
    return `
      <select class="form-select order-status-select" data-order-id="${order.id}" aria-label="Cambiar estado del pedido #${order.id}" title="Cambiar estado">
        <option value="nuevo" ${order.status === 'nuevo' ? 'selected' : ''}>🟡 Nuevo</option>
        <option value="preparacion" ${order.status === 'preparacion' ? 'selected' : ''}>👨‍🌾 En Preparación</option>
        <option value="camino" ${order.status === 'camino' ? 'selected' : ''}>🛵 En Camino</option>
        <option value="entregado" ${order.status === 'entregado' ? 'selected' : ''}>✅ Entregado</option>
        <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
      </select>
    `;
  }

  // Aplica la vista elegida por el administrador (lista o tarjetas), la
  // guarda en localStorage y re-renderiza sin forzar ninguna transformación.
  function setOrdersView(view) {
    currentOrdersView = view === 'grid' ? 'grid' : 'list';
    try {
      localStorage.setItem('preferredOrdersView', currentOrdersView);
    } catch (e) {
      // Modo privado o cuota llena: la vista sigue funcionando en memoria
    }
    updateOrdersViewButtons();
    renderOrdersCards();
  }

  // Resalta el botón activo del selector de vista (estado estilo Google Drive)
  function updateOrdersViewButtons() {
    ordersViewButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-orders-view') === currentOrdersView;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // Vista elegida por el administrador: lista compacta (tabla horizontal con
  // scroll en pantallas pequeñas) o cuadrícula de tarjetas. El detalle completo
  // se abre en el modal en ambas vistas.
  function renderOrdersCards() {
    if (!ordersCardsContainer) return;

    const filtered = orders.filter(order => {
      const archived = isOrderArchived(order);
      if (currentOrderFilter === 'archivados') return archived;
      if (archived) return false; // archivados quedan fuera de la vista del día
      if (currentOrderFilter === 'all') return true;
      return order.status === currentOrderFilter;
    });

    if (filtered.length === 0) {
      const emptyIcon = currentOrderFilter === 'archivados' ? '📦' : '📭';
      const emptyTitle = currentOrderFilter === 'archivados'
        ? 'No hay pedidos archivados'
        : 'No hay pedidos en este estado';
      const emptyText = currentOrderFilter === 'archivados'
        ? 'Usa el botón "Archivar Pedidos Entregados" para limpiar la vista del día.'
        : 'Los nuevos pedidos que los clientes hagan en la tienda aparecerán aquí al instante, sin refrescar.';
      ordersCardsContainer.className = 'orders-list-wrap';
      ordersCardsContainer.innerHTML = `
        <div class="orders-list-empty" style="background: white;">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">${emptyIcon}</div>
          <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 4px;">${emptyTitle}</h3>
          <p style="color: #666; font-size: 0.85rem;">${emptyText}</p>
        </div>
      `;
      return;
    }

    const rowsHtml = filtered.map(order => {
      const orderDate = new Date(order.created_at || Date.now());
      const timeFormatted = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateFormatted = orderDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' });
      const totalAmount = parseFloat(order.total) || 0;
      const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
      const waMsg = encodeURIComponent(`Hola ${order.customerName}, te escribimos de Al Costo sobre tu pedido #${order.id}. ¿Cómo estás?`);
      const waCustomerUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;
      const archived = isOrderArchived(order);

      return `
        <tr class="orders-list-row row-${order.status || 'nuevo'}" data-order-id="${order.id}" tabindex="0" title="Ver detalle completo del pedido #${order.id}">
          <td data-label="Nº Pedido">
            <div class="orders-list-id">#${order.id}</div>
            <div class="orders-list-sub">${order.deliveryType === 'pickup' ? '🏪 Retiro en tienda' : '🛵 Delivery'}</div>
          </td>
          <td data-label="Cliente">
            <div class="orders-list-client">${order.customerName}</div>
            <div class="orders-list-sub">📞 ${order.customerPhone || 'Sin teléfono'}</div>
          </td>
          <td data-label="Hora / Fecha">
            <div class="orders-list-date">${timeFormatted}</div>
            <div class="orders-list-sub">${dateFormatted}</div>
          </td>
          <td data-label="Total">
            <div class="orders-list-total-usd">$${totalAmount.toFixed(2)}</div>
            <div class="orders-list-total-bs">🇻🇪 ${(totalAmount * CURRENCY_RATES.BS).toFixed(2)} Bs</div>
          </td>
          <td data-label="Estado">${getOrderStatusBadge(order.status)}</td>
          <td data-label="Acción">
            <div class="orders-list-actions">
              ${archived ? '' : getStatusSelectHtml(order)}
              <a href="${waCustomerUrl}" target="_blank" rel="noopener" class="btn-order-action btn-wa-action" title="Chatear por WhatsApp con ${order.customerName}" onclick="event.stopPropagation()">💬</a>
              <button class="btn-order-action view-order-modal-btn" data-order-id="${order.id}" style="background: #F8F9FA;" title="Ver detalle completo">🔍 <span class="btn-label">Ver</span></button>
              ${archived ? `<button class="btn-order-action unarchive-order-btn" data-order-id="${order.id}" style="background: #FFF7ED; color: #9A3412; border-color: #FED7AA;" title="Restaurar a la vista del día">↩️</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Tarjetas (vista mosaico) con la misma información de cada pedido
    const cardsHtml = filtered.map(order => {
      const orderDate = new Date(order.created_at || Date.now());
      const timeFormatted = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateFormatted = orderDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' });
      const totalAmount = parseFloat(order.total) || 0;
      const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
      const waMsg = encodeURIComponent(`Hola ${order.customerName}, te escribimos de Al Costo sobre tu pedido #${order.id}. ¿Cómo estás?`);
      const waCustomerUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;
      const archived = isOrderArchived(order);
      const itemsPreviewHtml = (order.items || []).map(i => `
          <div class="order-item-line">
            <span><strong>${getItemQuantity(i)}x</strong> ${getItemName(i)}${getItemUnit(i) ? ` (${getItemUnit(i)})` : ''}</span>
            <strong>$${getItemLineTotal(i)}</strong>
          </div>`).join('');

      return `
        <div class="order-card order-grid-item status-${order.status || 'nuevo'}" data-order-id="${order.id}" tabindex="0" title="Ver detalle completo del pedido #${order.id}">
          <div class="order-card-header">
            <div>
              <div class="order-code">#${order.id}</div>
              <div class="order-time">${dateFormatted} • ${timeFormatted}</div>
            </div>
            ${getOrderStatusBadge(order.status)}
          </div>
          <div class="order-customer-info">
            <div class="order-customer-name">👤 ${order.customerName}</div>
            <div class="order-customer-details">📞 ${order.customerPhone || 'Sin teléfono'} • ${order.deliveryType === 'pickup' ? '🏪 Retiro en tienda' : '🛵 Delivery'}</div>
          </div>
          <div class="order-items-preview">${itemsPreviewHtml || '<em style="color: #94A3B8;">Sin artículos registrados</em>'}</div>
          <div class="order-card-footer">
            <div class="order-total-amount">$${totalAmount.toFixed(2)}</div>
            <div class="orders-list-total-bs">🇻🇪 ${(totalAmount * CURRENCY_RATES.BS).toFixed(2)} Bs</div>
          </div>
          <div class="order-actions-row">
            ${archived ? '' : getStatusSelectHtml(order)}
            <a href="${waCustomerUrl}" target="_blank" rel="noopener" class="btn-order-action btn-wa-action" title="Chatear por WhatsApp con ${order.customerName}" onclick="event.stopPropagation()">💬 WhatsApp</a>
            <button class="btn-order-action view-order-modal-btn" data-order-id="${order.id}" style="background: #F8F9FA;" title="Ver detalle completo">🔍 Ver detalle</button>
            ${archived ? `<button class="btn-order-action unarchive-order-btn" data-order-id="${order.id}" style="background: #FFF7ED; color: #9A3412; border-color: #FED7AA;" title="Restaurar a la vista del día">↩️</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Intercambio dinámico: lista (tabla compacta) o cuadrícula de tarjetas
    const useGridView = currentOrdersView === 'grid';
    ordersCardsContainer.className = useGridView ? 'orders-grid' : 'orders-list-wrap';
    ordersCardsContainer.innerHTML = useGridView
      ? cardsHtml
      : `
      <table class="orders-list-table">
        <thead>
          <tr>
            <th>Nº Pedido</th>
            <th>Cliente</th>
            <th>Hora / Fecha</th>
            <th>Total ($ / Bs.)</th>
            <th>Estado</th>
            <th style="text-align: right;">Acción</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    // Eventos de cambio de estado
    ordersCardsContainer.querySelectorAll('.order-status-select').forEach(select => {
      select.addEventListener('click', (e) => e.stopPropagation());
      select.addEventListener('change', async (e) => {
        e.stopPropagation();
        const id = select.getAttribute('data-order-id');
        const newStatus = select.value;
        await changeOrderStatus(id, newStatus);
      });
    });

    // Eventos de modal detalle
    ordersCardsContainer.querySelectorAll('.view-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openOrderDetail(btn.getAttribute('data-order-id'));
      });
    });

    // Restaurar pedido archivado
    ordersCardsContainer.querySelectorAll('.unarchive-order-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        unarchiveOrder(btn.getAttribute('data-order-id'));
      });
    });

    // Clic en cualquier fila o tarjeta (o Enter con el teclado) = ver detalle
    ordersCardsContainer.querySelectorAll('.orders-list-row, .order-grid-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, select, a, input')) return;
        openOrderDetail(row.getAttribute('data-order-id'));
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.target.closest('button, select, a, input')) {
          openOrderDetail(row.getAttribute('data-order-id'));
        }
      });
    });
  }

  // Guarda los pedidos en localStorage sin romperse si las capturas base64 exceden la cuota (~5MB)
  function persistOrdersLocally() {
    try {
      localStorage.setItem('alcosto_orders', JSON.stringify(orders));
    } catch (e) {
      // Sin capturas en la copia local: la nube sigue siendo la fuente de verdad de las imágenes
      const lean = orders.map(o => ({ ...o, paymentProof: null }));
      try {
        localStorage.setItem('alcosto_orders', JSON.stringify(lean));
      } catch (e2) {
        console.warn('No se pudieron guardar los pedidos en localStorage (cuota llena):', e2);
      }
    }
  }

  async function changeOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;
    persistOrdersLocally();

    // Si Supabase está configurado, actualizar en la nube
    await SupabaseService.updateOrderStatus(orderId, newStatus);

    updateOrdersStats();
    renderOrdersCards();
    showToast(`🔄 Pedido #${orderId} actualizado a "${newStatus}"`, 'success');

    // Si el detalle está abierto en el modal, se refleca el nuevo estado
    if (openOrderId && String(openOrderId) === String(orderId)) {
      openOrderDetail(orderId);
    }
  }

  function openOrderDetail(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !orderDetailModal || !orderDetailModalBody) return;
    openOrderId = order.id;

    // Montos SIEMPRE numéricos: evita "$NaN" en pedidos con envío $0.00,
    // con columna "envio" vacía o de tipo "Retiro en Tienda".
    const subtotalAmount = parseFloat(order.subtotal) || 0;
    const deliveryFeeAmount = parseFloat(order.deliveryFee) || 0;
    const tipAmount = parseFloat(order.tip) || 0;
    const totalAmount = parseFloat(order.total) || 0;
    const isPickup = order.deliveryType === 'pickup';
    const deliveryFeeLabel = isPickup
      ? 'GRATIS (Retiro en Tienda)'
      : (deliveryFeeAmount === 0 ? 'GRATIS' : `$${deliveryFeeAmount.toFixed(2)}`);
    const modalCleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    const waCustomerUrl = `https://wa.me/${modalCleanPhone}?text=${encodeURIComponent(`Hola ${order.customerName}, te escribimos de Al Costo sobre tu pedido #${order.id}. ¿Cómo estás?`)}`;
    const archived = isOrderArchived(order);

    const itemsHtml = (order.items || []).map(i => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
        <span><strong>${getItemQuantity(i)}x</strong> ${getItemName(i)}${getItemUnit(i) ? ` (${getItemUnit(i)})` : ''}</span>
        <strong>$${getItemLineTotal(i)}</strong>
      </div>
    `).join('');

    orderDetailModalBody.innerHTML = `
      <h3 style="font-size: 1.25rem; font-weight: 900; color: var(--color-primary); margin-bottom: 6px;">
        Detalle del Pedido #${order.id}
      </h3>
      <p style="font-size: 0.82rem; color: #666; margin-bottom: 16px;">
        Fecha: ${new Date(order.created_at || Date.now()).toLocaleString()}
      </p>

      <div style="background: #f8f9fa; border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 0.88rem;">
        <div><strong>Cliente:</strong> ${order.customerName}</div>
        <div><strong>Teléfono:</strong> ${order.customerPhone || 'No registrado'}</div>
        <div><strong>Dirección:</strong> ${order.deliveryAddress || (isPickup ? 'Retiro en Tienda Al Costo' : 'Sin dirección registrada')}</div>
        ${order.gpsCoordinates ? `
          <div style="margin-top: 8px;">
            <a href="${order.gpsCoordinates.mapsUrl || `https://www.google.com/maps?q=${order.gpsCoordinates.lat},${order.gpsCoordinates.lng}`}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: #DCFCE7; color: #166534; font-weight: 800; font-size: 0.8rem; padding: 6px 12px; border-radius: 9999px; text-decoration: none; border: 1px solid #86EFAC;">
              🗺️ Abrir Ubicación GPS del Cliente en Google Maps ↗
            </a>
          </div>
        ` : ''}
        <div><strong>Horario:</strong> ${order.deliverySlot || 'A coordinar con el shopper'}</div>
        <div><strong>Método de Pago:</strong> ${order.paymentMethod || 'No especificado'}</div>
        <div><strong>Modalidad:</strong> ${isPickup ? '🏪 Retiro en Tienda' : '🛵 Delivery a domicilio'}</div>
        ${order.instructions ? `<div style="color: #b45309; margin-top: 4px;"><strong>Instrucciones:</strong> ${order.instructions}</div>` : ''}
        ${order.paymentProof ? `
          <div style="margin-top: 10px;">
            <strong>🧾 Captura de Pago Adjunta:</strong>
            <a href="${order.paymentProof}" target="_blank" rel="noopener">
              <img src="${order.paymentProof}" alt="Captura del comprobante de pago" style="display: block; width: 100%; max-height: 260px; object-fit: contain; margin-top: 6px; border-radius: 10px; border: 1px solid #E2E8F0; background: #000;">
            </a>
            <a href="${order.paymentProof}" target="_blank" rel="noopener" style="display: inline-block; margin-top: 8px; color: #108910; font-weight: 800; font-size: 0.82rem; text-decoration: none;">Abrir captura completa ↗</a>
          </div>
        ` : `<div style="margin-top: 10px;"><strong>🧾 Comprobante:</strong> Pago en efectivo / Sin comprobante</div>`}
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 0.95rem; font-weight: 800; margin-bottom: 8px;">Artículos Solicitados:</h4>
        ${itemsHtml}
      </div>

      <div style="border-top: 2px solid var(--color-border); padding-top: 10px; font-size: 0.9rem;">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>$${subtotalAmount.toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Envío:</span> <span>${deliveryFeeLabel}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Propina:</span> <span>$${tipAmount.toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 900; color: #108910; margin-top: 6px;">
          <span>Total:</span>
          <span>$${totalAmount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #C2410C; font-weight: 700; margin-top: 4px;">
          <span>Equivalente:</span>
          <span>🇻🇪 ${(totalAmount * CURRENCY_RATES.BS).toFixed(2)} Bs • 🇨🇴 ${(Math.round(totalAmount * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
        </div>
      </div>

      <!-- Acciones del pedido: WhatsApp + Estado + Archivar -->
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--color-border);">
        <a href="${waCustomerUrl}" target="_blank" rel="noopener" class="btn-order-action btn-wa-action" style="flex: 1; min-width: 170px; min-height: 42px;" title="Chatear por WhatsApp con ${order.customerName}">
          💬 WhatsApp
        </a>
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px;">
          <label for="modalOrderStatusSelect" style="font-size: 0.8rem; font-weight: 700; color: #555; white-space: nowrap;">Estado:</label>
          ${getStatusSelectHtml(order).replace('order-status-select', 'order-status-select modal-order-status-select')}
        </div>
        ${archived
          ? `<button type="button" class="btn-order-action modal-unarchive-btn" data-order-id="${order.id}" style="min-height: 42px; background: #FFF7ED; color: #9A3412; border-color: #FED7AA;">↩️ Desarchivar</button>`
          : (order.status === 'entregado'
            ? `<button type="button" class="btn-order-action modal-archive-btn" data-order-id="${order.id}" style="min-height: 42px; background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE;">📦 Archivar</button>`
            : '')}
      </div>
    `;

    // Acciones del modal: estado, archivo y cierre
    const modalStatusSelect = orderDetailModalBody.querySelector('.modal-order-status-select');
    if (modalStatusSelect) {
      modalStatusSelect.id = 'modalOrderStatusSelect';
      modalStatusSelect.addEventListener('change', async () => {
        await changeOrderStatus(order.id, modalStatusSelect.value);
      });
    }
    const modalArchiveBtn = orderDetailModalBody.querySelector('.modal-archive-btn');
    if (modalArchiveBtn) {
      modalArchiveBtn.addEventListener('click', () => {
        archivedOrderIds.add(String(order.id));
        persistArchivedOrders();
        updateOrdersStats();
        renderOrdersCards();
        orderDetailModal.classList.remove('active');
        openOrderId = null;
        showToast(`📦 Pedido #${order.id} archivado: sale de la vista del día`, 'success');
      });
    }
    const modalUnarchiveBtn = orderDetailModalBody.querySelector('.modal-unarchive-btn');
    if (modalUnarchiveBtn) {
      modalUnarchiveBtn.addEventListener('click', () => {
        unarchiveOrder(order.id);
        openOrderDetail(order.id);
      });
    }

    orderDetailModal.classList.add('active');
  }

  // ==========================================================================
  // GESTIÓN DEL CATÁLOGO DE PRODUCTOS
  // ==========================================================================
  async function loadCatalogProducts() {
    try {
      const saved = localStorage.getItem('alcosto_custom_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          products = parsed;
        } else if (typeof getActiveProducts === 'function') {
          products = getActiveProducts();
        }
      } else {
        // Si no hay productos en localStorage, consultar catálogo en products.js o Supabase
        if (typeof getActiveProducts === 'function') {
          products = getActiveProducts();
        } else if (typeof DEFAULT_PRODUCTS !== 'undefined' && Array.isArray(DEFAULT_PRODUCTS)) {
          products = [...DEFAULT_PRODUCTS];
        } else if (typeof SupabaseService !== 'undefined') {
          const cloud = await SupabaseService.fetchProductsFromSupabase();
          if (cloud && Array.isArray(cloud) && cloud.length > 0) {
            products = cloud;
            localStorage.setItem('alcosto_custom_products', JSON.stringify(products));
          } else {
            products = [];
          }
        } else {
          products = [];
        }
      }
    } catch (e) {
      console.error('Error cargando catálogo:', e);
      products = (typeof DEFAULT_PRODUCTS !== 'undefined') ? [...DEFAULT_PRODUCTS] : [];
    }
    // LA NUBE COMO FUENTE DE VERDAD: si Supabase tiene catálogo publicado (los
    // productos cargados manualmente viven ahí), el panel lo muestra aunque el
    // localStorage de este equipo esté vacío, borrado o corrupto.
    try {
      if (typeof SupabaseService !== 'undefined') {
        const cloudProducts = await SupabaseService.fetchProductsFromSupabase();
        if (Array.isArray(cloudProducts) && cloudProducts.length > 0) {
          const cloudIds = new Set(cloudProducts.map(p => p.id));
          const localDrafts = (Array.isArray(products) ? products : [])
            .filter(p => p && p.id && !cloudIds.has(p.id));
          products = [...cloudProducts, ...localDrafts];
          // Caché local: permite seguir editando si la nube no responde después
          if (typeof saveActiveProducts === 'function') {
            saveActiveProducts(products);
          }
        }
      }
    } catch (cloudError) {
      console.warn('No se pudo consultar el catálogo publicado en Supabase:', cloudError);
    }

    // BLOQUEO: descartar productos demo predeterminados arrastrados desde localStorage o copias viejas
    if (typeof stripLegacyDefaultProducts === 'function') {
      products = sanitizeProductImages(stripLegacyDefaultProducts(products));
    }
    renderProductsTable();
  }

  // Utilidad: cede el hilo principal al navegador evitando que la interfaz
  // se congele mientras se repinta la tabla (crítico en dispositivos móviles).
  function nextAnimationFrames(count = 1) {
    return new Promise(resolve => {
      let remaining = count;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      // Respaldo con temporizador: si rAF está suspendido (pestaña en segundo
      // plano o vista no visible), el proceso nunca debe quedarse colgado.
      const fallbackTimer = setTimeout(done, 400);
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          clearTimeout(fallbackTimer);
          done();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  // Utilidad: limita la frecuencia de eventos muy repetidos
  // (p. ej. cada tecla escrita en el buscador del catálogo).
  function debounce(callback, delay = 180) {
    let timerId = null;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => callback(...args), delay);
    };
  }

  let productsTableRenderSeq = 0;
  const PRODUCTS_TABLE_CHUNK_SIZE = 60;

  async function renderProductsTable() {
    updatePriceAdjustmentProductOptions();
    if (!productsTableBody) return;

    // Token de renderizado: si llega una orden más reciente, esta queda obsoleta
    const renderSeq = ++productsTableRenderSeq;

    const searchTerm = tableSearchInput ? tableSearchInput.value.toLowerCase().trim() : '';
    const categoryFilter = tableCategoryFilter ? tableCategoryFilter.value : 'all';

    const filtered = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm) || p.id.toLowerCase().includes(searchTerm);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
      productsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: #888;">
            No se encontraron productos coincidentes.
          </td>
        </tr>
      `;
      return;
    }

    const rowsHtml = filtered.map(p => {
      const catObj = CATEGORIES.find(c => c.id === p.category);
      // El ícono de FontAwesome se renderiza como <i>, nunca como texto:
      // antes la clase "fa-solid fa-wheat-awn" aparecía escrita dentro del badge.
      const catLabel = catObj ? `<i class="${catObj.icon}" aria-hidden="true"></i> ${catObj.name}` : p.category;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${getProductImageSrc(p.image)}" class="admin-thumb" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${PRODUCT_IMAGE_PLACEHOLDER}'">
              <div>
                <strong>${p.name}</strong>
                <div style="font-size: 0.72rem; color: #888;">ID: ${p.id}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-dept badge-dept-${p.category}">${catLabel}</span>
          </td>
          <td>
            <strong>$${p.price.toFixed(2)}</strong>
            <div style="font-size: 0.73rem; color: #C2410C; font-weight: 600;">🇻🇪 ${(p.price * CURRENCY_RATES.BS).toFixed(2)} Bs</div>
            <div style="font-size: 0.73rem; color: #15803D; font-weight: 600;">🇨🇴 ${(Math.round(p.price * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</div>
            ${p.originalPrice ? `<div style="font-size: 0.7rem; color: #888; text-decoration: line-through;">Tachado: $${p.originalPrice.toFixed(2)}</div>` : ''}
          </td>
          <td>
            ${p.wholesalePrice ? `
              <strong style="color:#108910;">$${p.wholesalePrice.toFixed(2)}</strong>
              <div style="font-size: 0.72rem; color: #C2410C;">${(p.wholesalePrice * CURRENCY_RATES.BS).toFixed(0)} Bs</div>
              <div style="font-size: 0.72rem; color: #15803D;">${(Math.round(p.wholesalePrice * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</div>
              <span style="font-size:0.72rem; color:#666;">(mín ${p.wholesaleMin || 1})</span>
            ` : '<span style="color:#aaa;">-</span>'}
          </td>
          <td>
            <span style="font-size: 0.8rem; color: #555;">${p.unit}</span>
          </td>
          <td style="text-align: right;">
            <button class="btn-action edit-product-btn" data-id="${p.id}">✏️</button>
            <button class="btn-action delete-btn delete-product-btn" data-id="${p.id}">🗑️</button>
          </td>
        </tr>
      `;
    });

    // Pintado por trozos: los catálogos grandes se agregan por fragmentos,
    // cediendo el hilo principal entre ellos para no congelar la interfaz.
    if (rowsHtml.length > PRODUCTS_TABLE_CHUNK_SIZE) {
      productsTableBody.innerHTML = '';
      for (let start = 0; start < rowsHtml.length; start += PRODUCTS_TABLE_CHUNK_SIZE) {
        if (renderSeq !== productsTableRenderSeq) return; // otra renderización más reciente
        productsTableBody.insertAdjacentHTML('beforeend', rowsHtml.slice(start, start + PRODUCTS_TABLE_CHUNK_SIZE).join(''));
        await nextAnimationFrames(1);
      }
      if (renderSeq !== productsTableRenderSeq) return;
    } else {
      productsTableBody.innerHTML = rowsHtml.join('');
    }

    productsTableBody.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => startEditProduct(btn.getAttribute('data-id')));
    });

    productsTableBody.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(btn.getAttribute('data-id')));
    });
  }

  function updatePriceAdjustmentProductOptions() {
    if (!priceAdjustmentProduct) return;

    const selectedId = priceAdjustmentProduct.value;
    priceAdjustmentProduct.replaceChildren();
    products.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = product.name;
      priceAdjustmentProduct.appendChild(option);
    });
    if (products.some(product => product.id === selectedId)) {
      priceAdjustmentProduct.value = selectedId;
    }
    updatePriceAdjustmentPreview();
  }

  function calculateAdjustedPrice(price, adjustment, type, action) {
    const change = type === 'percent' ? price * adjustment / 100 : adjustment;
    const result = Math.round((price + (action === 'increase' ? change : -change)) * 100) / 100;
    return Number.isFinite(result) && result >= 0 ? result : null;
  }

  function updatePriceAdjustmentPreview() {
    if (!priceAdjustmentPreview || !applyPriceAdjustmentBtn) return;

    const adjustment = Number(priceAdjustmentValue.value);
    const type = priceAdjustmentType.value;
    const action = priceAdjustmentAction.value;
    const targets = priceAdjustmentScope.value === 'product'
      ? products.filter(product => product.id === priceAdjustmentProduct.value)
      : products;

    applyPriceAdjustmentBtn.disabled = true;
    if (!targets.length) {
      priceAdjustmentPreview.textContent = 'No hay productos disponibles para aplicar el ajuste.';
      return;
    }
    if (!Number.isFinite(adjustment) || adjustment <= 0) {
      priceAdjustmentPreview.textContent = 'Ingresa un valor mayor que cero para ver la vista previa.';
      return;
    }

    const invalidProduct = targets.find(product => {
      const priceFields = ['price', 'originalPrice', 'wholesalePrice'];
      return priceFields.some(field => {
        const value = product[field];
        if (field !== 'price' && (value === null || value === undefined || value === '')) return false;
        return typeof value !== 'number' || !Number.isFinite(value) ||
          calculateAdjustedPrice(value, adjustment, type, action) === null;
      });
    });

    if (invalidProduct) {
      priceAdjustmentPreview.textContent = `El ajuste dejaría un precio inválido o negativo en "${invalidProduct.name}". Reduce el valor antes de continuar.`;
      return;
    }

    const sample = targets[0];
    const adjustedPrice = calculateAdjustedPrice(sample.price, adjustment, type, action);
    const adjustmentLabel = type === 'percent' ? `${adjustment}%` : `$${adjustment.toFixed(2)}`;
    priceAdjustmentPreview.textContent =
      `${action === 'increase' ? 'Aumentar' : 'Disminuir'} ${adjustmentLabel} en ${targets.length} producto(s). ` +
      `Ejemplo: ${sample.name}, detal $${sample.price.toFixed(2)} → $${adjustedPrice.toFixed(2)}.`;
    applyPriceAdjustmentBtn.disabled = false;
  }

  let isApplyingPriceAdjustment = false;

  async function applyPriceAdjustment() {
    updatePriceAdjustmentPreview();
    if (!applyPriceAdjustmentBtn || applyPriceAdjustmentBtn.disabled || isApplyingPriceAdjustment) return;

    const adjustment = Number(priceAdjustmentValue.value);
    const type = priceAdjustmentType.value;
    const action = priceAdjustmentAction.value;
    const targets = priceAdjustmentScope.value === 'product'
      ? products.filter(product => product.id === priceAdjustmentProduct.value)
      : products;
    const scopeLabel = priceAdjustmentScope.value === 'product' ? targets[0].name : 'todo el catálogo';
    const adjustmentLabel = type === 'percent' ? `${adjustment}%` : `$${adjustment.toFixed(2)}`;

    if (!confirm(`¿${action === 'increase' ? 'Aumentar' : 'Disminuir'} ${adjustmentLabel} los precios de ${scopeLabel}?`)) return;

    // Anti-congelamiento (móvil): bloqueamos reentrada y cedemos el hilo principal
    // para que el navegador pinte el cierre del diálogo antes de procesar.
    isApplyingPriceAdjustment = true;
    const originalBtnLabel = applyPriceAdjustmentBtn.innerHTML;
    applyPriceAdjustmentBtn.disabled = true;
    applyPriceAdjustmentBtn.innerHTML = '⏳ Aplicando cambios...';

    try {
      await nextAnimationFrames(2);

      // Set de IDs: evita el bucle anidado O(n×m) al recorrer el catálogo completo
      const targetIds = new Set(targets.map(target => target.id));
      const updatedProducts = products.map(product => {
        if (!targetIds.has(product.id)) return product;
        const updated = { ...product };
        ['price', 'originalPrice', 'wholesalePrice'].forEach(field => {
          if (typeof product[field] === 'number' && Number.isFinite(product[field])) {
            updated[field] = calculateAdjustedPrice(product[field], adjustment, type, action);
          }
        });
        return updated;
      });

      products = updatedProducts;
      if (typeof saveActiveProducts === 'function') {
        saveActiveProducts(products);
      } else {
        localStorage.setItem('alcosto_custom_products', JSON.stringify(products));
      }

      // Repintamos en el siguiente frame para no bloquear el hilo de UI
      await nextAnimationFrames(2);
      renderProductsTable();
      showToast(`✅ Precios actualizados en ${targets.length} producto(s)`, 'success');

      // La sincronización con Supabase es asíncrona: no detiene la interfaz
      if (typeof SupabaseService !== 'undefined') {
        const sbConfig = SupabaseService.getConfig();
        if (sbConfig && sbConfig.connected) {
          try {
            const syncResult = await SupabaseService.syncProductsToSupabase(products);
            notifyBarcodeSyncWarning(syncResult);
          } catch (err) {
            console.error('No se pudieron sincronizar los precios con Supabase:', err);
            showToast('⚠️ Los precios se guardaron localmente, pero no se pudieron publicar en Supabase.', 'warning');
          }
        }
      }
    } catch (err) {
      console.error('Error al aplicar el ajuste masivo de precios:', err);
      showToast('⚠️ No se pudo completar el ajuste de precios', 'error');
    } finally {
      isApplyingPriceAdjustment = false;
      applyPriceAdjustmentBtn.innerHTML = originalBtnLabel;
      updatePriceAdjustmentPreview(); // re-habilita el botón solo si el ajuste sigue siendo válido
    }
  }

  function startEditProduct(id) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    editingProductId = id;
    if (formTitle) formTitle.textContent = `✏️ Editando: ${prod.name}`;
    if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';

    prodIdInput.value = prod.id;
    prodIdInput.disabled = true;
    if (prodBarcodeInput) prodBarcodeInput.value = prod.barcode || '';
    prodNameInput.value = prod.name;
    if (!Array.from(prodCategoryInput.options).some(option => option.value === prod.category)) {
      const legacyCategoryOption = document.createElement('option');
      legacyCategoryOption.value = prod.category;
      legacyCategoryOption.textContent = `Categoría anterior (${prod.category})`;
      legacyCategoryOption.dataset.legacyCategory = 'true';
      prodCategoryInput.appendChild(legacyCategoryOption);
    }
    prodCategoryInput.value = prod.category;
    prodPriceInput.value = prod.price;
    prodOriginalPriceInput.value = prod.originalPrice || '';
    prodWholesalePriceInput.value = prod.wholesalePrice || '';
    prodWholesaleMinInput.value = prod.wholesaleMin || '';
    prodUnitInput.value = prod.unit;
    prodImageInput.value = prod.image;
    prodBadgeInput.value = prod.badge || '';
    if (prodDescriptionInput) prodDescriptionInput.value = prod.description || '';

    // Vista previa de imagen del producto al editar
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewName = document.getElementById('imagePreviewName');
    if (prod.image && imagePreview && imagePreviewContainer) {
      imagePreview.src = prod.image;
      if (imagePreviewName) imagePreviewName.textContent = prod.name;
      imagePreviewContainer.style.display = 'flex';
    } else if (imagePreviewContainer) {
      imagePreviewContainer.style.display = 'none';
    }

    productForm.scrollIntoView({ behavior: 'smooth' });
    showToast(`✏️ Editando "${prod.name}"`);
  }

  function cancelEdit() {
    editingProductId = null;
    if (formTitle) formTitle.textContent = '➕ Agregar o Editar Producto';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    prodIdInput.disabled = false;
    prodCategoryInput.querySelectorAll('[data-legacy-category="true"]').forEach(option => option.remove());
    productForm.reset();
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const prodImageUpload = document.getElementById('prodImageUpload');
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    if (prodImageUpload) prodImageUpload.value = '';
    if (prodBarcodeInput) prodBarcodeInput.value = '';
    prodIdInput.value = 'prod-' + Date.now().toString().slice(-4);
  }

  function deleteProduct(id) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    if (confirm(`¿Eliminar "${prod.name}" del catálogo?`)) {
      products = products.filter(p => p.id !== id);
      if (typeof saveActiveProducts === 'function') {
        saveActiveProducts(products);
      } else {
        localStorage.setItem('alcosto_custom_products', JSON.stringify(products));
      }
      renderProductsTable();
      showToast(`🗑️ "${prod.name}" eliminado del catálogo`);

      // El borrado también se baja del catálogo publicado para que la tienda deje de mostrarlo
      if (typeof SupabaseService !== 'undefined' && SupabaseService.getConfig().connected) {
        SupabaseService.deleteProductFromSupabase(id)
          .then(res => {
            if (res && res.ok) {
              showToast('☁️ También se eliminó del catálogo publicado (Supabase)', 'success');
            } else {
              showToast('⚠️ Se borró en este dispositivo; pulsa "Publicar en Supabase" para borrarlo también de la nube', 'warning');
            }
          })
          .catch(() => {});
      }
    }
  }

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = (prodIdInput && prodIdInput.value.trim()) || 'prod-' + Date.now().toString().slice(-4);
      const barcode = prodBarcodeInput ? prodBarcodeInput.value.trim() : '';
      const name = prodNameInput.value.trim();
      const category = prodCategoryInput.value;
      const price = parseFloat(prodPriceInput.value);
      const originalPrice = prodOriginalPriceInput.value ? parseFloat(prodOriginalPriceInput.value) : null;
      const wholesalePrice = prodWholesalePriceInput.value ? parseFloat(prodWholesalePriceInput.value) : null;
      const wholesaleMin = prodWholesaleMinInput.value ? parseInt(prodWholesaleMinInput.value, 10) : 1;
      const unit = prodUnitInput.value.trim();
      const image = (typeof sanitizeProductImage === 'function') ? sanitizeProductImage(prodImageInput.value.trim()) : prodImageInput.value.trim();
      const badge = prodBadgeInput.value.trim();
      // El textarea de descripción fue retirado del formulario: al editar se conserva la descripción existente
      const description = prodDescriptionInput
        ? prodDescriptionInput.value.trim()
        : ((editingProductId && products.find(p => p.id === editingProductId)?.description) || '');

      const payload = {
        id,
        barcode,
        name,
        category,
        price,
        originalPrice,
        wholesalePrice,
        wholesaleMin,
        unit,
        image,
        badge: badge || (wholesalePrice ? 'Al Mayor 📦' : null),
        tag: originalPrice ? 'oferta' : 'popular',
        isOrganic: false,
        isWholesale: Boolean(wholesalePrice || category === 'al-mayor'),
        rating: 4.9,
        reviews: 140,
        description,
        origin: 'Al Costo Supermercado'
      };

      if (editingProductId) {
        const idx = products.findIndex(p => p.id === editingProductId);
        if (idx > -1) products[idx] = { ...products[idx], ...payload };
        showToast(`✅ "${name}" actualizado y publicado en tienda`, 'success');
      } else {
        products.unshift(payload);
        showToast(`🎉 "${name}" publicado exitosamente en la tienda`, 'success');
      }

      // Guardar y sincronizar instantáneamente con index.html
      if (typeof saveActiveProducts === 'function') {
        saveActiveProducts(products);
      } else {
        localStorage.setItem('alcosto_custom_products', JSON.stringify(products));
      }

      cancelEdit();
      renderProductsTable();

      // Si Supabase está conectado, sincronizar en segundo plano
      if (typeof SupabaseService !== 'undefined') {
        const sbConfig = SupabaseService.getConfig();
        if (sbConfig && sbConfig.connected) {
          try {
            const syncResult = await SupabaseService.syncProductsToSupabase(products);
            notifyBarcodeSyncWarning(syncResult);
            console.log('✓ Catálogo sincronizado automáticamente con Supabase');
          } catch(err) {
            console.warn('No se pudo sincronizar automáticamente con Supabase:', err);
          }
        }
      }
    });
  }

  if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

  // ==========================================================================
  // CONEXIÓN Y SINCRONIZACIÓN CON SUPABASE
  // ==========================================================================
  function initSupabaseConfig() {
    const config = SupabaseService.getAdminConfig();
    if (supabaseUrlInput) supabaseUrlInput.value = config.url || '';
    if (supabaseAnonKeyInput) supabaseAnonKeyInput.value = config.anonKey || '';

    updateSupabaseStatusPill(config.connected);
  }

  function updateSupabaseStatusPill(isConnected) {
    if (supabaseConnectionBadge) {
      if (isConnected) {
        supabaseConnectionBadge.className = 'supabase-status-pill connected';
        supabaseConnectionBadge.innerHTML = '🟢 Conectado';
      } else {
        supabaseConnectionBadge.className = 'supabase-status-pill disconnected';
        supabaseConnectionBadge.innerHTML = '🔴 Desconectado';
      }
    }
    if (supabaseNavStatus) {
      supabaseNavStatus.textContent = isConnected ? '🟢' : '🔴';
    }
  }

  if (supabaseConfigForm) {
    supabaseConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = supabaseUrlInput.value.trim();
      const key = supabaseAnonKeyInput.value.trim();

      SupabaseService.saveConfig(url, key);
      showToast('💾 Credenciales de Supabase guardadas');

      await testSupabase();
    });
  }

  async function testSupabase() {
    if (supabaseFeedbackAlert) {
      supabaseFeedbackAlert.style.display = 'block';
      supabaseFeedbackAlert.style.background = '#EFF6FF';
      supabaseFeedbackAlert.style.color = '#1E40AF';
      supabaseFeedbackAlert.innerHTML = '⏳ Conectando con Supabase...';
    }

    const res = await SupabaseService.testConnection();

    if (supabaseFeedbackAlert) {
      supabaseFeedbackAlert.style.display = 'block';
      if (res.success) {
        supabaseFeedbackAlert.style.background = '#DCFCE7';
        supabaseFeedbackAlert.style.color = '#166534';
        supabaseFeedbackAlert.innerHTML = res.message;
        updateSupabaseStatusPill(true);
      } else {
        supabaseFeedbackAlert.style.background = '#FEE2E2';
        supabaseFeedbackAlert.style.color = '#991B1B';
        supabaseFeedbackAlert.innerHTML = res.message;
        updateSupabaseStatusPill(false);
      }
    }
  }

  async function pushProductsToSupabase() {
    const config = SupabaseService.getConfig();
    if (!config.url || !config.anonKey) {
      alert('Debes configurar la URL y la Anon Key de Supabase en la pestaña "Supabase" antes de publicar.');
      // Cambiar a la pestaña de Supabase
      const supabaseTabBtn = document.querySelector('[data-tab="tab-supabase"]');
      if (supabaseTabBtn) supabaseTabBtn.click();
      return;
    }

    showToast('⏳ Publicando catálogo en el servidor de Supabase...');

    try {
      const syncResult = await SupabaseService.syncProductsToSupabase(products);
      notifyBarcodeSyncWarning(syncResult);
      showToast(`🚀 ¡Éxito! ${products.length} productos publicados en Supabase`, 'success');
      updateSupabaseStatusPill(true);
    } catch (err) {
      alert('Error publicando en Supabase: ' + err.message + '\n\nVerifica que hayas ejecutado el código SQL en el SQL Editor de Supabase.');
    }
  }

  if (publishToSupabaseBtn) publishToSupabaseBtn.addEventListener('click', pushProductsToSupabase);
  if (pushToSupabaseDirectBtn) pushToSupabaseDirectBtn.addEventListener('click', pushProductsToSupabase);
  if (testSupabaseBtn) testSupabaseBtn.addEventListener('click', testSupabase);

  // Copiar SQL
  if (copySqlBtn) {
    copySqlBtn.addEventListener('click', () => {
      const sqlSnippet = document.getElementById('sqlSnippet');
      if (sqlSnippet) {
        navigator.clipboard.writeText(sqlSnippet.textContent.trim()).then(() => {
          showToast('📋 Código SQL copiado al portapapeles', 'success');
        });
      }
    });
  }

  // Descargar Copia JSON de respaldo
  if (exportBackupJsonBtn) {
    exportBackupJsonBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'productos.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('📥 Copia "productos.json" descargada', 'success');
    });
  }

  function validateImportedProducts(data) {
    const imported = Array.isArray(data) ? data : data && data.products;
    if (!Array.isArray(imported) || imported.length === 0) {
      throw new Error('El JSON debe contener una lista de productos no vacía.');
    }

    const seenIds = new Set();
    return imported.map((product, index) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        throw new Error(`El producto en la posición ${index + 1} no es válido.`);
      }

      const id = String(product.id || '').trim();
      const name = String(product.name || '').trim();
      const category = String(product.category || '').trim();
      const hasPriceValue = typeof product.price === 'number' ||
        (typeof product.price === 'string' && product.price.trim() !== '');
      const price = Number(product.price);
      if (!id || !name || !category || !hasPriceValue || !Number.isFinite(price) || price < 0) {
        throw new Error(`El producto en la posición ${index + 1} necesita ID, nombre, departamento y un precio válido.`);
      }
      if (seenIds.has(id)) {
        throw new Error(`El ID "${id}" está repetido en el archivo.`);
      }
      seenIds.add(id);

      const importedOptionalPrice = (camelName, snakeName) => {
        const value = product[camelName] ?? product[snakeName];
        if (value === null || value === undefined || value === '') return null;
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new Error(`El precio "${camelName}" del producto "${name}" no es válido.`);
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error(`El precio "${camelName}" del producto "${name}" no es válido.`);
        }
        return parsed;
      };

      return {
        ...product,
        id,
        name,
        category,
        price,
        barcode: String(product.barcode || product.bar_code || '').trim(),
        originalPrice: importedOptionalPrice('originalPrice', 'original_price'),
        wholesalePrice: importedOptionalPrice('wholesalePrice', 'wholesale_price'),
        wholesaleMin: Number(product.wholesaleMin ?? product.wholesale_min) || 1,
        unit: String(product.unit || ''),
        image: String(product.image || ''),
        isWholesale: Boolean(product.isWholesale ?? product.is_wholesale)
      };
    });
  }

  function saveImportedProducts(importedProducts) {
    // BLOQUEO: los respaldos JSON no pueden reimportar los productos demo predeterminados
    if (typeof stripLegacyDefaultProducts === 'function') {
      importedProducts = stripLegacyDefaultProducts(importedProducts);
    }
    if (typeof saveActiveProducts === 'function') {
      saveActiveProducts(importedProducts);
    } else {
      localStorage.setItem('alcosto_custom_products', JSON.stringify(importedProducts));
    }

    const saved = localStorage.getItem('alcosto_custom_products');
    if (!saved) throw new Error('No se pudo guardar el catálogo en este dispositivo.');
    const savedProducts = JSON.parse(saved);
    const savedSuccessfully = Array.isArray(savedProducts) &&
      savedProducts.length === importedProducts.length &&
      importedProducts.every((product, index) =>
        savedProducts[index] && savedProducts[index].id === product.id &&
        savedProducts[index].price === product.price
      );
    if (!savedSuccessfully) throw new Error('No se pudo verificar el catálogo importado en este dispositivo.');
  }

  function notifyBarcodeSyncWarning(syncResult) {
    if (syncResult && syncResult.barcodeNotSynced) {
      showToast('⚠️ Catálogo publicado, pero los códigos de barras siguen solo en este dispositivo. Ejecuta el SQL actualizado para añadir la columna barcode en Supabase.', 'warning');
    }
  }

  if (importBackupJsonBtn && importBackupJsonInput) {
    importBackupJsonBtn.addEventListener('click', () => importBackupJsonInput.click());
    importBackupJsonInput.addEventListener('change', async () => {
      const file = importBackupJsonInput.files && importBackupJsonInput.files[0];
      if (!file) return;

      try {
        const importedProducts = validateImportedProducts(JSON.parse(await file.text()));
        if (!confirm(`El archivo contiene ${importedProducts.length} productos. Esto reemplazará el catálogo actual en este dispositivo. ¿Deseas continuar?`)) return;

        saveImportedProducts(importedProducts);
        products = importedProducts;
        renderProductsTable();
        showToast(`✅ Se importaron ${products.length} productos desde el archivo JSON`, 'success');

        if (typeof SupabaseService !== 'undefined') {
          const sbConfig = SupabaseService.getConfig();
          if (sbConfig && sbConfig.connected) {
            try {
              const syncResult = await SupabaseService.syncProductsToSupabase(products);
              notifyBarcodeSyncWarning(syncResult);
            } catch (err) {
              console.error('No se pudo sincronizar el catálogo importado con Supabase:', err);
              showToast('⚠️ Catálogo importado localmente, pero no se pudo publicar en Supabase.', 'warning');
            }
          }
        }
      } catch (err) {
        console.error('No se pudo importar el catálogo JSON:', err);
        showToast(`❌ No se pudo importar: ${err.message}`, 'warning');
      } finally {
        importBackupJsonInput.value = '';
      }
    });
  }

  // BLOQUEO: se eliminó el botón "Cargar Catálogo (products.js)" y su manejador.
  // Los 24 productos demo predeterminados fueron borrados de Supabase y están
  // incluidos en LEGACY_DEFAULT_PRODUCT_IDS (js/products.js) para que no puedan volver.

  // ==========================================================================
  // EVENT LISTENERS ADICIONALES
  // ==========================================================================
  function setupEventListeners() {
    if (priceAdjustmentScope) {
      priceAdjustmentScope.addEventListener('change', () => {
        if (priceAdjustmentProductGroup) {
          priceAdjustmentProductGroup.style.display = priceAdjustmentScope.value === 'product' ? 'flex' : 'none';
        }
        updatePriceAdjustmentPreview();
      });
    }
    if (priceAdjustmentProduct) priceAdjustmentProduct.addEventListener('change', updatePriceAdjustmentPreview);
    if (priceAdjustmentAction) priceAdjustmentAction.addEventListener('change', updatePriceAdjustmentPreview);
    if (priceAdjustmentType) priceAdjustmentType.addEventListener('change', updatePriceAdjustmentPreview);
    if (priceAdjustmentValue) priceAdjustmentValue.addEventListener('input', updatePriceAdjustmentPreview);
    if (applyPriceAdjustmentBtn) applyPriceAdjustmentBtn.addEventListener('click', applyPriceAdjustment);

    // Calculadora de precios desplegable (accordion) dentro del Catálogo:
    // oculta por defecto para no consumir espacio vertical en móvil.
    const priceCalculatorToggleBtn = document.getElementById('priceCalculatorToggleBtn');
    const priceCalculatorPanel = document.getElementById('priceCalculatorPanel');
    if (priceCalculatorToggleBtn && priceCalculatorPanel) {
      priceCalculatorToggleBtn.addEventListener('click', () => {
        const isOpen = priceCalculatorToggleBtn.getAttribute('aria-expanded') === 'true';
        priceCalculatorToggleBtn.setAttribute('aria-expanded', String(!isOpen));
        priceCalculatorPanel.hidden = isOpen;
        if (!isOpen) updatePriceAdjustmentPreview();
      });
    }

    const startBarcodeScannerBtn = document.getElementById('startBarcodeScannerBtn');
    const stopBarcodeScannerBtn = document.getElementById('stopBarcodeScannerBtn');
    const barcodeScannerPanel = document.getElementById('barcodeScannerPanel');
    const barcodeScannerStatus = document.getElementById('barcodeScannerStatus');
    const barcodeScannerVideo = document.getElementById('barcodeScannerVideo');
    let barcodeCameraStream = null;
    let barcodeScanFrame = null;
    let barcodeDetector = null;
    let isScanningBarcode = false;

    function stopBarcodeScanner() {
      isScanningBarcode = false;
      if (barcodeScanFrame !== null) {
        cancelAnimationFrame(barcodeScanFrame);
        barcodeScanFrame = null;
      }
      if (barcodeCameraStream) {
        barcodeCameraStream.getTracks().forEach(track => track.stop());
        barcodeCameraStream = null;
      }
      if (barcodeScannerVideo) barcodeScannerVideo.srcObject = null;
      if (barcodeScannerPanel) barcodeScannerPanel.hidden = true;
    }

    async function scanBarcodeFrame() {
      if (!isScanningBarcode || !barcodeScannerVideo || !barcodeDetector) return;
      if (barcodeScannerVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        barcodeScanFrame = requestAnimationFrame(scanBarcodeFrame);
        return;
      }

      try {
        const codes = await barcodeDetector.detect(barcodeScannerVideo);
        if (codes.length > 0 && codes[0].rawValue) {
          if (prodBarcodeInput) {
            prodBarcodeInput.value = codes[0].rawValue;
            prodBarcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          stopBarcodeScanner();
          showToast('✅ Código de barras escaneado', 'success');
          return;
        }
      } catch (err) {
        console.warn('No se pudo leer el código de barras en este fotograma:', err);
        stopBarcodeScanner();
        if (barcodeScannerPanel) barcodeScannerPanel.hidden = false;
        if (barcodeScannerVideo) barcodeScannerVideo.hidden = true;
        if (barcodeScannerStatus) barcodeScannerStatus.textContent = 'No se pudo leer el código. Cierra el lector e inténtalo otra vez.';
        return;
      }

      if (isScanningBarcode) barcodeScanFrame = requestAnimationFrame(scanBarcodeFrame);
    }

    if (startBarcodeScannerBtn) {
      startBarcodeScannerBtn.addEventListener('click', async () => {
        if (!barcodeScannerPanel || !barcodeScannerStatus || !barcodeScannerVideo) return;
        stopProductCamera(); // solo una cámara activa a la vez
        barcodeScannerPanel.hidden = false;

        if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          barcodeScannerVideo.hidden = true;
          barcodeScannerStatus.textContent = 'La cámara requiere abrir el panel con HTTPS y permitir el acceso a la cámara.';
          return;
        }
        if (!('BarcodeDetector' in window)) {
          barcodeScannerVideo.hidden = true;
          barcodeScannerStatus.textContent = 'Este navegador no admite escaneo automático. Escribe el código de barras manualmente.';
          return;
        }

        try {
          const commonFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
          const supportedFormats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
            ? await window.BarcodeDetector.getSupportedFormats()
            : commonFormats;
          const formats = commonFormats.filter(format => supportedFormats.includes(format));
          if (!formats.length) {
            barcodeScannerVideo.hidden = true;
            barcodeScannerStatus.textContent = 'Este navegador no admite formatos de barras comunes. Puedes escribir el código manualmente.';
            return;
          }

          barcodeDetector = new window.BarcodeDetector({ formats });
          barcodeCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
          });
          barcodeScannerVideo.hidden = false;
          barcodeScannerVideo.srcObject = barcodeCameraStream;
          await barcodeScannerVideo.play();
          barcodeScannerStatus.textContent = 'Apunta la cámara trasera al código de barras.';
          isScanningBarcode = true;
          scanBarcodeFrame();
        } catch (err) {
          console.error('No se pudo iniciar el lector de barras:', err);
          if (barcodeCameraStream) {
            barcodeCameraStream.getTracks().forEach(track => track.stop());
            barcodeCameraStream = null;
          }
          barcodeScannerVideo.srcObject = null;
          barcodeScannerVideo.hidden = true;
          barcodeScannerStatus.textContent = err.name === 'NotAllowedError'
            ? 'No hay permiso para usar la cámara. Habilítalo en el navegador o escribe el código manualmente.'
            : 'No se pudo abrir la cámara. Comprueba que esté disponible y vuelve a intentarlo.';
        }
      });
    }
    if (stopBarcodeScannerBtn) stopBarcodeScannerBtn.addEventListener('click', stopBarcodeScanner);
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('data-tab') !== 'tab-catalog') {
          stopBarcodeScanner();
          stopProductCamera();
        }
      });
    });
    window.addEventListener('pagehide', stopBarcodeScanner);

    // Filtros de Pedidos
    orderFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        orderFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentOrderFilter = btn.getAttribute('data-order-filter');
        renderOrdersCards();
      });
    });

    // Selector de vista Lista / Tarjetas (estilo Google Drive): respeta la
    // elección del administrador y la persiste en localStorage
    ordersViewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setOrdersView(btn.getAttribute('data-orders-view'));
      });
    });

    if (refreshOrdersBtn) {
      refreshOrdersBtn.addEventListener('click', () => {
        loadOrders();
        showToast('🔄 Lista de compras actualizada');
      });
    }

    // Archivar pedidos entregados: limpia la vista de operación del día
    if (archiveDeliveredBtn) {
      archiveDeliveredBtn.addEventListener('click', archiveDeliveredOrders);
    }

    if (simulateDemoOrderBtn) {
      simulateDemoOrderBtn.addEventListener('click', () => {
        const demo = createSampleOrder();
        demo.customerName = ['Carlos Ruiz', 'Sofía Márquez', 'Alejandro Morales', 'Lucía Fernández'][Math.floor(Math.random() * 4)];
        orders.unshift(demo);
        // persistOrdersLocally tolera la cuota llena de localStorage (capturas base64)
        persistOrdersLocally();
        updateOrdersStats();
        renderOrdersCards();
        // Un pedido recién creado también dispara la alarma estilo delivery
        detectNewOrdersAndAlarm();
      });
    }

    // Modal detalle pedido
    if (closeOrderDetailModalBtn && orderDetailModal) {
      closeOrderDetailModalBtn.addEventListener('click', () => {
        orderDetailModal.classList.remove('active');
        openOrderId = null;
      });
    }
    // Clic fuera del modal (overlay) o tecla Escape para cerrar
    if (orderDetailModal) {
      orderDetailModal.addEventListener('click', (e) => {
        if (e.target === orderDetailModal) {
          orderDetailModal.classList.remove('active');
          openOrderId = null;
        }
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && orderDetailModal && orderDetailModal.classList.contains('active')) {
        orderDetailModal.classList.remove('active');
        openOrderId = null;
      }
    });

    // Búsqueda en tabla
    // Debounce: al escribir en el buscador no se repinta la tabla en cada tecla
    // (en móvil eso provoca saltos y "congelamiento" con catálogos grandes).
    if (tableSearchInput) tableSearchInput.addEventListener('input', debounce(renderProductsTable, 180));
    if (tableCategoryFilter) tableCategoryFilter.addEventListener('change', renderProductsTable);

    // --- MANEJO DE UPLOAD DE IMÁGENES DE PRODUCTOS ---
    const prodImageUpload = document.getElementById('prodImageUpload');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewName = document.getElementById('imagePreviewName');
    const removeUploadedImageBtn = document.getElementById('removeUploadedImageBtn');

    if (prodImageUpload) {
      prodImageUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            // 900px en el lado largo: suficiente para tarjetas Retina/HiDPI y el
            // modal de vista rápida sin verse pixelado (antes 500px se veía borroso)
            const maxDim = 900;
            let width = img.width;
            let height = img.height;
            if (width > height && width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png') || file.type === 'image/webp';
            // WebP comprime mucho mejor que PNG/JPEG manteniendo la transparencia
            let webpSupported = false;
            try {
              webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
            } catch (err) { webpSupported = false; }
            
            // Si la imagen es PNG o subida, limpiar fondos oscuros/negros artificiales
            if (isPng) {
              try {
                const imgData = ctx.getImageData(0, 0, width, height);
                const data = imgData.data;
                // Muestrear las esquinas para detectar si tiene fondo negro artificial (#000000 o muy oscuro)
                const topLeftR = data[0], topLeftG = data[1], topLeftB = data[2];
                const isBlackBg = (topLeftR < 18 && topLeftG < 18 && topLeftB < 18 && data[3] > 200);

                if (isBlackBg) {
                  // Reemplazar píxeles negros/muy oscuros de fondo por transparencia completa (alpha = 0)
                  for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i+1], b = data[i+2];
                    if (r < 22 && g < 22 && b < 22) {
                      data[i+3] = 0; // Transparente
                    }
                  }
                  ctx.putImageData(imgData, 0, 0);
                }
              } catch(err) {
                console.warn('Filtro de transparencia:', err);
              }
            }

            const outputMime = webpSupported ? 'image/webp' : (isPng ? 'image/png' : 'image/jpeg');
            const outputQuality = (outputMime === 'image/png') ? undefined : 0.86;

            const compressedDataUrl = canvas.toDataURL(outputMime, outputQuality);
            prodImageInput.value = compressedDataUrl;
            if (imagePreview) imagePreview.src = compressedDataUrl;
            if (imagePreviewName) imagePreviewName.textContent = file.name;
            if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
            showToast('📸 Foto con fondo transparente y limpio cargada con éxito', 'success');
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (removeUploadedImageBtn) {
      removeUploadedImageBtn.addEventListener('click', () => {
        if (prodImageUpload) prodImageUpload.value = '';
        if (prodImageInput) prodImageInput.value = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
        if (imagePreview) imagePreview.src = '';
      });
    }

    if (prodImageInput) {
      prodImageInput.addEventListener('input', () => {
        const val = prodImageInput.value.trim();
        if (val && (val.startsWith('http') || val.startsWith('data:image'))) {
          if (imagePreview) imagePreview.src = val;
          if (imagePreviewName) imagePreviewName.textContent = 'Imagen desde URL';
          if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
        } else {
          if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
        }
      });
    }

    // ==========================================================================
    // FOTO DE PRODUCTO CON IA: CÁMARA -> REMOCIÓN DE FONDO -> COMPRESIÓN -> USO
    // Reaprovecha la cámara del panel y añade el procesamiento automático con IA
    // (el lector de código de barras se mantiene intacto).
    // ==========================================================================
    const takeProductPhotoBtn = document.getElementById('takeProductPhotoBtn');
    const productPhotoCaptureInput = document.getElementById('productPhotoCaptureInput');
    const productCameraPanel = document.getElementById('productCameraPanel');
    const productCameraVideo = document.getElementById('productCameraVideo');
    const productCameraStatus = document.getElementById('productCameraStatus');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const closeProductCameraBtn = document.getElementById('closeProductCameraBtn');
    const aiPhotoPanel = document.getElementById('aiPhotoPanel');
    const aiPhotoProcessing = document.getElementById('aiPhotoProcessing');
    const aiPhotoProgressText = document.getElementById('aiPhotoProgressText');
    const aiPhotoResult = document.getElementById('aiPhotoResult');
    const aiPhotoPreview = document.getElementById('aiPhotoPreview');
    const aiPhotoEngineBadge = document.getElementById('aiPhotoEngineBadge');
    const aiPhotoSizeBadge = document.getElementById('aiPhotoSizeBadge');
    const aiPhotoDimsBadge = document.getElementById('aiPhotoDimsBadge');
    const aiPhotoHint = document.getElementById('aiPhotoHint');
    const useAiPhotoBtn = document.getElementById('useAiPhotoBtn');
    const retryAiPhotoBtn = document.getElementById('retryAiPhotoBtn');
    const discardAiPhotoBtn = document.getElementById('discardAiPhotoBtn');
    const cancelAiPhotoBtn = document.getElementById('cancelAiPhotoBtn');

    // Deslizadores de retoque manual en el modal de previsualización
    const aiAdjBrightness = document.getElementById('aiAdjBrightness');
    const aiAdjSaturation = document.getElementById('aiAdjSaturation');
    const aiAdjContrast = document.getElementById('aiAdjContrast');
    const aiAdjBrightnessVal = document.getElementById('aiAdjBrightnessVal');
    const aiAdjSaturationVal = document.getElementById('aiAdjSaturationVal');
    const aiAdjContrastVal = document.getElementById('aiAdjContrastVal');

    let productCameraStream = null;
    let aiJobId = 0;
    let aiRawSource = null;
    let aiResultDataUrl = '';

    function stopProductCamera() {
      if (productCameraStream) {
        productCameraStream.getTracks().forEach(track => track.stop());
        productCameraStream = null;
      }
      if (productCameraVideo) productCameraVideo.srcObject = null;
      if (capturePhotoBtn) capturePhotoBtn.disabled = true;
      if (productCameraPanel) productCameraPanel.hidden = true;
      // Botón principal de cámara visible de nuevo al cerrar el visor (un solo botón de captura a la vez)
      if (takeProductPhotoBtn) takeProductPhotoBtn.style.display = 'inline-flex';
    }

    function openNativePhotoCapture(reason) {
      if (reason) showToast(reason);
      if (productPhotoCaptureInput) {
        productPhotoCaptureInput.value = '';
        productPhotoCaptureInput.click();
      }
    }

    async function openProductCamera() {
      if (typeof stopBarcodeScanner === 'function') stopBarcodeScanner();

      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        openNativePhotoCapture('ℹ️ Este navegador no permite la cámara en vivo: abrimos la cámara de tu sistema.');
        return;
      }

      if (productCameraPanel) productCameraPanel.hidden = false;
      // Se oculta el botón principal mientras el visor está abierto: queda un único botón de captura ("Capturar foto")
      if (takeProductPhotoBtn) takeProductPhotoBtn.style.display = 'none';
      if (productCameraStatus) productCameraStatus.textContent = 'Abriendo cámara...';
      if (capturePhotoBtn) capturePhotoBtn.disabled = true;

      try {
        productCameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (productCameraVideo) {
          productCameraVideo.srcObject = productCameraStream;
          await productCameraVideo.play();
        }
        if (productCameraStatus) productCameraStatus.textContent = 'Coloca el producto dentro del encuadre y pulsa "Capturar foto".';
        if (capturePhotoBtn) capturePhotoBtn.disabled = false;
      } catch (err) {
        console.warn('No se pudo abrir la cámara del producto:', err);
        stopProductCamera();
        openNativePhotoCapture(err && err.name === 'NotAllowedError'
          ? '📵 Sin permiso para la cámara en vivo: usamos la cámara de tu sistema.'
          : 'ℹ️ Cámara en vivo no disponible: abrimos la cámara de tu sistema.');
      }
    }

    function captureProductPhoto() {
      const video = productCameraVideo;
      if (!video || !video.videoWidth || !video.videoHeight) {
        if (productCameraStatus) productCameraStatus.textContent = 'La cámara aún no está lista, intenta de nuevo.';
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      stopProductCamera();
      startAiPhotoProcessing(canvas);
    }

    function showAiPanelState(state) {
      if (!aiPhotoPanel) return;
      aiPhotoPanel.hidden = false;
      const processing = state === 'processing';
      if (aiPhotoProcessing) aiPhotoProcessing.hidden = !processing;
      if (aiPhotoResult) aiPhotoResult.hidden = processing;
    }

    function hideAiPhotoPanel() {
      aiJobId += 1; // invalida cualquier proceso en curso
      aiRawSource = null;
      aiResultDataUrl = '';
      resetAiAdjustControls();
      if (aiPhotoPanel) aiPhotoPanel.hidden = true;
    }

    async function startAiPhotoProcessing(source) {
      if (!source) return;
      aiRawSource = source;
      aiResultDataUrl = '';
      const jobId = ++aiJobId;

      showAiPanelState('processing');
      if (aiPhotoProgressText) aiPhotoProgressText.textContent = 'Preparando el motor de inteligencia artificial en tu navegador';
      if (aiPhotoPanel && typeof aiPhotoPanel.scrollIntoView === 'function') {
        aiPhotoPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      if (typeof AIPhoto === 'undefined' || typeof AIPhoto.processImage !== 'function') {
        if (aiPhotoPanel) aiPhotoPanel.hidden = true;
        showToast('❌ El motor de fotos con IA no está disponible (no se cargó js/ai-photo.js)', 'error');
        return;
      }

      try {
        const result = await AIPhoto.processImage(source, {
          onProgress: (text) => {
            if (jobId === aiJobId && aiPhotoProgressText) aiPhotoProgressText.textContent = text;
          }
        });
        if (jobId !== aiJobId) return; // cancelado o reemplazado por otra captura

        aiResultDataUrl = result.dataUrl;
        resetAiAdjustControls(); // los deslizadores arrancan en 0 para cada foto
        if (aiPhotoPreview) {
          aiPhotoPreview.src = result.dataUrl;
          aiPhotoPreview.alt = 'Producto recortado sin fondo';
        }
        if (aiPhotoEngineBadge) {
          aiPhotoEngineBadge.textContent = result.engine === 'ia'
            ? `✂️ Recortado con IA${result.enhanced ? ' · 🎨 Color realzado' : ''}`
            : '✂️ Recorte básico (IA sin conexión)';
        }
        if (aiPhotoSizeBadge) {
          aiPhotoSizeBadge.textContent = `${Math.round(result.bytes / 1024)} KB`;
          aiPhotoSizeBadge.title = `${result.bytes} bytes`;
        }
        if (aiPhotoDimsBadge) aiPhotoDimsBadge.textContent = `${result.width} x ${result.height} px`;
        if (aiPhotoHint) {
          const maxBytes = (typeof AIPhoto !== 'undefined' && AIPhoto.DEFAULT_MAX_BYTES) || 260 * 1024;
          const maxKb = Math.round(maxBytes / 1024);
          aiPhotoHint.textContent = result.bytes <= maxBytes
            ? `Lienzo 600 x 600 px con fondo transparente, color realzado y peso liviano (< ${maxKb} KB)`
            : `⚠️ La imagen pesa más de ${maxKb} KB; se conservó el menor tamaño posible`;
        }
        showAiPanelState('result');

        if (result.engine === 'ia') {
          showToast('✂️ Fondo eliminado con IA, color realzado estilo iPhone y foto 600 x 600 px', 'success');
        } else {
          showToast('⚠️ La IA no estuvo disponible: se aplicó recorte básico de respaldo');
        }
        const maxBytes = (typeof AIPhoto !== 'undefined' && AIPhoto.DEFAULT_MAX_BYTES) || 260 * 1024;
        if (result.bytes > maxBytes) {
          showToast(`⚠️ La foto pesa ${Math.round(result.bytes / 1024)} KB (objetivo: menos de ${Math.round(maxBytes / 1024)} KB)`, 'error');
        }
      } catch (err) {
        if (jobId !== aiJobId) return;
        console.error('Error al procesar la foto con IA:', err);
        if (aiPhotoPanel) aiPhotoPanel.hidden = true;
        showToast(`❌ No se pudo procesar la foto: ${err && err.message ? err.message : err}`, 'error');
      }
    }

    // ==========================================================================
    // RETOQUE MANUAL RÁPIDO (BRILLO / VIVACIDAD / CONTRASTE) EN EL PREVIEW
    // Los deslizadores son deltas sobre la foto ya realzada automáticamente:
    // la vista previa se aplica en vivo con CSS filter y el retoque se hornea
    // en canvas (600 x 600) al pulsar "Usar esta imagen".
    // ==========================================================================
    function getAiAdjustments() {
      return {
        brightness: (aiAdjBrightness && parseFloat(aiAdjBrightness.value)) || 0,
        saturation: (aiAdjSaturation && parseFloat(aiAdjSaturation.value)) || 0,
        contrast: (aiAdjContrast && parseFloat(aiAdjContrast.value)) || 0
      };
    }

    function aiAdjustmentsAreNeutral(adj) {
      return !adj.brightness && !adj.saturation && !adj.contrast;
    }

    function aiAdjustmentsToFilter(adj) {
      const parts = [];
      if (adj.brightness) parts.push(`brightness(${(1 + adj.brightness / 100).toFixed(3)})`);
      if (adj.saturation) parts.push(`saturate(${(1 + adj.saturation / 100).toFixed(3)})`);
      if (adj.contrast) parts.push(`contrast(${(1 + adj.contrast / 100).toFixed(3)})`);
      return parts.join(' ');
    }

    function formatAdjustLabel(value) {
      return `${value > 0 ? '+' : ''}${value}%`;
    }

    function updateAiAdjustPreview() {
      const adj = getAiAdjustments();
      if (aiPhotoPreview) aiPhotoPreview.style.filter = aiAdjustmentsToFilter(adj);
      if (aiAdjBrightnessVal) aiAdjBrightnessVal.textContent = formatAdjustLabel(adj.brightness);
      if (aiAdjSaturationVal) aiAdjSaturationVal.textContent = formatAdjustLabel(adj.saturation);
      if (aiAdjContrastVal) aiAdjContrastVal.textContent = formatAdjustLabel(adj.contrast);
    }

    function resetAiAdjustControls() {
      if (aiAdjBrightness) aiAdjBrightness.value = '0';
      if (aiAdjSaturation) aiAdjSaturation.value = '0';
      if (aiAdjContrast) aiAdjContrast.value = '0';
      if (aiPhotoPreview) aiPhotoPreview.style.filter = '';
      if (aiAdjBrightnessVal) aiAdjBrightnessVal.textContent = '0%';
      if (aiAdjSaturationVal) aiAdjSaturationVal.textContent = '0%';
      if (aiAdjContrastVal) aiAdjContrastVal.textContent = '0%';
    }

    function loadImageFromDataUrl(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la foto procesada'));
        img.src = src;
      });
    }

    // Hornea el retoque manual en el lienzo final (conserva 600 x 600 px y
    // transparencia). Si el navegador no soporta ctx.filter, se usa la foto base.
    async function bakeAiAdjustments(baseDataUrl, adj) {
      if (!baseDataUrl || aiAdjustmentsAreNeutral(adj)) return baseDataUrl;

      let img;
      try {
        img = await loadImageFromDataUrl(baseDataUrl);
      } catch (err) {
        console.warn('No se pudo aplicar el retoque manual, se usa la foto base:', err);
        return baseDataUrl;
      }

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.filter === 'undefined') return baseDataUrl;

      ctx.filter = aiAdjustmentsToFilter(adj);
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';

      try {
        const webp = canvas.toDataURL('image/webp', 0.92);
        return webp.indexOf('data:image/webp') === 0 ? webp : canvas.toDataURL('image/png');
      } catch (err) {
        console.warn('No se pudo exportar el retoque, se usa la foto base:', err);
        return baseDataUrl;
      }
    }

    function useAiPhotoResult() {
      if (!aiResultDataUrl) return;
      const adj = getAiAdjustments();
      const commit = (finalDataUrl) => {
        if (prodImageInput) {
          prodImageInput.value = finalDataUrl;
          prodImageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (imagePreview) {
          imagePreview.style.background = 'repeating-conic-gradient(#E5E7EB 0% 25%, #FFFFFF 0% 50%) 50% / 12px 12px';
          imagePreview.style.filter = '';
        }
        if (imagePreviewName) {
          imagePreviewName.textContent = aiAdjustmentsAreNeutral(adj)
            ? 'Foto con IA (fondo transparente)'
            : 'Foto con IA (fondo transparente + retoque manual)';
        }
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
        hideAiPhotoPanel();
        showToast('✅ Imagen 600 x 600 px con fondo transparente asignada al campo del producto', 'success');
      };

      // Si hay retoque manual, se hornea antes de asignar; si no, va directo
      Promise.resolve(bakeAiAdjustments(aiResultDataUrl, adj)).then(commit);
    }

    if (takeProductPhotoBtn) takeProductPhotoBtn.addEventListener('click', openProductCamera);
    if (closeProductCameraBtn) closeProductCameraBtn.addEventListener('click', stopProductCamera);
    if (capturePhotoBtn) capturePhotoBtn.addEventListener('click', captureProductPhoto);

    if (productPhotoCaptureInput) {
      productPhotoCaptureInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        productPhotoCaptureInput.value = '';
        startAiPhotoProcessing(file);
      });
    }

    if (useAiPhotoBtn) useAiPhotoBtn.addEventListener('click', useAiPhotoResult);

    // Deslizadores de retoque: vista previa en vivo al moverlos
    [aiAdjBrightness, aiAdjSaturation, aiAdjContrast].forEach(input => {
      if (input) input.addEventListener('input', updateAiAdjustPreview);
    });
    if (retryAiPhotoBtn) {
      retryAiPhotoBtn.addEventListener('click', () => {
        if (aiRawSource) startAiPhotoProcessing(aiRawSource);
      });
    }
    if (discardAiPhotoBtn) {
      discardAiPhotoBtn.addEventListener('click', () => {
        hideAiPhotoPanel();
        showToast('🗑️ Foto descartada');
      });
    }
    if (cancelAiPhotoBtn) {
      cancelAiPhotoBtn.addEventListener('click', () => {
        hideAiPhotoPanel();
        showToast('✖️ Proceso de recorte cancelado');
      });
    }
    window.addEventListener('pagehide', stopProductCamera);

    // --- MANEJO DE TASAS DE CAMBIO DIARIAS Y SINCRONIZACIÓN API ---
    const inputAdminRateBs = document.getElementById('inputAdminRateBs');
    const inputAdminRateCop = document.getElementById('inputAdminRateCop');
    const btnSaveAdminRates = document.getElementById('btnSaveAdminRates');
    const btnSyncRatesApi = document.getElementById('btnSyncRatesApi');
    const adminRatesLastSyncText = document.getElementById('adminRatesLastSyncText');

    function syncAdminRatesUI() {
      if (inputAdminRateBs && CURRENCY_RATES.BS) {
        inputAdminRateBs.value = CURRENCY_RATES.BS.toFixed(2);
      }
      if (inputAdminRateCop && CURRENCY_RATES.COP) {
        inputAdminRateCop.value = Math.round(CURRENCY_RATES.COP);
      }
      const lastSync = localStorage.getItem('alcosto_rates_last_sync');
      if (adminRatesLastSyncText) {
        adminRatesLastSyncText.textContent = `Tasa actual: 1$ = ${CURRENCY_RATES.BS.toFixed(2)} Bs | ${Math.round(CURRENCY_RATES.COP).toLocaleString('es-CO')} COP ${lastSync ? '• Sincronizado: ' + lastSync : ''}`;
      }
    }

    syncAdminRatesUI();

    // El módulo de tasa de cambio ahora vive SOLO en la pestaña "Configuración".
    // Al abrirla refrescamos el panel por si la tasa cambió desde otra vista o
    // desde la sincronización automática diaria.
    document.querySelectorAll('[data-tab="tab-settings"]').forEach(settingsTabBtn => {
      settingsTabBtn.addEventListener('click', () => {
        syncAdminRatesUI();
      });
    });

    if (btnSaveAdminRates) {
      btnSaveAdminRates.addEventListener('click', () => {
        const bs = parseFloat(inputAdminRateBs.value);
        const cop = parseFloat(inputAdminRateCop.value);
        if (isNaN(bs) || bs <= 0 || isNaN(cop) || cop <= 0) {
          showToast('⚠️ Ingresa valores válidos para las tasas', 'error');
          return;
        }
        updateCurrencyRates(bs, cop, true);
        syncAdminRatesUI();
        renderOrdersCards();
        renderProductsTable();
        updateOrdersStats();
        showToast(`✅ Tasas guardadas: ${bs.toFixed(2)} Bs y ${cop.toLocaleString()} COP`, 'success');
      });
    }

    if (btnSyncRatesApi) {
      btnSyncRatesApi.addEventListener('click', async () => {
        const origText = btnSyncRatesApi.innerHTML;
        btnSyncRatesApi.disabled = true;
        btnSyncRatesApi.innerHTML = '<span>⏳</span> Consultando API...';
        try {
          const res = await syncDailyExchangeRates(true);
          if (res && res.success) {
            syncAdminRatesUI();
            renderOrdersCards();
            renderProductsTable();
            updateOrdersStats();
            showToast(`🚀 Tasas sincronizadas: 1$ = ${CURRENCY_RATES.BS.toFixed(2)} Bs | ${CURRENCY_RATES.COP.toLocaleString()} COP`, 'success');
          } else {
            showToast((res && res.message) || 'Error consultando API de tasas', 'error');
          }
        } catch (e) {
          showToast('Error de conexión con la API de tasas', 'error');
        } finally {
          btnSyncRatesApi.disabled = false;
          btnSyncRatesApi.innerHTML = origText;
        }
      });
    }

    window.addEventListener('alcosto:rates-updated', () => {
      syncAdminRatesUI();
      renderOrdersCards();
      renderProductsTable();
      updateOrdersStats();
    });
  }

  // Toast
  function showToast(message, type = 'normal') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Inicializar id autogenerado
  if (prodIdInput && !prodIdInput.value) {
    prodIdInput.value = 'prod-' + Date.now().toString().slice(-4);
  }

  init();
});
