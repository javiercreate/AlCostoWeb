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
  const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
  const simulateDemoOrderBtn = document.getElementById('simulateDemoOrderBtn');
  const orderDetailModal = document.getElementById('orderDetailModal');
  const closeOrderDetailModalBtn = document.getElementById('closeOrderDetailModalBtn');
  const orderDetailModalBody = document.getElementById('orderDetailModalBody');

  // Catálogo
  const productsTableBody = document.getElementById('productsTableBody');
  const tableSearchInput = document.getElementById('tableSearchInput');
  const tableCategoryFilter = document.getElementById('tableCategoryFilter');
  const productForm = document.getElementById('productForm');
  const formTitle = document.getElementById('formTitle');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const publishToSupabaseBtn = document.getElementById('publishToSupabaseBtn');
  const exportBackupJsonBtn = document.getElementById('exportBackupJsonBtn');

  // Formulario Producto
  const prodIdInput = document.getElementById('prodId');
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

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================
  function init() {
    setupTabSwitching();
    initSupabaseConfig();
    loadCatalogProducts();
    loadOrders();
    setupEventListeners();
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
  async function loadOrders() {
    // 1. Intentar cargar desde Supabase si está configurado
    const supabaseOrders = await SupabaseService.fetchOrdersFromSupabase();
    if (supabaseOrders && supabaseOrders.length > 0) {
      orders = supabaseOrders;
    } else {
      // 2. Cargar desde LocalStorage
      try {
        const savedOrders = localStorage.getItem('alcosto_orders');
        if (savedOrders) {
          orders = JSON.parse(savedOrders);
        } else {
          // Si no hay pedidos, creamos uno de muestra para que el dueño vea cómo luce
          orders = [createSampleOrder()];
          localStorage.setItem('alcosto_orders', JSON.stringify(orders));
        }
      } catch (e) {
        console.error('Error cargando pedidos:', e);
        orders = [];
      }
    }

    updateOrdersStats();
    renderOrdersCards();
  }

  function createSampleOrder() {
    return {
      id: 'AC-' + Math.floor(1000 + Math.random() * 9000),
      customerName: 'María Rodríguez',
      customerPhone: '+34 611 22 33 44',
      deliveryAddress: 'Calle Mayor 14, 3º B (C.P. 28013)',
      deliverySlot: 'Hoy en 30-45 min',
      instructions: 'Llamar al telefonillo 3B',
      paymentMethod: 'Efectivo contra entrega',
      items: [
        {
          product: { id: 'ch-01', name: 'Jamón Cocido Superior Rebanado', price: 3.80, unit: 'Bandeja 300g' },
          quantity: 2
        },
        {
          product: { id: 'lac-01', name: 'Queso Blanco Llanero / Costeño', price: 4.50, unit: 'Bloque 500g' },
          quantity: 1
        },
        {
          product: { id: 'viv-02', name: 'Harina de Maíz Blanco Precocida', price: 1.35, unit: 'Paquete 1 kg' },
          quantity: 4
        }
      ],
      subtotal: 17.50,
      discount: 0,
      deliveryFee: 0,
      tip: 1.75,
      total: 19.25,
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
      if (o.status !== 'cancelado') totalSales += (o.total || 0);
    });

    if (statNewOrdersCount) statNewOrdersCount.textContent = newCount;
    if (statPreparingCount) statPreparingCount.textContent = prepCount;
    if (statShippingCount) statShippingCount.textContent = shipCount;
    if (statTotalSalesAmount) statTotalSalesAmount.textContent = `$${totalSales.toFixed(2)}`;
    if (countAllOrders) countAllOrders.textContent = orders.length;

    if (tabNewOrdersBadge) {
      tabNewOrdersBadge.textContent = `${newCount} nuevos`;
      tabNewOrdersBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
    }
  }

  function renderOrdersCards() {
    if (!ordersCardsContainer) return;

    const filtered = orders.filter(order => {
      if (currentOrderFilter === 'all') return true;
      return order.status === currentOrderFilter;
    });

    if (filtered.length === 0) {
      ordersCardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: white; border-radius: 16px; border: 1px dashed var(--color-border);">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">📭</div>
          <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 4px;">No hay pedidos en este estado</h3>
          <p style="color: #666; font-size: 0.85rem;">Los nuevos pedidos que los clientes hagan en la tienda aparecerán aquí al instante.</p>
        </div>
      `;
      return;
    }

    ordersCardsContainer.innerHTML = filtered.map(order => {
      const dateFormatted = new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
      const waMsg = encodeURIComponent(`Hola ${order.customerName}, te escribimos de Al Costo sobre tu pedido #${order.id}. ¿Cómo estás?`);
      const waCustomerUrl = `https://wa.me/${cleanPhone}?text=${waMsg}`;

      let statusBadgeHtml = '';
      if (order.status === 'nuevo') statusBadgeHtml = '<span class="status-badge nuevo">🟡 Nuevo</span>';
      else if (order.status === 'preparacion') statusBadgeHtml = '<span class="status-badge preparacion">👨‍🌾 En Preparación</span>';
      else if (order.status === 'camino') statusBadgeHtml = '<span class="status-badge camino">🛵 En Camino</span>';
      else if (order.status === 'entregado') statusBadgeHtml = '<span class="status-badge entregado">✅ Entregado</span>';
      else statusBadgeHtml = `<span class="status-badge">${order.status}</span>`;

      return `
        <div class="order-card status-${order.status || 'nuevo'}">
          
          <div class="order-card-header">
            <div>
              <div class="order-code">Pedido #${order.id}</div>
              <div class="order-time">Hora: ${dateFormatted} • ${order.deliverySlot || 'Entrega estándar'}</div>
            </div>
            ${statusBadgeHtml}
          </div>

          <div class="order-customer-info">
            <div class="order-customer-name">👤 ${order.customerName}</div>
            <div class="order-customer-details">📍 ${order.deliveryAddress}</div>
            <div class="order-customer-details">💳 Pago: <strong>${order.paymentMethod || 'Efectivo'}</strong></div>
            ${order.instructions ? `<div class="order-customer-details" style="color: #B45309;">📝 Nota: "${order.instructions}"</div>` : ''}
          </div>

          <div class="order-items-preview">
            <div style="font-weight: 700; margin-bottom: 6px; color: #333;">Artículos del Pedido (${order.items ? order.items.length : 0}):</div>
            ${(order.items || []).map(i => `
              <div class="order-item-line">
                <span><strong>${i.quantity}x</strong> ${i.product ? i.product.name : 'Producto'}</span>
                <span>$${((i.product ? i.product.price : 0) * i.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>

          <!-- Selector de Estado de la Orden -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <label style="font-size: 0.8rem; font-weight: 700; color: #555;">Estado:</label>
            <select class="form-select order-status-select" data-order-id="${order.id}" style="height: 36px; padding: 4px 8px; font-size: 0.82rem; font-weight: 700;">
              <option value="nuevo" ${order.status === 'nuevo' ? 'selected' : ''}>🟡 Nuevo</option>
              <option value="preparacion" ${order.status === 'preparacion' ? 'selected' : ''}>👨‍🌾 En Preparación</option>
              <option value="camino" ${order.status === 'camino' ? 'selected' : ''}>🛵 En Camino</option>
              <option value="entregado" ${order.status === 'entregado' ? 'selected' : ''}>✅ Entregado</option>
              <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
            </select>
          </div>

          <!-- Botones de Acción Rápida -->
          <div class="order-actions-row">
            <a href="${waCustomerUrl}" target="_blank" class="btn-order-action btn-wa-action" title="Chatear por WhatsApp">
              <span>💬 WhatsApp</span>
            </a>

            <button class="btn-order-action view-order-modal-btn" data-order-id="${order.id}" style="background: #F8F9FA;">
              🔍 Ver Detalle
            </button>
          </div>

          <div class="order-card-footer">
            <div>
              <span style="font-size: 0.78rem; color: #666; font-weight: 600;">Total a Cobrar:</span>
              <div class="order-total-amount">$${parseFloat(order.total || 0).toFixed(2)}</div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; gap: 2px;">
              <span class="badge-currency-bs" style="font-size: 0.75rem;">🇻🇪 ${(parseFloat(order.total || 0) * CURRENCY_RATES.BS).toFixed(2)} Bs</span>
              <span class="badge-currency-cop" style="font-size: 0.75rem;">🇨🇴 ${(Math.round(parseFloat(order.total || 0) * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
            </div>
          </div>

        </div>
      `;
    }).join('');

    // Eventos de cambio de estado
    ordersCardsContainer.querySelectorAll('.order-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = select.getAttribute('data-order-id');
        const newStatus = select.value;
        await changeOrderStatus(id, newStatus);
      });
    });

    // Eventos de modal detalle
    ordersCardsContainer.querySelectorAll('.view-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-order-id');
        openOrderDetail(id);
      });
    });
  }

  async function changeOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;
    localStorage.setItem('alcosto_orders', JSON.stringify(orders));

    // Si Supabase está configurado, actualizar en la nube
    await SupabaseService.updateOrderStatus(orderId, newStatus);

    updateOrdersStats();
    renderOrdersCards();
    showToast(`🔄 Pedido #${orderId} actualizado a "${newStatus}"`, 'success');
  }

  function openOrderDetail(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !orderDetailModal || !orderDetailModalBody) return;

    const itemsHtml = (order.items || []).map(i => `
      <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
        <span><strong>${i.quantity}x</strong> ${i.product ? i.product.name : 'Artículo'} (${i.product ? i.product.unit : ''})</span>
        <strong>$${((i.product ? i.product.price : 0) * i.quantity).toFixed(2)}</strong>
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
        <div><strong>Teléfono:</strong> ${order.customerPhone}</div>
        <div><strong>Dirección:</strong> ${order.deliveryAddress}</div>
        <div><strong>Horario:</strong> ${order.deliverySlot}</div>
        <div><strong>Método de Pago:</strong> ${order.paymentMethod}</div>
        ${order.instructions ? `<div style="color: #b45309; margin-top: 4px;"><strong>Instrucciones:</strong> ${order.instructions}</div>` : ''}
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 0.95rem; font-weight: 800; margin-bottom: 8px;">Artículos Solicitados:</h4>
        ${itemsHtml}
      </div>

      <div style="border-top: 2px solid var(--color-border); padding-top: 10px; font-size: 0.9rem;">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>$${parseFloat(order.subtotal || 0).toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Envío:</span> <span>${order.deliveryFee === 0 ? 'GRATIS' : '$' + parseFloat(order.deliveryFee).toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Propina:</span> <span>$${parseFloat(order.tip || 0).toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 900; color: #108910; margin-top: 6px;">
          <span>Total:</span>
          <span>$${parseFloat(order.total || 0).toFixed(2)}</span>
        </div>
      </div>
    `;

    orderDetailModal.classList.add('active');
  }

  // ==========================================================================
  // GESTIÓN DEL CATÁLOGO DE PRODUCTOS
  // ==========================================================================
  function loadCatalogProducts() {
    try {
      const saved = localStorage.getItem('alcosto_custom_products');
      if (saved) {
        products = JSON.parse(saved);
      } else {
        products = [...DEFAULT_PRODUCTS];
      }
    } catch (e) {
      console.error('Error cargando catálogo:', e);
      products = [...DEFAULT_PRODUCTS];
    }
    renderProductsTable();
  }

  function renderProductsTable() {
    if (!productsTableBody) return;

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

    productsTableBody.innerHTML = filtered.map(p => {
      const catObj = CATEGORIES.find(c => c.id === p.category);
      const catLabel = catObj ? `${catObj.icon} ${catObj.name}` : p.category;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${p.image}" class="admin-thumb" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80'">
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
    }).join('');

    productsTableBody.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => startEditProduct(btn.getAttribute('data-id')));
    });

    productsTableBody.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(btn.getAttribute('data-id')));
    });
  }

  function startEditProduct(id) {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    editingProductId = id;
    if (formTitle) formTitle.textContent = `✏️ Editando: ${prod.name}`;
    if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';

    prodIdInput.value = prod.id;
    prodIdInput.disabled = true;
    prodNameInput.value = prod.name;
    prodCategoryInput.value = prod.category;
    prodPriceInput.value = prod.price;
    prodOriginalPriceInput.value = prod.originalPrice || '';
    prodWholesalePriceInput.value = prod.wholesalePrice || '';
    prodWholesaleMinInput.value = prod.wholesaleMin || '';
    prodUnitInput.value = prod.unit;
    prodImageInput.value = prod.image;
    prodBadgeInput.value = prod.badge || '';
    prodDescriptionInput.value = prod.description || '';

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
    productForm.reset();
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const prodImageUpload = document.getElementById('prodImageUpload');
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    if (prodImageUpload) prodImageUpload.value = '';
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
    }
  }

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = (prodIdInput && prodIdInput.value.trim()) || 'prod-' + Date.now().toString().slice(-4);
      const name = prodNameInput.value.trim();
      const category = prodCategoryInput.value;
      const price = parseFloat(prodPriceInput.value);
      const originalPrice = prodOriginalPriceInput.value ? parseFloat(prodOriginalPriceInput.value) : null;
      const wholesalePrice = prodWholesalePriceInput.value ? parseFloat(prodWholesalePriceInput.value) : null;
      const wholesaleMin = prodWholesaleMinInput.value ? parseInt(prodWholesaleMinInput.value, 10) : 1;
      const unit = prodUnitInput.value.trim();
      const image = prodImageInput.value.trim() || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80';
      const badge = prodBadgeInput.value.trim();
      const description = prodDescriptionInput.value.trim();

      const payload = {
        id,
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
            await SupabaseService.syncProductsToSupabase(products);
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
      await SupabaseService.syncProductsToSupabase(products);
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

  // ==========================================================================
  // EVENT LISTENERS ADICIONALES
  // ==========================================================================
  function setupEventListeners() {
    // Filtros de Pedidos
    orderFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        orderFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentOrderFilter = btn.getAttribute('data-order-filter');
        renderOrdersCards();
      });
    });

    if (refreshOrdersBtn) {
      refreshOrdersBtn.addEventListener('click', () => {
        loadOrders();
        showToast('🔄 Lista de compras actualizada');
      });
    }

    if (simulateDemoOrderBtn) {
      simulateDemoOrderBtn.addEventListener('click', () => {
        const demo = createSampleOrder();
        demo.customerName = ['Carlos Ruiz', 'Sofía Márquez', 'Alejandro Morales', 'Lucía Fernández'][Math.floor(Math.random() * 4)];
        orders.unshift(demo);
        localStorage.setItem('alcosto_orders', JSON.stringify(orders));
        updateOrdersStats();
        renderOrdersCards();
        showToast(`🔔 ¡Nuevo pedido #${demo.id} recibido!`, 'success');
      });
    }

    // Modal detalle pedido
    if (closeOrderDetailModalBtn && orderDetailModal) {
      closeOrderDetailModalBtn.addEventListener('click', () => {
        orderDetailModal.classList.remove('active');
      });
    }

    // Búsqueda en tabla
    if (tableSearchInput) tableSearchInput.addEventListener('input', renderProductsTable);
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
            const maxDim = 500;
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

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
            prodImageInput.value = compressedDataUrl;
            if (imagePreview) imagePreview.src = compressedDataUrl;
            if (imagePreviewName) imagePreviewName.textContent = file.name;
            if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
            showToast('📸 Foto del producto cargada con éxito', 'success');
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
