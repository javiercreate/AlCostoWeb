// ==========================================================================
// AL COSTO SUPERMERCADO - APLICACIÓN JS PRINCIPAL (ESTILO INSTACART)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // --- ESTADO DE LA APLICACIÓN ---
  const state = {
    cart: JSON.parse(localStorage.getItem('alcosto_cart')) || {},
    wishlist: JSON.parse(localStorage.getItem('alcosto_wishlist')) || [],
    activeCategory: 'todos',
    activeFilterTag: 'all',
    searchQuery: '',
    sortBy: 'relevance',
    appliedCoupon: null,
    shopperTipPercent: 10,
    deliveryType: localStorage.getItem('alcosto_delivery_type') || 'delivery', // 'delivery' | 'pickup'
    realGpsLocation: (function() {
      try { return JSON.parse(localStorage.getItem('alcosto_user_gps')); } catch(e) { return null; }
    })(),
    customerProfile: JSON.parse(localStorage.getItem('alcosto_customer_profile')) || {
      name: '',
      phone: '',
      address: '',
      reference: ''
    },
    authUser: (function() {
      try { return JSON.parse(localStorage.getItem('alcosto_auth_user')); } catch(e) { return null; }
    })(),
    selectedProductForModal: null,
    orderTrackerInterval: null,
    chatMessages: [],
    chatReplyIndex: 0,
    paymentProof: null // Captura de pantalla (comprobante) del pago online subida por el cliente
  };

  // --- ELEMENTOS DEL DOM ---
  const productsGridEl = document.getElementById('productsGrid');
  const sectionTitleEl = document.getElementById('catalogSectionTitle');
  const sectionCountEl = document.getElementById('catalogSectionCount');
  const searchInputEl = document.getElementById('searchInput');
  const searchClearBtnEl = document.getElementById('searchClearBtn');
  const searchDropdownEl = document.getElementById('searchDropdown');
  const sortSelectEl = document.getElementById('sortSelect');
  const filterTagChips = document.querySelectorAll('.filter-tag-chip');

  // Header & Profile & Auth Elements
  const userAccountDropdownWrapper = document.getElementById('userAccountDropdownWrapper');
  const userAccountBtn = document.getElementById('userAccountBtn');
  const userAccountBtnLabel = document.getElementById('userAccountBtnLabel');
  const userAccountMenu = document.getElementById('userAccountMenu');
  const userMenuName = document.getElementById('userMenuName');
  const userMenuEmail = document.getElementById('userMenuEmail');
  const userMenuGuestActions = document.getElementById('userMenuGuestActions');
  const userMenuLoggedActions = document.getElementById('userMenuLoggedActions');
  const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
  const btnOpenRegisterModal = document.getElementById('btnOpenRegisterModal');
  const btnOpenProfileFromMenu = document.getElementById('btnOpenProfileFromMenu');
  const btnLogoutUser = document.getElementById('btnLogoutUser');

  // Modal Auth
  const authModalEl = document.getElementById('authModal');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const tabAuthLogin = document.getElementById('tabAuthLogin');
  const tabAuthRegister = document.getElementById('tabAuthRegister');
  const formAuthLogin = document.getElementById('formAuthLogin');
  const formAuthRegister = document.getElementById('formAuthRegister');

  const customerProfileModal = document.getElementById('customerProfileModal');
  const closeCustomerProfileModalBtn = document.getElementById('closeCustomerProfileModalBtn');
  const customerProfileForm = document.getElementById('customerProfileForm');
  const profNameInput = document.getElementById('profName');
  const profPhoneInput = document.getElementById('profPhone');
  const profAddressInput = document.getElementById('profAddress');
  const profReferenceInput = document.getElementById('profReference');
  const cartHeaderBtn = document.getElementById('cartHeaderBtn');
  const cartBadgeCountEl = document.getElementById('cartBadgeCount');
  const cartTotalPreviewEl = document.getElementById('cartTotalPreview');
  const wishlistHeaderBtn = document.getElementById('wishlistHeaderBtn');
  const wishlistBadgeCountEl = document.getElementById('wishlistBadgeCount');

  // Drawer Carrito
  const cartDrawerEl = document.getElementById('cartDrawer');
  const drawerBackdropEl = document.getElementById('drawerBackdrop');
  const closeCartDrawerBtn = document.getElementById('closeCartDrawerBtn');
  const cartDrawerItemsListEl = document.getElementById('cartDrawerItemsList');
  const cartDrawerCountBadgeEl = document.getElementById('cartDrawerCountBadge');
  const freeShippingFillEl = document.getElementById('freeShippingFill');
  const freeShippingLabelEl = document.getElementById('freeShippingLabel');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartDiscountEl = document.getElementById('cartDiscount');
  const cartDiscountRowEl = document.getElementById('cartDiscountRow');
  const cartDeliveryFeeEl = document.getElementById('cartDeliveryFee');
  const cartTipEl = document.getElementById('cartTip');
  const cartTotalEl = document.getElementById('cartTotal');
  const couponInputEl = document.getElementById('couponInput');
  const applyCouponBtn = document.getElementById('applyCouponBtn');
  const tipButtons = document.querySelectorAll('.tip-pill-btn');
  const checkoutProceedBtn = document.getElementById('checkoutProceedBtn');

  // Modales
  const productModalEl = document.getElementById('productDetailModal');
  const closeProductModalBtn = document.getElementById('closeProductModalBtn');
  const checkoutModalEl = document.getElementById('checkoutModal');
  const closeCheckoutModalBtn = document.getElementById('closeCheckoutModalBtn');
  const checkoutFormEl = document.getElementById('checkoutForm');
  const orderTrackerModalEl = document.getElementById('orderTrackerModal');
  const closeOrderTrackerBtn = document.getElementById('closeOrderTrackerBtn');
  const chatWithShopperBtn = document.getElementById('chatWithShopperBtn');
  const chatModalEl = document.getElementById('chatModal');
  const chatMessagesEl = document.getElementById('chatMessages');
  let chatTypingEl = document.getElementById('chatTyping'); // `let`: se vuelve a buscar tras repintar
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const toastContainerEl = document.getElementById('toastContainer');
  let catalogLoadState = 'loading';
  let catalogLoadRequest = 0;
  // Caché local del último catálogo conocido: pinta la tienda al instante en cargas
  // siguientes mientras Supabase responde (evita la pantalla "Cargando catálogo...")
  const CATALOG_CACHE_KEY = 'alcosto_catalog_cache';

  // ==========================================================================
  // ESTADO Y UI DE AUTENTICACIÓN (LOGIN / REGISTRO / PERFIL)
  // ==========================================================================
  function updateAuthUI() {
    if (state.authUser && state.authUser.name) {
      if (userAccountBtnLabel) userAccountBtnLabel.textContent = state.authUser.name.split(' ')[0];
      if (userMenuName) userMenuName.textContent = state.authUser.name;
      if (userMenuEmail) userMenuEmail.textContent = state.authUser.email || state.authUser.phone || 'Usuario Registrado';
      if (userMenuGuestActions) userMenuGuestActions.style.display = 'none';
      if (userMenuLoggedActions) userMenuLoggedActions.style.display = 'block';
    } else {
      if (userAccountBtnLabel) userAccountBtnLabel.textContent = 'Mi Cuenta';
      if (userMenuName) userMenuName.textContent = 'Invitado';
      if (userMenuEmail) userMenuEmail.textContent = 'Inicia sesión para gestionar pedidos';
      if (userMenuGuestActions) userMenuGuestActions.style.display = 'block';
      if (userMenuLoggedActions) userMenuLoggedActions.style.display = 'none';
    }
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================
  async function init() {
    updateAuthUI();
    PRODUCTS_DATA = [];
    await loadCatalogProductsFromDatabase();
    updateCartUI();
    updateWishlistBadge();
    setupEventListeners();

    // Reabrir el seguimiento del pedido activo (si el cliente recargó la página)
    restoreActiveOrderTracker();

    // Mostrar el botón flotante de "Mi pedido en curso" mientras exista uno activo
    refreshActiveOrderFab();

  }

  // Lee el último catálogo guardado en este navegador (pintado instantáneo)
  function loadCatalogCacheSnapshot() {
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || 'null');
      if (Array.isArray(cached) && cached.length > 0) {
        return (typeof stripLegacyDefaultProducts === 'function')
          ? stripLegacyDefaultProducts(cached)
          : cached;
      }
    } catch (e) {
      // Caché corrupta: se ignora y se consulta la nube
    }
    return null;
  }

  async function loadCatalogProductsFromDatabase() {
    const requestId = ++catalogLoadRequest;

    // Pintado instantáneo desde la caché local (si la hay) mientras la nube responde
    if (PRODUCTS_DATA.length === 0) {
      const snapshot = loadCatalogCacheSnapshot();
      if (snapshot) {
        PRODUCTS_DATA = snapshot;
        catalogLoadState = 'ready';
        renderProducts();
      }
    }

    const config = typeof SupabaseService !== 'undefined' ? SupabaseService.getConfig() : null;
    if (!config || !config.connected || !config.url || !config.anonKey) {
      if (PRODUCTS_DATA.length === 0) {
        PRODUCTS_DATA = [];
        catalogLoadState = 'missing-config';
        renderProducts();
      }
      return;
    }

    // Solo muestra el estado "Cargando" si no hay nada pintado aún (sin caché)
    if (PRODUCTS_DATA.length === 0) {
      catalogLoadState = 'loading';
      renderProducts();
    }
    try {
      const databaseProducts = await SupabaseService.fetchProductsFromSupabase();
      if (requestId !== catalogLoadRequest) return;
      if (!Array.isArray(databaseProducts)) {
        throw new Error('Supabase no devolvió una lista válida de productos.');
      }
      // BLOQUEO: excluir productos demo predeterminados aunque existan en la base de datos
      PRODUCTS_DATA = (typeof stripLegacyDefaultProducts === 'function')
        ? stripLegacyDefaultProducts(databaseProducts)
        : databaseProducts;
      catalogLoadState = 'ready';
      try {
        localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(PRODUCTS_DATA));
      } catch (e) {
        // Cuota llena: la caché local es solo un acelerador, no esencial
      }
    } catch (error) {
      if (requestId !== catalogLoadRequest) return;
      console.error('No se pudo cargar el catálogo desde Supabase:', error);
      // Si hay caché previa se conserva para que la tienda siga siendo navegable
      if (PRODUCTS_DATA.length === 0) {
        PRODUCTS_DATA = [];
        catalogLoadState = 'error';
      }
    }
    renderProducts();
  }

  // ==========================================================================
  // FILTRADO Y RENDERIZADO DE PRODUCTOS
  // ==========================================================================
  function getFilteredProducts() {
    return PRODUCTS_DATA.filter(prod => {
      // Filtro por categoría
      if (state.activeCategory !== 'todos' && prod.category !== state.activeCategory) {
        return false;
      }

      // Filtro por etiquetas / tags
      if (state.activeFilterTag === 'al-mayor' && !prod.isWholesale && prod.category !== 'al-mayor') {
        return false;
      }
      if (state.activeFilterTag === 'oferta' && !prod.originalPrice) {
        return false;
      }
      if (state.activeFilterTag === 'popular' && prod.tag !== 'popular') {
        return false;
      }
      if (state.activeFilterTag === 'organico' && !prod.isOrganic) {
        return false;
      }
      // Filtro por búsqueda
      if (state.searchQuery.trim() !== '') {
        const query = state.searchQuery.toLowerCase();
        const matchName = (prod.name || '').toLowerCase().includes(query);
        const matchDesc = (prod.description || '').toLowerCase().includes(query);
        const matchCategory = (prod.category || '').toLowerCase().includes(query);
        if (!matchName && !matchDesc && !matchCategory) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (state.sortBy === 'price-low') return a.price - b.price;
      if (state.sortBy === 'price-high') return b.price - a.price;
      if (state.sortBy === 'rating') return b.rating - a.rating;
      return 0; // relevance
    });
  }

  function renderProducts() {
    const filtered = getFilteredProducts();
    
    if (sectionCountEl) {
      sectionCountEl.textContent = `${filtered.length} productos`;
    }

    if (!productsGridEl) return;

    if (filtered.length === 0) {
      const hasNoFilterMatches = PRODUCTS_DATA.length > 0 && catalogLoadState === 'ready';
      const emptyState = hasNoFilterMatches
        ? {
            icon: '🔍',
            heading: 'No encontramos productos que coincidan',
            message: 'Prueba buscando con otros términos o seleccionando otra categoría.',
            retry: false,
            resetFilters: true
          }
        : catalogLoadState === 'loading'
        ? {
            icon: '⏳',
            heading: 'Cargando catálogo',
            message: 'Estamos consultando los productos disponibles en la base de datos.',
            retry: false
          }
        : catalogLoadState === 'missing-config'
          ? {
              icon: '🔌',
              heading: 'Catálogo no disponible',
              message: 'Configura la URL y el token de Supabase para consultar los productos.',
              retry: false
            }
          : catalogLoadState === 'error'
            ? {
                icon: '⚠️',
                heading: 'No se pudo cargar el catálogo',
                message: 'Revisa la conexión y las credenciales de Supabase e inténtalo de nuevo.',
                retry: true
              }
            : {
                icon: '📦',
                heading: 'No hay productos publicados',
                message: 'La base de datos no tiene productos disponibles en este momento.',
                retry: false
              };
      productsGridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed #ccc;">
          <div style="font-size: 3rem; margin-bottom: 12px;">${emptyState.icon}</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 6px;">${emptyState.heading}</h3>
          <p style="color: #666; font-size: 0.9rem; margin-bottom: 16px;">${emptyState.message}</p>
          ${emptyState.retry
            ? '<button class="btn-hero-cta" style="background: var(--color-primary); color: white;" id="retryCatalogLoadBtn">Reintentar</button>'
            : ''}
          ${emptyState.resetFilters
            ? '<button class="btn-hero-cta" style="background: var(--color-primary); color: white;" id="resetFilterBtn">Ver todos los productos</button>'
            : ''}
        </div>
      `;
      if (sectionCountEl) {
        sectionCountEl.textContent = catalogLoadState === 'loading' ? 'Cargando catálogo...' : '0 productos';
      }
      const retryBtn = document.getElementById('retryCatalogLoadBtn');
      if (retryBtn) retryBtn.addEventListener('click', loadCatalogProductsFromDatabase);
      const resetBtn = document.getElementById('resetFilterBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.activeCategory = 'todos';
          state.activeFilterTag = 'all';
          state.searchQuery = '';
          if (searchInputEl) searchInputEl.value = '';
          filterTagChips.forEach(chip => chip.classList.toggle('active', chip.dataset.tag === 'all'));
          renderProducts();
        });
      }
      return;
    }

    productsGridEl.innerHTML = filtered.map(product => {
      const inCartQty = state.cart[product.id] ? state.cart[product.id].quantity : 0;
      const isWishlisted = state.wishlist.includes(product.id);

      // Icono y Categoría con soporte Font Awesome
      const catObj = (typeof CATEGORIES !== 'undefined') ? CATEGORIES.find(c => c.id === product.category) : null;
      let catIconHtml = '🏷️';
      if (catObj && catObj.icon) {
        if (catObj.icon.startsWith('fa-')) {
          catIconHtml = `<i class="${catObj.icon}"></i>`;
        } else {
          catIconHtml = catObj.icon;
        }
      }

      // Badge flotante moderno
      let badgeHtml = '';
      if (product.originalPrice) {
        const discountPct = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
        badgeHtml = `<span class="product-badge-pill badge-offer">🔥 -${discountPct}% OFF</span>`;
      } else if (product.wholesalePrice || product.category === 'al-mayor') {
        badgeHtml = `<span class="product-badge-pill badge-wholesale">📦 Al Mayor</span>`;
      } else if (product.badge) {
        badgeHtml = `<span class="product-badge-pill badge-custom">${product.badge}</span>`;
      } else if (product.category === 'charcuteria') {
        badgeHtml = `<span class="product-badge-pill badge-fresh">🌿 Fresco</span>`;
      }

      const reviewsCount = product.reviewsCount || product.reviews || 64;

      // Botón estilo Instacart (+ o Stepper verde)
      let actionControlHtml = '';
      if (inCartQty === 0) {
        actionControlHtml = `
          <button class="btn-add-instacart" data-id="${product.id}" aria-label="Agregar ${product.name} al carrito">
            <span class="btn-plus-icon">+</span>
            <span>Agregar</span>
          </button>
        `;
      } else {
        actionControlHtml = `
          <div class="quantity-stepper" data-id="${product.id}">
            <button class="stepper-btn btn-stepper-minus" data-id="${product.id}" title="Disminuir">−</button>
            <div class="stepper-center">
              <span class="stepper-qty-label">En Carrito</span>
              <span class="stepper-count">${inCartQty}</span>
            </div>
            <button class="stepper-btn btn-stepper-plus" data-id="${product.id}" title="Aumentar">+</button>
          </div>
        `;
      }

      return `
        <article class="product-card" data-product-id="${product.id}">
          ${badgeHtml}
          <button class="btn-wishlist ${isWishlisted ? 'active' : ''}" data-id="${product.id}" title="${isWishlisted ? 'Quitar de favoritos' : 'Guardar en favoritos'}">
            ${isWishlisted ? '❤️' : '🤍'}
          </button>
          
          <div class="product-image-wrap open-detail-trigger" data-id="${product.id}">
            <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80'">
            <span class="quick-view-hint">🔍 Vista rápida</span>
          </div>

          <div class="product-info open-detail-trigger" data-id="${product.id}">
            <div class="product-meta-header">
              <span class="product-meta-unit">${catIconHtml} ${product.unit}</span>
              <span class="product-meta-origin">${product.origin || 'Al Costo 🛒'}</span>
            </div>

            <h3 class="product-title" title="${product.name}">${product.name}</h3>

            <div class="product-price-row">
              <div class="price-primary-row">
                <span class="product-current-price">$${product.price.toFixed(2)}</span>
                ${product.originalPrice ? `<span class="product-original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
              </div>
              <div class="product-currency-badges">
                <span class="badge-currency-bs" title="Tasa oficial Banco Central">🇻🇪 ${(product.price * CURRENCY_RATES.BS).toFixed(2)} Bs</span>
                <span class="badge-currency-cop" title="Pesos Colombianos">🇨🇴 ${(Math.round(product.price * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
              </div>
            </div>

            ${product.wholesalePrice ? `
              <div class="product-wholesale-tag">
                <div class="wholesale-info">
                  <span>📦 Mayor: <strong>$${product.wholesalePrice.toFixed(2)}</strong> (mín ${product.wholesaleMin || 1}u)</span>
                  <span class="wholesale-sub">${(product.wholesalePrice * CURRENCY_RATES.BS).toFixed(0)} Bs • ${(Math.round(product.wholesalePrice * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
                </div>
              </div>
            ` : ''}

            <div class="product-rating-row">
              <span class="product-stars">★★★★★</span>
              <span class="rating-val">${product.rating || 4.9}</span>
              <span class="reviews-count">(${reviewsCount})</span>
            </div>
          </div>

          <div class="product-card-actions">
            ${actionControlHtml}
          </div>
        </article>
      `;
    }).join('');

    bindProductCardEvents();
  }

  // Comprueba si una imagen tiene esquinas negras artificiales y le aplica blend-dark-bg o fondo oscuro
  function checkImageDarkBg(imgEl) {
    if (!imgEl || imgEl.dataset.checkedBg) return;
    imgEl.dataset.checkedBg = 'true';
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 16;
      cvs.height = 16;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, 16, 16);
      const data = ctx.getImageData(0, 0, 2, 2).data;
      // Comprobar pixel superior izquierdo
      if (data[0] < 25 && data[1] < 25 && data[2] < 25 && data[3] > 200) {
        imgEl.classList.add('blend-dark-bg');
        const wrap = imgEl.closest('.product-image-wrap');
        if (wrap && document.documentElement.getAttribute('data-theme') !== 'dark') {
          wrap.style.backgroundColor = '#0F172A';
        }
      }
    } catch(e) {
      // Por si la imagen proviene de un dominio externo sin CORS
    }
  }

  function bindProductCardEvents() {
    // Detectar si la imagen cargada tiene bordes negros para aplicar blend limpio
    document.querySelectorAll('.product-image').forEach(img => {
      if (img.complete) {
        checkImageDarkBg(img);
      } else {
        img.addEventListener('load', () => checkImageDarkBg(img));
      }
    });

    // Abrir Modal de Detalles
    document.querySelectorAll('.open-detail-trigger').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = el.getAttribute('data-id');
        openProductModal(id);
      });
    });

    // Botón Agregar "+" inicial
    document.querySelectorAll('.btn-add-instacart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        addToCart(id, 1);
      });
    });

    // Steppers (+ / -)
    document.querySelectorAll('.btn-stepper-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        addToCart(id, 1);
      });
    });

    document.querySelectorAll('.btn-stepper-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        removeFromCart(id, 1);
      });
    });

    // Wishlist Toggle
    document.querySelectorAll('.btn-wishlist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        toggleWishlist(id);
      });
    });
  }

  // ==========================================================================
  // CARRITO DE COMPRAS Y CÁLCULOS INSTACART
  // ==========================================================================
  function addToCart(productId, qty = 1, substitutionPref = 'similar') {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;

    if (!state.cart[productId]) {
      state.cart[productId] = {
        product: product,
        quantity: 0,
        substitutionPref: substitutionPref
      };
    }

    state.cart[productId].quantity += qty;
    saveCart();
    renderProducts();
    updateCartUI();
    showToast(`✅ "${product.name}" añadido al carrito`, 'success');
  }

  function removeFromCart(productId, qty = 1) {
    if (!state.cart[productId]) return;

    state.cart[productId].quantity -= qty;
    if (state.cart[productId].quantity <= 0) {
      delete state.cart[productId];
    }

    saveCart();
    renderProducts();
    updateCartUI();
  }

  function deleteCartItem(productId) {
    if (state.cart[productId]) {
      const name = state.cart[productId].product.name;
      delete state.cart[productId];
      saveCart();
      renderProducts();
      updateCartUI();
      showToast(`🗑️ "${name}" eliminado del carrito`);
    }
  }

  function saveCart() {
    localStorage.setItem('alcosto_cart', JSON.stringify(state.cart));
  }

  function calculateCartTotals() {
    let subtotal = 0;
    let itemCount = 0;

    Object.values(state.cart).forEach(item => {
      const isWholesale = item.product.wholesalePrice && item.quantity >= (item.product.wholesaleMin || 1);
      const unitPrice = isWholesale ? item.product.wholesalePrice : item.product.price;
      subtotal += unitPrice * item.quantity;
      itemCount += item.quantity;
    });

    // Envío Gratis a partir de $35 o con cupón o si es pickup
    const freeShippingThreshold = 35.00;
    let deliveryFee = 3.99;
    
    if (state.deliveryType === 'pickup' || subtotal >= freeShippingThreshold || (state.appliedCoupon && state.appliedCoupon.type === 'shipping')) {
      deliveryFee = 0.00;
    }

    // Descuento de cupón
    let discount = 0;
    if (state.appliedCoupon) {
      if (state.appliedCoupon.type === 'percent') {
        discount = (subtotal * state.appliedCoupon.discount) / 100;
      } else if (state.appliedCoupon.type === 'fixed') {
        discount = state.appliedCoupon.discount;
      }
    }

    // Propina calculada sobre subtotal
    const tip = (subtotal * state.shopperTipPercent) / 100;

    const total = Math.max(0, subtotal - discount + deliveryFee + tip);

    return {
      subtotal,
      itemCount,
      freeShippingThreshold,
      deliveryFee,
      discount,
      tip,
      total
    };
  }

  function updateCartUI() {
    const { subtotal, itemCount, freeShippingThreshold, deliveryFee, discount, tip, total } = calculateCartTotals();

    // Actualizar badges en Header y Barra Móvil
    if (cartBadgeCountEl) cartBadgeCountEl.textContent = itemCount;
    if (cartDrawerCountBadgeEl) cartDrawerCountBadgeEl.textContent = `${itemCount} items`;
    if (cartTotalPreviewEl) cartTotalPreviewEl.textContent = `$${subtotal.toFixed(2)}`;

    const mobileNavCartBadge = document.getElementById('mobileNavCartBadge');
    if (mobileNavCartBadge) {
      mobileNavCartBadge.textContent = itemCount;
      mobileNavCartBadge.style.display = itemCount > 0 ? 'inline-flex' : 'none';
    }

    // Barra de envío gratis
    if (freeShippingFillEl && freeShippingLabelEl) {
      if (state.deliveryType === 'pickup') {
        freeShippingFillEl.style.width = '100%';
        freeShippingLabelEl.innerHTML = '🏪 <strong>Recogida en tienda gratuita activada</strong>';
      } else if (subtotal >= freeShippingThreshold) {
        freeShippingFillEl.style.width = '100%';
        freeShippingLabelEl.innerHTML = '🎉 <strong>¡Felicidades! Tienes Envío Gratis</strong>';
      } else {
        const remaining = (freeShippingThreshold - subtotal).toFixed(2);
        const pct = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
        freeShippingFillEl.style.width = `${pct}%`;
        freeShippingLabelEl.innerHTML = `🚚 Agrega <strong>$${remaining}</strong> más para <strong>Envío Gratis</strong>`;
      }
    }

    // Actualizar resumen numérico con 3 divisas (USD, Bs, COP)
    if (cartSubtotalEl) {
      cartSubtotalEl.innerHTML = `<strong>$${subtotal.toFixed(2)}</strong> <span style="font-size:0.75rem; color:#666;">(${(subtotal * CURRENCY_RATES.BS).toFixed(0)} Bs | ${(Math.round(subtotal * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP)</span>`;
    }
    if (cartDeliveryFeeEl) cartDeliveryFeeEl.textContent = deliveryFee === 0 ? 'GRATIS' : `$${deliveryFee.toFixed(2)}`;
    if (cartTipEl) cartTipEl.textContent = `$${tip.toFixed(2)}`;
    if (cartTotalEl) {
      cartTotalEl.innerHTML = `
        <div style="font-size: 1.25rem; font-weight: 900; color: var(--color-primary);">$${total.toFixed(2)}</div>
        <div style="display: flex; gap: 6px; font-size: 0.76rem; font-weight: 700; margin-top: 2px;">
          <span class="badge-currency-bs">🇻🇪 ${(total * CURRENCY_RATES.BS).toFixed(2)} Bs</span>
          <span class="badge-currency-cop">🇨🇴 ${(Math.round(total * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
        </div>
      `;
    }

    if (cartDiscountRowEl) {
      if (discount > 0) {
        cartDiscountRowEl.style.display = 'flex';
        if (cartDiscountEl) cartDiscountEl.textContent = `-$${discount.toFixed(2)}`;
      } else {
        cartDiscountRowEl.style.display = 'none';
      }
    }

    // Renderizar lista de artículos en el drawer
    renderCartDrawerItems();
  }

  function renderCartDrawerItems() {
    if (!cartDrawerItemsListEl) return;

    const items = Object.values(state.cart);

    if (items.length === 0) {
      cartDrawerItemsListEl.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🛒</div>
          <h4 class="cart-empty-title">Tu carrito está vacío</h4>
          <p class="cart-empty-desc">Descubre productos frescos a precios Al Costo y agrégalos con un solo clic.</p>
          <button class="btn-hero-cta" style="background: var(--color-primary); color: white; width: 100%;" id="startShoppingBtn">
            Explorar Al Costo
          </button>
        </div>
      `;
      const startBtn = document.getElementById('startShoppingBtn');
      if (startBtn) {
        startBtn.addEventListener('click', closeCartDrawer);
      }
      return;
    }

    cartDrawerItemsListEl.innerHTML = items.map(item => {
      const isWholesale = item.product.wholesalePrice && item.quantity >= (item.product.wholesaleMin || 1);
      const activePrice = isWholesale ? item.product.wholesalePrice : item.product.price;
      const itemSubtotal = (activePrice * item.quantity).toFixed(2);
      return `
        <div class="cart-item-row" data-id="${item.product.id}">
          <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-thumb" loading="lazy" decoding="async">
          
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.product.name}</h4>
            <div class="cart-item-unit-price">
              $${activePrice.toFixed(2)} c/u • ${item.product.unit}
              ${isWholesale ? '<span style="color:#108910; font-weight:700;"> (Tarifa Mayorista aplicada 📦)</span>' : ''}
            </div>
            
            <div class="cart-item-actions">
              <div class="cart-item-stepper">
                <button class="cart-drawer-minus" data-id="${item.product.id}">−</button>
                <span>${item.quantity}</span>
                <button class="cart-drawer-plus" data-id="${item.product.id}">+</button>
              </div>
              <button class="btn-remove-item" data-id="${item.product.id}">Eliminar</button>
            </div>
          </div>

          <div class="cart-item-total">$${itemSubtotal}</div>
        </div>
      `;
    }).join('');

    // Eventos de los botones dentro del drawer
    cartDrawerItemsListEl.querySelectorAll('.cart-drawer-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        addToCart(id, 1);
      });
    });

    cartDrawerItemsListEl.querySelectorAll('.cart-drawer-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        removeFromCart(id, 1);
      });
    });

    cartDrawerItemsListEl.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteCartItem(id);
      });
    });
  }

  // Control del Drawer
  function openCartDrawer() {
    if (cartDrawerEl && drawerBackdropEl) {
      cartDrawerEl.classList.add('active');
      drawerBackdropEl.classList.add('active');
      document.body.classList.add('cart-drawer-open'); // Oculta la barra de navegación inferior móvil
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCartDrawer() {
    if (cartDrawerEl && drawerBackdropEl) {
      cartDrawerEl.classList.remove('active');
      drawerBackdropEl.classList.remove('active');
      document.body.classList.remove('cart-drawer-open'); // Devuelve la barra de navegación inferior
      document.body.style.overflow = '';
    }
  }

  // ==========================================================================
  // QUICK VIEW / MODAL DETALLES DEL PRODUCTO
  // ==========================================================================
  function openProductModal(productId) {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product || !productModalEl) return;

    state.selectedProductForModal = product;
    const inCartQty = state.cart[productId] ? state.cart[productId].quantity : 1;

    const modalBody = document.getElementById('productModalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="product-detail-layout">
        <div class="modal-img-container">
          <img src="${product.image}" alt="${product.name}" decoding="async">
        </div>

        <div class="modal-product-content">
          ${product.badge ? `<span class="modal-product-badge">${product.badge}</span>` : ''}
          <h2 class="modal-product-title">${product.name}</h2>
          
          <div class="modal-product-price-row">
            <div>
              <span class="modal-product-price">$${product.price.toFixed(2)}</span>
              ${product.originalPrice ? `<span class="product-original-price" style="font-size: 1.1rem;">$${product.originalPrice.toFixed(2)}</span>` : ''}
              <span class="modal-product-unit">(${product.unit})</span>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <span class="badge-currency-bs" style="font-size: 0.82rem; padding: 3px 8px;">🇻🇪 ${(product.price * CURRENCY_RATES.BS).toFixed(2)} Bs</span>
              <span class="badge-currency-cop" style="font-size: 0.82rem; padding: 3px 8px;">🇨🇴 ${(Math.round(product.price * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
            </div>
          </div>

          <div class="product-rating-row" style="margin-bottom: 12px;">
            <span class="product-stars">★★★★★</span>
            <strong>${product.rating}</strong>
            <span>(${product.reviews} reseñas de clientes)</span>
          </div>

          <p class="modal-product-description">${product.description}</p>
          
          <div style="font-size: 0.82rem; color: #444; margin-bottom: 14px;">
            📍 <strong>Origen:</strong> ${product.origin}
          </div>

          ${product.wholesalePrice ? `
            <div style="background: #E8F5E9; border: 1px solid #A7F3D0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.85rem; color: #003D29;">
              <strong>📦 Tarifa Mayorista:</strong> Obtén precio especial de <strong>$${product.wholesalePrice.toFixed(2)} c/u</strong> comprando <strong>${product.wholesaleMin || 1} o más unidades</strong>.
            </div>
          ` : ''}

          <!-- Preferencia de Sustitución Estilo Instacart -->
          <div class="substitution-box">
            <label for="modalSubPref">Preferencias si el producto está agotado:</label>
            <select id="modalSubPref">
              <option value="similar">Reemplazar con la mejor coincidencia similar (Recomendado)</option>
              <option value="contact">Llamarme o chatear antes de reemplazar</option>
              <option value="refund">No reemplazar y reembolsar este artículo</option>
            </select>
          </div>

          <div class="modal-product-actions">
            <div class="cart-item-stepper" style="height: 42px; padding: 4px 10px;">
              <button id="modalQtyMinus" style="font-size: 1.1rem; width: 28px; height: 28px;">−</button>
              <span id="modalQtyValue" style="font-size: 1.1rem; font-weight: 800; min-width: 32px; text-align: center;">${inCartQty > 0 ? inCartQty : 1}</span>
              <button id="modalQtyPlus" style="font-size: 1.1rem; width: 28px; height: 28px;">+</button>
            </div>

            <button class="btn-checkout-primary" id="modalAddToCartBtn" style="flex: 1; height: 42px;">
              🛒 Añadir al Pedido
            </button>
          </div>
        </div>
      </div>
    `;

    // Interacción de cantidad en modal
    let modalQty = inCartQty > 0 ? inCartQty : 1;
    const qtyValEl = document.getElementById('modalQtyValue');
    const qtyMinusBtn = document.getElementById('modalQtyMinus');
    const qtyPlusBtn = document.getElementById('modalQtyPlus');
    const addModalBtn = document.getElementById('modalAddToCartBtn');
    const subPrefSelect = document.getElementById('modalSubPref');

    qtyMinusBtn.addEventListener('click', () => {
      if (modalQty > 1) {
        modalQty--;
        qtyValEl.textContent = modalQty;
      }
    });

    qtyPlusBtn.addEventListener('click', () => {
      modalQty++;
      qtyValEl.textContent = modalQty;
    });

    addModalBtn.addEventListener('click', () => {
      const pref = subPrefSelect ? subPrefSelect.value : 'similar';
      addToCart(product.id, modalQty, pref);
      closeProductModal();
    });

    productModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    if (productModalEl) {
      productModalEl.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ==========================================================================
  // GESTIÓN DE PERFIL Y DATOS DE ENTREGA
  // ==========================================================================
  function openCustomerProfileModal() {
    if (!customerProfileModal) return;
    if (profNameInput) profNameInput.value = state.customerProfile.name || '';
    if (profPhoneInput) profPhoneInput.value = state.customerProfile.phone || '';
    if (profAddressInput) profAddressInput.value = state.customerProfile.address || '';
    if (profReferenceInput) profReferenceInput.value = state.customerProfile.reference || '';

    customerProfileModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCustomerProfileModal() {
    if (customerProfileModal) {
      customerProfileModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ==========================================================================
  // MODO MANUAL: SI EL CLIENTE ESCRIBE SU DIRECCIÓN, EL GPS SE PAUSA SOLO
  // ==========================================================================
  // Detecta si un texto de dirección fue generado automáticamente por el GPS
  function isGpsAddressText(val) {
    if (!val) return false;
    const v = String(val).trim();
    return v.includes('Ubicación GPS') || /^lat:/i.test(v);
  }

  // true cuando el cliente escribió su dirección a mano (destino ≠ punto GPS)
  function isManualAddressValue(val) {
    return Boolean(val && String(val).trim() && !isGpsAddressText(val));
  }

  // ==========================================================================
  // DETECCIÓN SATELITAL DE UBICACIÓN REAL (GEOLOCATION API)
  // ==========================================================================
  function detectLiveGpsLocation(btnEl, statusBoxEl, coordsEl, mapLinkEl, inputAddressEl) {
    if (!navigator.geolocation) {
      showToast('⚠️ Tu navegador no soporta geolocalización satelital GPS', 'warning');
      return;
    }

    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = `<span>🛰️</span> <span>Conectando con satélites GPS en tiempo real...</span>`;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 10);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        state.realGpsLocation = {
          lat,
          lng,
          accuracy,
          mapsUrl,
          timestamp: new Date().toISOString()
        };

        try {
          localStorage.setItem('alcosto_user_gps', JSON.stringify(state.realGpsLocation));
        } catch (e) {}

        if (statusBoxEl) statusBoxEl.style.display = 'block';
        if (coordsEl) coordsEl.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} (Precisión: ±${accuracy}m)`;
        if (mapLinkEl) mapLinkEl.href = mapsUrl;

        if (inputAddressEl && (!inputAddressEl.value || inputAddressEl.value.includes('GPS') || inputAddressEl.value.includes('Lat:'))) {
          inputAddressEl.value = `📍 Ubicación GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}) ±${accuracy}m`;
        }

        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = `<span>🔄</span> <span>Actualizar Ubicación GPS en Vivo</span>`;
        }

        showToast(`🟢 ¡Ubicación GPS real capturada con éxito (±${accuracy}m)!`, 'success');
      },
      (error) => {
        console.warn('Error capturando GPS:', error);
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = `<span>🛰️</span> <span>Reintentar Detección GPS</span>`;
        }
        let msg = 'No se pudo obtener tu ubicación por GPS satelital. Por favor escribe tu dirección en el campo de texto.';
        if (error.code === 1) {
          msg = 'Permiso de ubicación denegado en tu navegador. Por favor permite la ubicación o ingresa tu dirección manualmente.';
        }
        showToast(`⚠️ ${msg}`, 'warning');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  // ==========================================================================
  // CHECKOUT MODAL Y PROCESO DE PAGO
  // ==========================================================================
  async function openCheckoutModal() {
    const { itemCount } = calculateCartTotals();
    if (itemCount === 0) {
      showToast('⚠️ Agrega productos a tu carrito antes de pagar');
      return;
    }

    closeCartDrawer();

    // Elementos del bloque de despacho dentro del Checkout
    const checkoutTotalSummaryEl = document.getElementById('checkoutTotalSummary');
    const btnModeDelivery = document.getElementById('btnModeDelivery');
    const btnModePickup = document.getElementById('btnModePickup');
    const checkoutDeliverySection = document.getElementById('checkoutDeliverySection');
    const checkoutPickupInfo = document.getElementById('checkoutPickupInfo');
    const checkoutGpsBadge = document.getElementById('checkoutGpsBadge');
    const checkoutGpsCoords = document.getElementById('checkoutGpsCoords');
    const checkoutGpsMapLink = document.getElementById('checkoutGpsMapLink');
    const btnRefreshCheckoutGps = document.getElementById('btnRefreshCheckoutGps');
    const addrInput = document.getElementById('orderAddress');

    // Actualiza el total mostrado (recalcula con el envío según la modalidad activa)
    function renderCheckoutTotal() {
      if (!checkoutTotalSummaryEl) return;
      const { total } = calculateCartTotals();
      checkoutTotalSummaryEl.innerHTML = `
        <span style="font-size: 1.35rem; font-weight: 900; color: #108910;">$${total.toFixed(2)}</span>
        <div style="display: flex; gap: 6px; font-size: 0.78rem; font-weight: 700; margin-top: 4px;">
          <span class="badge-currency-bs">🇻🇪 ${(total * CURRENCY_RATES.BS).toFixed(2)} Bs</span>
          <span class="badge-currency-cop">🇨🇴 ${(Math.round(total * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
        </div>
      `;
    }

    // MODO MANUAL EN CHECKOUT: si el cliente escribe su dirección, se ocultan las coordenadas GPS
    const checkoutManualNotice = document.getElementById('checkoutManualNotice');

    function syncCheckoutManualMode() {
      const currentAddr = document.getElementById('orderAddress');
      const isManual = state.deliveryType !== 'pickup' && isManualAddressValue(currentAddr ? currentAddr.value : '');
      if (checkoutGpsBadge) {
        checkoutGpsBadge.style.display = (!isManual && state.realGpsLocation && state.deliveryType !== 'pickup') ? 'block' : 'none';
      }
      if (checkoutManualNotice) checkoutManualNotice.style.display = isManual ? 'flex' : 'none';
    }

    // Aplica la modalidad de despacho elegida (Delivery GPS o Retirar en Tienda)
    function applyDispatchMode(mode, opts = {}) {
      const { autoGps = false } = opts;
      state.deliveryType = (mode === 'pickup') ? 'pickup' : 'delivery';
      localStorage.setItem('alcosto_delivery_type', state.deliveryType);

      if (btnModeDelivery) btnModeDelivery.classList.toggle('active', state.deliveryType === 'delivery');
      if (btnModePickup) btnModePickup.classList.toggle('active', state.deliveryType === 'pickup');

      if (state.deliveryType === 'pickup') {
        // Retirar en Tienda: envío $0.00 y se ocultan dirección/GPS
        if (checkoutDeliverySection) checkoutDeliverySection.style.display = 'none';
        if (checkoutPickupInfo) checkoutPickupInfo.style.display = 'block';
        if (addrInput) addrInput.value = `Recogida en Tienda Al Costo (Coords: ${STORE_COORDINATES})`;
        if (checkoutGpsBadge) checkoutGpsBadge.style.display = 'none';
        if (checkoutManualNotice) checkoutManualNotice.style.display = 'none';
        showToast('🏪 Modalidad: Retirar en Tienda • Envío $0.00', 'success');
      } else {
        // Delivery GPS: se muestran dirección/GPS y se activa la detección de ubicación
        if (checkoutDeliverySection) checkoutDeliverySection.style.display = 'block';
        if (checkoutPickupInfo) checkoutPickupInfo.style.display = 'none';
        if (addrInput && addrInput.value.startsWith('Recogida en Tienda')) {
          addrInput.value = state.customerProfile.address
            ? state.customerProfile.address + (state.customerProfile.reference ? ` (Ref: ${state.customerProfile.reference})` : '')
            : '';
        }
        syncCheckoutManualMode();
        // Activar detección GPS automáticamente solo si aún no hay ubicación fijada
        if (autoGps && !state.realGpsLocation && btnRefreshCheckoutGps) {
          detectLiveGpsLocation(btnRefreshCheckoutGps, null, checkoutGpsCoords, checkoutGpsMapLink, addrInput);
          if (checkoutGpsBadge) checkoutGpsBadge.style.display = 'block';
        }
        showToast('🛵 Modalidad: Delivery GPS • Envío normal a tu puerta', 'success');
      }

      localStorage.setItem('alcosto_delivery_type', state.deliveryType);
      renderCheckoutTotal();
      updateCartUI();
    }

    if (btnModeDelivery) {
      btnModeDelivery.onclick = () => applyDispatchMode('delivery', { autoGps: true });
    }
    if (btnModePickup) {
      btnModePickup.onclick = () => applyDispatchMode('pickup');
    }

    if (btnRefreshCheckoutGps) {
      btnRefreshCheckoutGps.onclick = () => {
        const orderAddressInput = document.getElementById('orderAddress');
        // Si el cliente escribió una dirección a mano, preguntar antes de reemplazarla por el GPS
        if (isManualAddressValue(orderAddressInput ? orderAddressInput.value : '')) {
          const useGps = window.confirm('✋ Escribiste una dirección manualmente. ¿Quieres reemplazarla por la ubicación GPS en vivo?');
          if (!useGps) {
            showToast('✍️ Mantuvimos tu dirección manual. Las coordenadas GPS siguen pausadas.');
            return;
          }
          orderAddressInput.value = '';
        }
        detectLiveGpsLocation(btnRefreshCheckoutGps, null, checkoutGpsCoords, checkoutGpsMapLink, orderAddressInput);
        if (checkoutGpsBadge) checkoutGpsBadge.style.display = 'block';
        if (checkoutManualNotice) checkoutManualNotice.style.display = 'none';
      };
    }

    // Prellenar con los datos guardados del cliente
    const nameInput = document.getElementById('orderName');
    const phoneInput = document.getElementById('orderPhone');
    if (nameInput) {
      nameInput.value = (state.authUser && state.authUser.name) ? state.authUser.name : (state.customerProfile.name || '');
    }
    if (phoneInput) {
      phoneInput.value = (state.authUser && state.authUser.phone) ? state.authUser.phone : (state.customerProfile.phone || '');
    }

    if (addrInput) {
      addrInput.oninput = () => syncCheckoutManualMode();
    }

    // Sincronizar la modalidad guardada (o Delivery por defecto la primera vez)
    applyDispatchMode(state.deliveryType || 'delivery');
    syncCheckoutManualMode();

    // Cargar y mostrar datos del método de pago activo (Pago Móvil / Zelle / Binance Pay / Efectivo)
    await renderActivePaymentDetails();

    if (checkoutModalEl) {
      checkoutModalEl.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  // ==========================================================================
  // SUBIDA DE CAPTURA DE COMPROBANTE DE PAGO (Pago Móvil / Zelle / Binance)
  // ==========================================================================
  // Comprime y convierte la imagen subida a un Data URL ligero (para no saturar localStorage)
  function compressProofImage(file, maxDim = 1200, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Markup del bloque "Sube tu captura del pago" (se inyecta justo debajo del botón Copiar Datos)
  function paymentProofUploaderHTML() {
    return `
      <div class="payment-proof-upload-box">
        <div class="payment-proof-upload-header">
          <i class="fa-solid fa-camera" style="color: #108910;"></i>
          <strong>¿Ya realizaste el pago? Adjunta tu captura de pantalla</strong>
        </div>
        <p class="payment-proof-upload-hint">
          Sube el screenshot del comprobante de pago para que podamos verificar la transferencia y preparar tu pedido más rápido.
        </p>
        <label class="payment-proof-upload-btn" for="paymentProofInput">
          <i class="fa-solid fa-cloud-arrow-up"></i> Subir Captura del Pago
          <input type="file" id="paymentProofInput" accept="image/*" hidden>
        </label>
        <div class="payment-proof-preview" id="paymentProofPreview" style="display: none;">
          <img id="paymentProofImg" alt="Captura del comprobante de pago">
          <div class="payment-proof-preview-meta">
            <span class="payment-proof-filename" id="paymentProofName"></span>
            <button type="button" class="payment-proof-remove-btn" id="paymentProofRemoveBtn">✕ Quitar captura</button>
          </div>
        </div>
      </div>
    `;
  }

  function wirePaymentProofUploader() {
    const input = document.getElementById('paymentProofInput');
    const preview = document.getElementById('paymentProofPreview');
    const imgEl = document.getElementById('paymentProofImg');
    const nameEl = document.getElementById('paymentProofName');
    const removeBtn = document.getElementById('paymentProofRemoveBtn');
    if (!input || !preview) return;

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type || !file.type.startsWith('image/')) {
        showToast('⚠️ El comprobante debe ser una imagen (captura de pantalla)', 'normal');
        input.value = '';
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast('⚠️ La imagen es demasiado grande (máximo 15 MB)', 'normal');
        input.value = '';
        return;
      }
      try {
        const dataUrl = await compressProofImage(file);
        state.paymentProof = dataUrl;
        if (imgEl) imgEl.src = dataUrl;
        if (nameEl) nameEl.textContent = file.name;
        preview.style.display = 'flex';
        showToast('📸 Captura de pago adjunta. Se enviará junto con tu pedido', 'success');
      } catch (e) {
        console.error('Error procesando la captura de pago:', e);
        showToast('⚠️ No se pudo procesar la imagen. Intenta con otra captura', 'normal');
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        state.paymentProof = null;
        input.value = '';
        if (imgEl) imgEl.src = '';
        preview.style.display = 'none';
      });
    }
  }

  // Renderizar detalles del método de pago activo
  async function renderActivePaymentDetails() {
    const box = document.getElementById('paymentDetailsBox');
    if (!box) return;

    const activeCard = document.querySelector('.payment-method-card.active');
    const payType = activeCard ? activeCard.getAttribute('data-pay-type') : 'pagomovil';

    // Cada método online tiene su propia captura: al cambiar de método se reinicia la adjunta anterior
    state.paymentProof = null;

    let config = null;
    if (typeof SupabaseService !== 'undefined') {
      config = await SupabaseService.fetchPaymentConfig();
    }
    if (!config) {
      config = {
        pagoMovil: { banco: 'Banco de Venezuela (0102)', telefono: '0412-1234567', cedula: 'V-26.123.456', titular: 'Al Costo C.A.' },
        zelle: { correo: 'pagos@alcostosuper.com', titular: 'Al Costo Supermarket LLC' },
        binance: { payId: '284910283', correo: 'binance@alcostosuper.com', red: 'USDT (TRC20 / BEP20)' }
      };
    }

    if (payType === 'pagomovil') {
      const pm = config.pagoMovil || {};
      box.innerHTML = `
        <div class="payment-detail-card-inner">
          <div class="payment-detail-header">
            <i class="fa-solid fa-mobile-screen-button" style="color: #108910; font-size: 1.15rem;"></i>
            <strong style="color: #1E293B; font-size: 0.92rem;">Datos para Pago Móvil (Tasa Oficial BCV)</strong>
            <span class="payment-detail-badge">Inmediato</span>
          </div>
          <div class="payment-info-grid">
            <div class="payment-info-item">
              <span class="item-label">Banco Receptor:</span>
              <span class="item-val">${pm.banco || 'Banco de Venezuela (0102)'}</span>
            </div>
            <div class="payment-info-item">
              <span class="item-label">Teléfono:</span>
              <span class="item-val">${pm.telefono || '0412-1234567'}</span>
            </div>
            <div class="payment-info-item">
              <span class="item-label">Cédula / RIF:</span>
              <span class="item-val">${pm.cedula || 'V-26.123.456'}</span>
            </div>
            <div class="payment-info-item">
              <span class="item-label">Titular:</span>
              <span class="item-val">${pm.titular || 'Al Costo Supermercado C.A.'}</span>
            </div>
          </div>
          <button type="button" class="copy-payment-info-btn" id="btnCopyPagoMovil">
            <i class="fa-regular fa-copy"></i> Copiar Datos de Pago Móvil
          </button>
          ${paymentProofUploaderHTML()}
        </div>
      `;
      const btnCopy = document.getElementById('btnCopyPagoMovil');
      if (btnCopy) {
        btnCopy.onclick = () => {
          const text = `Pago Móvil Al Costo:\nBanco: ${pm.banco}\nTel: ${pm.telefono}\nCI: ${pm.cedula}\nTitular: ${pm.titular}`;
          if (navigator.clipboard) navigator.clipboard.writeText(text);
          showToast('📋 Datos de Pago Móvil copiados al portapapeles', 'success');
        };
      }
    } else if (payType === 'zelle') {
      const z = config.zelle || {};
      box.innerHTML = `
        <div class="payment-detail-card-inner">
          <div class="payment-detail-header">
            <i class="fa-solid fa-dollar-sign" style="color: #7C3AED; font-size: 1.15rem;"></i>
            <strong style="color: #1E293B; font-size: 0.92rem;">Datos de Transferencia Zelle (USD)</strong>
            <span class="payment-detail-badge" style="background:#EDE9FE; color:#6D28D9;">USD $</span>
          </div>
          <div class="payment-info-grid">
            <div class="payment-info-item" style="grid-column: 1 / -1;">
              <span class="item-label">Correo Electrónico Zelle:</span>
              <span class="item-val" style="color: #6D28D9; font-size: 1.05rem;">${z.correo || 'pagos@alcostosuper.com'}</span>
            </div>
            <div class="payment-info-item" style="grid-column: 1 / -1;">
              <span class="item-label">Nombre del Titular:</span>
              <span class="item-val">${z.titular || 'Al Costo Supermarket LLC'}</span>
            </div>
          </div>
          <button type="button" class="copy-payment-info-btn" style="background: #7C3AED;" id="btnCopyZelle">
            <i class="fa-regular fa-copy"></i> Copiar Correo Zelle
          </button>
          ${paymentProofUploaderHTML()}
        </div>
      `;
      const btnCopy = document.getElementById('btnCopyZelle');
      if (btnCopy) {
        btnCopy.onclick = () => {
          if (navigator.clipboard) navigator.clipboard.writeText(z.correo || '');
          showToast('📋 Correo Zelle copiado', 'success');
        };
      }
    } else if (payType === 'binance') {
      const b = config.binance || {};
      box.innerHTML = `
        <div class="payment-detail-card-inner">
          <div class="payment-detail-header">
            <i class="fa-brands fa-bitcoin" style="color: #F59E0B; font-size: 1.15rem;"></i>
            <strong style="color: #1E293B; font-size: 0.92rem;">Binance Pay / Cripto (USDT)</strong>
            <span class="payment-detail-badge" style="background:#FEF3C7; color:#B45309;">0% Comisión</span>
          </div>
          <div class="payment-info-grid">
            <div class="payment-info-item">
              <span class="item-label">Binance Pay ID:</span>
              <span class="item-val" style="color: #D97706; font-size: 1.05rem;">${b.payId || '284910283'}</span>
            </div>
            <div class="payment-info-item">
              <span class="item-label">Correo Binance:</span>
              <span class="item-val">${b.correo || 'binance@alcostosuper.com'}</span>
            </div>
            <div class="payment-info-item" style="grid-column: 1 / -1;">
              <span class="item-label">Red Aceptada:</span>
              <span class="item-val">${b.red || 'USDT (Red TRC20 / BEP20)'}</span>
            </div>
          </div>
          <button type="button" class="copy-payment-info-btn" style="background: #F59E0B; color: #111;" id="btnCopyBinance">
            <i class="fa-regular fa-copy"></i> Copiar Binance Pay ID
          </button>
          ${paymentProofUploaderHTML()}
        </div>
      `;
      const btnCopy = document.getElementById('btnCopyBinance');
      if (btnCopy) {
        btnCopy.onclick = () => {
          if (navigator.clipboard) navigator.clipboard.writeText(b.payId || '');
          showToast('📋 Binance Pay ID copiado', 'success');
        };
      }
    } else {
      box.innerHTML = `
        <div class="payment-detail-card-inner">
          <div class="payment-detail-header">
            <i class="fa-solid fa-money-bill-wave" style="color: #059669; font-size: 1.15rem;"></i>
            <strong style="color: #1E293B; font-size: 0.92rem;">Pago en Efectivo contra Entrega</strong>
          </div>
          <p style="font-size: 0.85rem; color: #475569; margin: 0;">
            Pagas en efectivo al recibir tu pedido. Aceptamos Dólares en efectivo ($ USD), Bolívares en efectivo o Pesos Colombianos (COP) calculados a la tasa del día.
          </p>
        </div>
      `;
    }

    // Conectar el bloque de subida de captura (solo métodos de pago online)
    if (payType === 'pagomovil' || payType === 'zelle' || payType === 'binance') {
      wirePaymentProofUploader();
    }
  }

  function closeCheckoutModal() {
    if (checkoutModalEl) {
      checkoutModalEl.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ==========================================================================
  // SEGUIMIENTO EN VIVO (LIVE ORDER TRACKING INSTACART)
  // ==========================================================================
  // ==========================================================================
  // SESIÓN DE SEGUIMIENTO ACTIVA (persiste entre recargas de la página)
  // ==========================================================================
  const ACTIVE_ORDER_ID_KEY = 'active_order_id';

  // Guarda el id del pedido confirmado para poder reabrir su seguimiento
  function saveActiveOrderId(orderId) {
    if (!orderId) return;
    try {
      localStorage.setItem(ACTIVE_ORDER_ID_KEY, String(orderId));
    } catch (e) {
      console.warn('No se pudo guardar active_order_id:', e);
    }
  }

  // Devuelve el id del pedido activo o null
  function getActiveOrderId() {
    try {
      return localStorage.getItem(ACTIVE_ORDER_ID_KEY);
    } catch (e) {
      return null;
    }
  }

  // Limpia la sesión de seguimiento (pedido terminado o inexistente)
  function clearActiveOrderId() {
    try {
      localStorage.removeItem(ACTIVE_ORDER_ID_KEY);
    } catch (e) {
      console.warn('No se pudo limpiar active_order_id:', e);
    }
  }

  // Estados que cierran la sesión de seguimiento (pedido terminado)
  function isFinalOrderStatus(status) {
    const normalized = String(status || '').toLowerCase();
    return normalized === 'entregado' || normalized === 'cancelado';
  }

  // Crea el pedido a partir del checkout y abre el seguimiento en vivo
  function launchLiveOrderTracker() {
    closeCheckoutModal();

    // Recopilar datos del pedido antes de vaciar el carrito
    const nameInput = document.getElementById('orderName');
    const phoneInput = document.getElementById('orderPhone');
    const addrInput = document.getElementById('orderAddress');
    const slotInput = document.getElementById('orderSlot');
    const instInput = document.getElementById('orderInstructions');
    const activePayCard = document.querySelector('.payment-method-card.active');

    const { subtotal, discount, deliveryFee, tip, total } = calculateCartTotals();

    const orderData = {
      id: 'AC-' + Math.floor(1000 + Math.random() * 9000),
      customerName: nameInput ? nameInput.value.trim() : (state.customerProfile.name || 'Cliente Al Costo'),
      customerPhone: phoneInput ? phoneInput.value.trim() : (state.customerProfile.phone || ''),
      deliveryType: state.deliveryType || 'delivery',
      // En Retirar en Tienda no se envían coordenadas GPS (iría el repartidor sin sentido)
      // Si el cliente escribió su dirección a mano, TAMPOCO se envían GPS para no confundir al repartidor
      gpsCoordinates: (state.deliveryType === 'pickup' || isManualAddressValue(addrInput ? addrInput.value : ''))
        ? null
        : (state.realGpsLocation || null),
      deliveryAddress: (state.deliveryType === 'pickup') 
        ? `Recogida en Sede Al Costo (${STORE_COORDINATES})` 
        : (addrInput ? addrInput.value.trim() : (state.customerProfile.address || 'Dirección de Entrega')),
      deliverySlot: slotInput ? slotInput.options[slotInput.selectedIndex].text : 'Hoy en 30-45 min',
      instructions: instInput ? instInput.value.trim() : '',
      paymentMethod: activePayCard ? activePayCard.querySelector('.payment-method-name').textContent.trim() : 'Tarjeta',
      paymentProof: state.paymentProof || null,
      items: Object.values(state.cart).map(item => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          price: (item.product.wholesalePrice && item.quantity >= (item.product.wholesaleMin || 1)) ? item.product.wholesalePrice : item.product.price,
          unit: item.product.unit
        },
        quantity: item.quantity
      })),
      subtotal,
      discount,
      deliveryFee,
      tip,
      total,
      status: 'nuevo',
      created_at: new Date().toISOString()
    };

    // Guardar pedido localmente para que admin.html lo muestre
    try {
      const existingOrders = JSON.parse(localStorage.getItem('alcosto_orders')) || [];
      existingOrders.unshift(orderData);
      localStorage.setItem('alcosto_orders', JSON.stringify(existingOrders));
    } catch (e) {
      // Si la cuota de localStorage está llena (capturas base64 grandes), reintentar sin la captura
      try {
        const existingOrders = JSON.parse(localStorage.getItem('alcosto_orders')) || [];
        existingOrders.unshift({ ...orderData, paymentProof: null });
        localStorage.setItem('alcosto_orders', JSON.stringify(existingOrders));
      } catch (e2) {
        console.error('Error guardando pedido:', e2);
      }
    }

    // Publicar pedido a Supabase si está conectado
    if (typeof SupabaseService !== 'undefined') {
      SupabaseService.sendOrderToSupabase(orderData);
    }

    // Persistir la sesión de seguimiento: al recargar o volver a entrar,
    // la página reabre automáticamente este pedido (ver restoreActiveOrderTracker)
    saveActiveOrderId(orderData.id);

    // Vaciar el carrito ya que la orden fue creada
    state.cart = {};
    state.paymentProof = null;
    saveCart();
    renderProducts();
    updateCartUI();

    // Abrir la vista de trayectoria con el pedido recién creado
    startOrderTracker(orderData, 'nuevo');
  }

  // ==========================================================================
  // AVISO DE LLEGADA DEL PEDIDO: TIMBRE + VIBRACIÓN DEL TELÉFONO
  // ==========================================================================
  // Tono tipo timbre de puerta (dos notas "ding-dong" con armónico suave y
  // caída larga), distinto del bip corto de los mensajes de redes sociales:
  // se reconoce al instante como "llegó el pedido" sin ser estridente.
  async function playArrivalChime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      if (!state.arrivalAudioCtx) state.arrivalAudioCtx = new AC();
      const ctx = state.arrivalAudioCtx;
      // El navegador exige un gesto previo: al primer toque se desbloquea y suena.
      // Se espera como mucho 300 ms para no quedarse colgado si sigue pendiente
      // (entonces se reintenta en el primer toque de la pantalla).
      if (ctx.state !== 'running' && ctx.resume) {
        try {
          await Promise.race([
            ctx.resume(),
            new Promise(resolve => setTimeout(resolve, 300))
          ]);
        } catch (e) { return false; }
      }
      if (ctx.state !== 'running') return false;

      const startAt = ctx.currentTime + 0.02;
      const master = ctx.createGain();
      master.gain.value = 0.16; // sutil: se oye, no asusta
      master.connect(ctx.destination);

      [
        { freq: 659.25, delay: 0, dur: 0.85 },   // Mi5 – primer golpe del timbre
        { freq: 523.25, delay: 0.26, dur: 1.15 } // Do5 – cola del timbre
      ].forEach(note => {
        const t0 = startAt + note.delay;
        [1, 2].forEach(harmonic => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq * harmonic, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(harmonic === 1 ? 1 : 0.22, t0 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t0);
          osc.stop(t0 + note.dur + 0.05);
        });
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function notifyOrderArrival() {
    // Vibración del teléfono (los que la soportan, p. ej. Android)
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate([120, 70, 180]);
    } catch (e) { /* dispositivo sin vibración */ }

    // Si aún no hay permiso de audio, suena en el primer toque de la pantalla
    playArrivalChime().then(played => {
      if (played) return;
      const cleanup = () => {
        window.removeEventListener('pointerdown', onFirstTouch);
        window.removeEventListener('keydown', onFirstTouch);
        clearTimeout(guardTimer);
      };
      const onFirstTouch = () => {
        playArrivalChime().then(ok => { if (ok) cleanup(); });
      };
      window.addEventListener('pointerdown', onFirstTouch);
      window.addEventListener('keydown', onFirstTouch);
      const guardTimer = setTimeout(cleanup, 60000);
    });
  }

  // ==========================================================================
  // CHAT CON EL SHOPPER (CUADRO DE DIÁLOGO CONVERSACIONAL)
  // ==========================================================================
  const CHAT_GREETING = '¡Hola! Soy Carlos 👋 Ya tengo tu pedido. ¿Necesitas algún cambio o preferencia en los víveres?';
  const CHAT_REPLIES = [
    '¡Entendido! Seleccionaré los más firmes y frescos para ti. 👌',
    '¡Claro! Lo reviso ahora mismo y te aviso por aquí. 👍',
    'Perfecto, lo dejo anotado en tu pedido 📝',
    'Cualquier cosa me escribes por aquí, estoy pendiente 😊'
  ];

  function chatTimeNow() {
    try {
      return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function escapeChatText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Pinta la conversación entera y deja el scroll al final (último mensaje)
  function renderChatMessages() {
    if (!chatMessagesEl) return;
    const bubbles = state.chatMessages.map(msg => `
      <div class="chat-msg ${msg.from === 'me' ? 'chat-msg-me' : 'chat-msg-shopper'}">
        ${msg.from === 'me' ? '' : '<span class="chat-msg-avatar" aria-hidden="true">👨‍🌾</span>'}
        <div class="chat-msg-bubble">
          <p>${escapeChatText(msg.text)}</p>
          <time>${msg.time || ''}</time>
        </div>
      </div>`).join('');
    const typing = chatTypingEl ? chatTypingEl.outerHTML : '';
    chatMessagesEl.innerHTML = bubbles + typing;
    // El repintado sustituye el nodo del indicador: hay que volver a referenciarlo
    chatTypingEl = document.getElementById('chatTyping');
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function setChatTyping(visible) {
    if (!chatTypingEl) return;
    chatTypingEl.hidden = !visible;
    if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function openChatModal() {
    if (!chatModalEl) return;
    if (state.chatMessages.length === 0) {
      state.chatMessages.push({ from: 'shopper', text: CHAT_GREETING, time: chatTimeNow() });
    }
    renderChatMessages();
    setChatTyping(false);
    chatModalEl.classList.add('active');
    syncBodyScrollLock();
    // El foco solo en escritorio: en el móvil abriría el teclado y taparía la conversación
    if (chatInput && window.innerWidth > 768) {
      setTimeout(() => chatInput.focus(), 250);
    }
  }

  function closeChatModal() {
    if (!chatModalEl) return;
    chatModalEl.classList.remove('active');
    setChatTyping(false);
    syncBodyScrollLock();
  }

  function sendChatMessage(text) {
    const clean = (text || '').trim();
    if (!clean) return;
    state.chatMessages.push({ from: 'me', text: clean, time: chatTimeNow() });
    renderChatMessages();
    if (chatInput) chatInput.value = '';
    if (chatSendBtn) chatSendBtn.disabled = true;

    // Carlos escribe un momento antes de responder
    setChatTyping(true);
    setTimeout(() => {
      const reply = CHAT_REPLIES[state.chatReplyIndex % CHAT_REPLIES.length];
      state.chatReplyIndex += 1;
      state.chatMessages.push({ from: 'shopper', text: reply, time: chatTimeNow() });
      setChatTyping(false);
      renderChatMessages();
    }, 1300);
  }

  // Deja bloqueado el scroll del fondo solo si sigue algún modal abierto
  function syncBodyScrollLock() {
    const anyModalOpen = !!document.querySelector('.modal-overlay.active');
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
  }

  // ==========================================================================
  // VISTA DE SEGUIMIENTO (compartida: pedido nuevo o restaurado tras recargar)
  // ==========================================================================
  function startOrderTracker(orderData, initialStatus) {
    if (!orderData || !orderData.id) return;

    if (orderTrackerModalEl) {
      orderTrackerModalEl.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    // Código real del pedido en la cabecera del modal (antes era fijo: AC-8924)
    const trackerOrderCode = document.getElementById('trackerOrderCode');
    if (trackerOrderCode) trackerOrderCode.textContent = `PEDIDO #${orderData.id} CONFIRMADO`;

    // Reset de los pasos de la trayectoria
    const stepItems = document.querySelectorAll('.tracker-step-item');
    stepItems.forEach((item, index) => {
      item.className = 'tracker-step-item';
      if (index === 0) item.classList.add('completed');
      if (index === 1) item.classList.add('current');
    });

    // Enlace de WhatsApp directo al dueño (+34 602 07 08 46)
    const waShareBtn = document.getElementById('orderWhatsAppShareBtn');
    if (waShareBtn && typeof SupabaseService !== 'undefined' && Array.isArray(orderData.items) && orderData.items.length > 0) {
      waShareBtn.href = SupabaseService.createOwnerWhatsAppLink(orderData);
    }

    // El tracker avanza SOLO cuando el shopper/admin cambia el estado del pedido desde admin.html
    // (Pedido nuevo → Aprobado/En Preparación → En Camino → Entregado)
    if (state.orderTrackerInterval) clearInterval(state.orderTrackerInterval);
    if (state.orderTrackerAnimInterval) clearInterval(state.orderTrackerAnimInterval);

    const trackerRouteFill = document.getElementById('trackerRouteFill');
    const trackerVehicle = document.getElementById('trackerVehicle');
    const trackerEtaText = document.getElementById('trackerEtaText');
    const trackerPercentBadge = document.getElementById('trackerPercentBadge');
    const trackerArrivalBubble = document.getElementById('trackerArrivalBubble');

    // Configuración visual por cada estado del pedido (alineado con los estados del panel admin)
    //
    // from/to = de dónde a dónde recorren la barra y la moto en cada tramo, y travelMs
    // el tiempo que tarda en recorrerlo. Así el avance va con el reloj y es gradual:
    // antes, al marcar "en camino", la moto saltaba de golpe hasta la casa.
    const TRACKER_STATES = {
      nuevo: {
        completedSteps: 0, currentStep: 0,
        from: { fill: 0, vehicle: 12 }, to: { fill: 12, vehicle: 18 }, travelMs: 15000,
        badge: (pct) => `Pedido recibido (${pct}%)`, badgeBg: '#FEF3C7', badgeColor: '#92400E',
        eta: 'Esperando a que el shopper apruebe tu pedido en la tienda',
        toast: '📩 Tu pedido fue recibido. El shopper debe aprobarlo desde la tienda'
      },
      preparacion: {
        completedSteps: 1, currentStep: 1,
        from: { fill: 12, vehicle: 18 }, to: { fill: 45, vehicle: 42 }, travelMs: 60000,
        badge: (pct) => `Seleccionando tus víveres (${pct}%)`, badgeBg: '#DBEAFE', badgeColor: '#1E40AF',
        eta: 'Tiempo estimado: 15 - 20 minutos',
        toast: '🛒 Tu shopper aprobó el pedido y está seleccionando tus víveres en el supermercado'
      },
      camino: {
        completedSteps: 3, currentStep: 3,
        // Se queda a media ruta acercándose poco a poco: a la casa solo llega al entregarse
        from: { fill: 45, vehicle: 42 }, to: { fill: 68, vehicle: 59 }, travelMs: 240000,
        badge: (pct) => `En camino hacia tu puerta (${pct}%)`, badgeBg: '#EDE9FE', badgeColor: '#5B21B6',
        eta: 'Tiempo estimado: 3 - 5 minutos (Repartidor a 3 cuadras)',
        toast: '🛵 Tu pedido empacó y salió de la tienda: va en camino hacia tu dirección'
      },
      entregado: {
        completedSteps: 4, currentStep: -1,
        from: { fill: 68, vehicle: 59 }, to: { fill: 100, vehicle: 82 }, travelMs: 6000,
        badge: () => '¡Entregado con Éxito! (100%)', badgeBg: '#DCFCE7', badgeColor: '#15803D',
        eta: '¡Pedido entregado en tu puerta!',
        toast: '🙋 Hola, ya estoy afuera con tu pedido'
      },
      cancelado: {
        completedSteps: 0, currentStep: 0,
        from: { fill: 0, vehicle: 12 }, to: { fill: 0, vehicle: 12 }, travelMs: 0,
        badge: () => 'Pedido cancelado', badgeBg: '#FEE2E2', badgeColor: '#B91C1C',
        eta: 'Tu pedido fue cancelado. Escríbenos por WhatsApp si tienes dudas',
        toast: '❌ Tu pedido fue cancelado. Escríbenos por WhatsApp si tienes dudas'
      }
    };

    let lastTrackerStatus = null;
    // Estado de la animación de recorrido (barra + moto) y valores pintados en pantalla
    let activeBadgeConf = null;
    let currentFill = 0;
    let currentVehicle = 12;
    let trackerAnim = null;

    // Avanza el tramo del estado actual al ritmo del reloj (lineal: velocidad constante,
    // sin tramos muertos al empezar o terminar)
    function tickTrackerProgress() {
      if (!trackerAnim) return;
      const elapsed = Date.now() - trackerAnim.startTs;
      const t = trackerAnim.travelMs > 0 ? Math.min(elapsed / trackerAnim.travelMs, 1) : 1;
      renderTrackerProgress(
        trackerAnim.fromFill + (trackerAnim.toFill - trackerAnim.fromFill) * t,
        trackerAnim.fromVehicle + (trackerAnim.toVehicle - trackerAnim.fromVehicle) * t
      );
      if (t >= 1) trackerAnim = null; // tramo completado: la moto se detiene
    }

    // Pinta barra, moto y el porcentaje del badge con los valores dados
    function renderTrackerProgress(fillPct, vehiclePct) {
      currentFill = fillPct;
      currentVehicle = vehiclePct;
      if (trackerRouteFill) trackerRouteFill.style.width = `${fillPct.toFixed(1)}%`;
      if (trackerVehicle) trackerVehicle.style.left = `${vehiclePct.toFixed(1)}%`;
      if (trackerPercentBadge && activeBadgeConf) {
        const pct = Math.round(fillPct);
        trackerPercentBadge.textContent = typeof activeBadgeConf.badge === 'function'
          ? activeBadgeConf.badge(pct)
          : activeBadgeConf.badge;
      }
    }

    function applyTrackerStatus(rawStatus) {
      const status = (rawStatus || 'nuevo').toLowerCase();
      if (status === lastTrackerStatus) return;
      const isFirstRender = lastTrackerStatus === null;
      const conf = TRACKER_STATES[status] || TRACKER_STATES.nuevo;

      // Aviso al cliente solo cuando el estado cambia de verdad (nunca en el primer render)
      if (!isFirstRender) {
        showToast(conf.toast, status === 'cancelado' ? 'normal' : 'success');
        // Al llegar el pedido a tu puerta: timbre + vibración del teléfono
        if (status === 'entregado') notifyOrderArrival();
      }
      // Pedido terminado: se limpia la sesión para no reabrirlo en la próxima carga
      // y se oculta el botón flotante de "Mi pedido en curso"
      if (isFinalOrderStatus(status)) {
        clearActiveOrderId();
        refreshActiveOrderFab();
      }

      lastTrackerStatus = status;

      // Al llegar a la puerta la moto se cambia por el repartidor saludando
      // con el aviso "Hola, ya estoy afuera con tu pedido"
      const arrived = status === 'entregado';
      if (trackerVehicle) {
        trackerVehicle.textContent = arrived ? '🙋‍♂️' : '🛵💨';
        trackerVehicle.classList.toggle('arrived', arrived);
        if (arrived) trackerVehicle.title = 'Repartidor en tu puerta';
        else trackerVehicle.removeAttribute('title');
      }
      if (trackerArrivalBubble) trackerArrivalBubble.hidden = !arrived;

      stepItems.forEach((item, idx) => {
        item.className = 'tracker-step-item';
        if (idx < conf.completedSteps) item.classList.add('completed');
        else if (idx === conf.currentStep) item.classList.add('current');
      });

      activeBadgeConf = conf;
      if (trackerPercentBadge) {
        trackerPercentBadge.style.background = conf.badgeBg;
        trackerPercentBadge.style.color = conf.badgeColor;
      }
      if (trackerEtaText) trackerEtaText.textContent = conf.eta;

      // Recorrido del tramo: al restaurar la sesión se empieza desde el origen del
      // estado; si el shopper cambia de estado a mitad de camino, se continúa desde
      // donde vaya la moto (nunca salta de golpe)
      const startFill = isFirstRender ? conf.from.fill : currentFill;
      const startVehicle = isFirstRender ? conf.from.vehicle : currentVehicle;
      trackerAnim = {
        fromFill: startFill,
        fromVehicle: startVehicle,
        toFill: conf.to.fill,
        toVehicle: conf.to.vehicle,
        startTs: Date.now(),
        travelMs: conf.travelMs
      };
      renderTrackerProgress(startFill, startVehicle);
    }

    // Consulta periódica del estado real: primero localStorage (admin.html en el mismo navegador), luego Supabase
    async function pollOrderStatus() {
      let status = null;
      try {
        const orders = JSON.parse(localStorage.getItem('alcosto_orders')) || [];
        const found = orders.find(o => String(o.id) === String(orderData.id));
        if (found && found.status) status = found.status;
      } catch (e) { /* ignora lectura local corrupta */ }

      if (typeof SupabaseService !== 'undefined') {
        const cloudStatus = await SupabaseService.fetchOrderStatusFromSupabase(orderData.id);
        if (cloudStatus) status = cloudStatus;
      }

      applyTrackerStatus(status || 'nuevo');
    }

    applyTrackerStatus(initialStatus || orderData.status || 'nuevo');
    state.orderTrackerInterval = setInterval(pollOrderStatus, 3000);

    // Recorrido gradual de barra y moto: avanza con el reloj en lugar de saltar
    tickTrackerProgress();
    state.orderTrackerAnimInterval = setInterval(tickTrackerProgress, 400);
  }

  // ==========================================================================
  // RESTAURAR EL SEGUIMIENTO AL RECARGAR / VOLVER A ENTRAR
  // ==========================================================================
  // Reabre el modal de trayectoria + chat del pedido guardado en "active_order_id",
  // de modo que la sesión de seguimiento no desaparezca al refrescar la página.
  async function restoreActiveOrderTracker() {
    try {
      const activeId = getActiveOrderId();
      if (!activeId) return;

      // 1) Pedido guardado en este navegador (caso normal: se creó en este equipo)
      let localOrder = null;
      try {
        const localOrders = JSON.parse(localStorage.getItem('alcosto_orders')) || [];
        localOrder = localOrders.find(o => String(o.id) === String(activeId)) || null;
      } catch (e) {
        localOrder = null;
      }

      if (localOrder) {
        if (isFinalOrderStatus(localOrder.status)) {
          // Pedido ya entregado o cancelado: no hay nada que seguir
          clearActiveOrderId();
          return;
        }
        startOrderTracker(localOrder, localOrder.status || 'nuevo');
        showToast(`🔄 Retomamos el seguimiento de tu pedido #${activeId}`, 'success');
        return;
      }

      // 2) Sin copia local: consultar a Supabase el estado del pedido
      if (typeof SupabaseService === 'undefined') {
        clearActiveOrderId();
        return;
      }

      const cloudStatus = await SupabaseService.fetchOrderStatusFromSupabase(activeId);

      if (cloudStatus === null) {
        // Supabase respondió y el pedido no existe → sesión obsoleta
        clearActiveOrderId();
        return;
      }

      if (isFinalOrderStatus(cloudStatus)) {
        clearActiveOrderId();
        return;
      }

      // undefined = sin conexión / error: se conserva la sesión y el tracker sigue consultando
      const resumedStatus = cloudStatus || 'nuevo';
      startOrderTracker({ id: activeId, status: resumedStatus }, resumedStatus);
      showToast(`🔄 Retomamos el seguimiento de tu pedido #${activeId}`, 'success');
    } catch (e) {
      console.warn('No se pudo restaurar el seguimiento del pedido activo:', e);
    }
  }

  // Cerrar el seguimiento: se detiene el polling pero la sesión (active_order_id)
  // se conserva, de modo que el pedido se reabre en la próxima carga de la página.
  function closeOrderTracker() {
    if (orderTrackerModalEl) {
      orderTrackerModalEl.classList.remove('active');
      syncBodyScrollLock();
    }
    if (state.orderTrackerInterval) {
      clearInterval(state.orderTrackerInterval);
    }
    if (state.orderTrackerAnimInterval) {
      clearInterval(state.orderTrackerAnimInterval);
    }
    // Al volver a la tienda queda visible el botón de "Mi pedido en curso"
    refreshActiveOrderFab();
  }

  // ==========================================================================
  // BOTÓN FLOTANTE "MI PEDIDO EN CURSO" (visible en la tienda mientras haya pedido activo)
  // ==========================================================================
  const activeOrderFabBtn = document.getElementById('activeOrderFabBtn');
  let activeOrderFabInterval = null;

  function getFabStatusLabel(status) {
    const labels = {
      nuevo: '📩 Pedido recibido',
      preparacion: '🛒 En preparación',
      camino: '🛵 En camino hacia ti',
      entregado: '✅ Entregado',
      cancelado: '❌ Cancelado'
    };
    return labels[String(status || 'nuevo').toLowerCase()] || '📩 Pedido recibido';
  }

  // Busca el estado más reciente del pedido activo (local primero, luego Supabase)
  async function getActiveOrderSnapshot() {
    const activeId = getActiveOrderId();
    if (!activeId) return { activeId: null, status: null, order: null };

    let localOrder = null;
    try {
      const localOrders = JSON.parse(localStorage.getItem('alcosto_orders')) || [];
      localOrder = localOrders.find(o => String(o.id) === String(activeId)) || null;
    } catch (e) {
      localOrder = null;
    }

    let status = (localOrder && localOrder.status) ? localOrder.status : null;

    if (typeof SupabaseService !== 'undefined') {
      const cloudStatus = await SupabaseService.fetchOrderStatusFromSupabase(activeId);
      // null = Supabase respondió y el pedido no existe → sesión obsoleta
      if (cloudStatus === null && !localOrder) {
        clearActiveOrderId();
        return { activeId: null, status: null, order: null };
      }
      if (cloudStatus) status = cloudStatus;
    }

    return { activeId, status, order: localOrder };
  }

  // Muestra u oculta el botón flotante según el pedido activo
  async function refreshActiveOrderFab() {
    if (!activeOrderFabBtn) return;

    try {
      const { activeId, status } = await getActiveOrderSnapshot();

      // Sin pedido activo o pedido terminado → el botón desaparece
      if (!activeId || (status && isFinalOrderStatus(status))) {
        if (activeId) clearActiveOrderId();
        activeOrderFabBtn.style.display = 'none';
        stopActiveOrderFabPolling();
        return;
      }

      const codeEl = document.getElementById('activeOrderFabCode');
      const statusEl = document.getElementById('activeOrderFabStatus');
      if (codeEl) codeEl.textContent = `Mi pedido #${activeId}`;
      if (statusEl) statusEl.textContent = getFabStatusLabel(status);
      activeOrderFabBtn.style.display = 'inline-flex';
      startActiveOrderFabPolling();
    } catch (e) {
      console.warn('No se pudo actualizar el botón de pedido en curso:', e);
    }
  }

  // Consulta ligera del estado mientras el cliente sigue navegando en la tienda
  function startActiveOrderFabPolling() {
    if (activeOrderFabInterval) return;
    activeOrderFabInterval = setInterval(refreshActiveOrderFab, 10000);
  }

  function stopActiveOrderFabPolling() {
    if (activeOrderFabInterval) {
      clearInterval(activeOrderFabInterval);
      activeOrderFabInterval = null;
    }
  }

  // ==========================================================================
  // BÚSQUEDA EN TIEMPO CON SUGERENCIAS (grid con debounce ligero)
  // ==========================================================================
  let searchGridRenderTimer = null;
  function handleSearchInput(e) {
    const val = e.target.value;
    state.searchQuery = val;

    if (searchClearBtnEl) {
      searchClearBtnEl.style.display = val ? 'flex' : 'none';
    }

    if (!val.trim()) {
      if (searchDropdownEl) searchDropdownEl.classList.remove('active');
      clearTimeout(searchGridRenderTimer);
      renderProducts();
      return;
    }

    const matches = PRODUCTS_DATA.filter(p =>
      (p.name || '').toLowerCase().includes(val.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(val.toLowerCase())
    ).slice(0, 5);

    if (matches.length > 0 && searchDropdownEl) {
      searchDropdownEl.innerHTML = matches.map(p => `
        <div class="suggestion-item" data-id="${p.id}">
          <img src="${p.image}" class="suggestion-thumb" alt="${p.name}">
          <div class="suggestion-details">
            <div class="suggestion-name">${p.name}</div>
            <div class="suggestion-meta">${p.unit}</div>
          </div>
          <div class="suggestion-price">$${p.price.toFixed(2)}</div>
        </div>
      `).join('');

      searchDropdownEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-id');
          searchDropdownEl.classList.remove('active');
          openProductModal(id);
        });
      });

      searchDropdownEl.classList.add('active');
    } else if (searchDropdownEl) {
      searchDropdownEl.classList.remove('active');
    }

    // Repinta el grid tras una pausa de tecleo (evita repintar en cada pulsación)
    clearTimeout(searchGridRenderTimer);
    searchGridRenderTimer = setTimeout(renderProducts, 150);
  }

  // ==========================================================================
  // WISHLIST (FAVORITOS)
  // ==========================================================================
  function toggleWishlist(productId) {
    const idx = state.wishlist.indexOf(productId);
    const prod = PRODUCTS_DATA.find(p => p.id === productId);

    if (idx > -1) {
      state.wishlist.splice(idx, 1);
      showToast(`🤍 "${prod.name}" eliminado de favoritos`);
    } else {
      state.wishlist.push(productId);
      showToast(`❤️ "${prod.name}" guardado en favoritos`, 'success');
    }

    localStorage.setItem('alcosto_wishlist', JSON.stringify(state.wishlist));
    renderProducts();
    updateWishlistBadge();
  }

  function updateWishlistBadge() {
    if (wishlistBadgeCountEl) {
      wishlistBadgeCountEl.textContent = state.wishlist.length;
    }
  }

  // ==========================================================================
  // TOASTS DE NOTIFICACIÓN
  // ==========================================================================
  function showToast(message, type = 'normal') {
    if (!toastContainerEl) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ==========================================================================
  // EVENT LISTENERS GLOBALES
  // ==========================================================================
  function setupEventListeners() {
    // Abrir/Cerrar Carrito
    if (cartHeaderBtn) cartHeaderBtn.addEventListener('click', openCartDrawer);
    if (closeCartDrawerBtn) closeCartDrawerBtn.addEventListener('click', closeCartDrawer);
    if (drawerBackdropEl) drawerBackdropEl.addEventListener('click', closeCartDrawer);

    // Dirección y Perfil de Entrega
    // (El modal "Cambiar Ruta" fue eliminado: la modalidad Delivery GPS / Retirar en Tienda
    //  ahora se elige directamente dentro del Checkout)

    // Botones para abrir Modal de Datos de Entrega
    if (closeCustomerProfileModalBtn) closeCustomerProfileModalBtn.addEventListener('click', closeCustomerProfileModal);

    // Guardar Formulario de Datos del Cliente
    if (customerProfileForm) {
      customerProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.customerProfile = {
          name: profNameInput.value.trim(),
          phone: profPhoneInput.value.trim(),
          address: profAddressInput.value.trim(),
          reference: profReferenceInput ? profReferenceInput.value.trim() : ''
        };
        localStorage.setItem('alcosto_customer_profile', JSON.stringify(state.customerProfile));
        closeCustomerProfileModal();
        showToast(`✅ Datos guardados: Entregar a ${state.customerProfile.name}`, 'success');
      });
    }

    // Quick View Modal
    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);

    // Checkout Modal
    if (checkoutProceedBtn) checkoutProceedBtn.addEventListener('click', openCheckoutModal);
    if (closeCheckoutModalBtn) closeCheckoutModalBtn.addEventListener('click', closeCheckoutModal);

    // Formulario de Pago
    if (checkoutFormEl) {
      checkoutFormEl.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validación solo en modo Delivery GPS: requiere dirección escrita o GPS capturado
        if (state.deliveryType !== 'pickup') {
          const addrInput = document.getElementById('orderAddress');
          const addrVal = addrInput ? addrInput.value.trim() : '';
          const hasGps = Boolean(state.realGpsLocation && state.realGpsLocation.lat);
          if (!addrVal && !hasGps) {
            showToast('⚠️ Escribe tu dirección de entrega o captura tu ubicación GPS para continuar', 'warning');
            if (addrInput) addrInput.focus();
            return;
          }
        }

        launchLiveOrderTracker();
      });
    }

    // Selector de métodos de pago con actualización dinámica de datos (Pago Móvil / Zelle / Binance / Efectivo)
    document.querySelectorAll('.payment-method-card[data-pay-type]').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.payment-method-card[data-pay-type]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderActivePaymentDetails();
      });
    });

    // Menú Desplegable de Cuenta de Usuario
    if (userAccountBtn && userAccountMenu) {
      userAccountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userAccountMenu.classList.toggle('active');
        userAccountBtn.setAttribute('aria-expanded', String(isOpen));
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#userAccountDropdownWrapper')) {
          userAccountMenu.classList.remove('active');
          userAccountBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Auth Modal (Login / Registro)
    function openAuthModal(mode = 'login') {
      if (userAccountMenu) userAccountMenu.classList.remove('active');
      if (authModalEl) {
        authModalEl.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      switchAuthTab(mode);
    }

    function closeAuthModal() {
      if (authModalEl) {
        authModalEl.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    function switchAuthTab(tab) {
      if (tab === 'login') {
        tabAuthLogin?.classList.add('active');
        tabAuthRegister?.classList.remove('active');
        formAuthLogin.style.display = 'block';
        formAuthRegister.style.display = 'none';
      } else {
        tabAuthRegister?.classList.add('active');
        tabAuthLogin?.classList.remove('active');
        formAuthRegister.style.display = 'block';
        formAuthLogin.style.display = 'none';
      }
    }

    if (btnOpenLoginModal) btnOpenLoginModal.onclick = () => openAuthModal('login');
    if (btnOpenRegisterModal) btnOpenRegisterModal.onclick = () => openAuthModal('register');
    if (closeAuthModalBtn) closeAuthModalBtn.onclick = closeAuthModal;
    if (tabAuthLogin) tabAuthLogin.onclick = () => switchAuthTab('login');
    if (tabAuthRegister) tabAuthRegister.onclick = () => switchAuthTab('register');

    if (btnOpenProfileFromMenu) {
      btnOpenProfileFromMenu.onclick = () => {
        if (userAccountMenu) userAccountMenu.classList.remove('active');
        openCustomerProfileModal();
      };
    }

    // Submit Iniciar Sesión
    if (formAuthLogin) {
      formAuthLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('loginIdentifier')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        const submitBtn = formAuthLogin.querySelector('button[type="submit"]');

        if (!identifier || !password) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Verificando...';
        }

        try {
          let loginSuccess = false;
          let userObj = null;

          if (typeof SupabaseService !== 'undefined') {
            const res = await SupabaseService.loginUser(identifier, password);
            if (res.success && res.user) {
              loginSuccess = true;
              userObj = res.user;
            } else if (!res.localOnly) {
              showToast(`❌ ${res.message || 'Error en autenticación'}`, 'error');
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar a Mi Cuenta';
              }
              return;
            }
          }

          if (!loginSuccess) {
            // Fallback local si Supabase no está configurado
            const namePart = identifier.split('@')[0] || identifier;
            const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
            userObj = {
              name: formattedName,
              email: identifier.includes('@') ? identifier : '',
              phone: !identifier.includes('@') ? identifier : ''
            };
          }

          state.authUser = userObj;
          localStorage.setItem('alcosto_auth_user', JSON.stringify(state.authUser));
          updateAuthUI();
          closeAuthModal();
          showToast(`👋 ¡Bienvenido de nuevo, ${state.authUser.name}!`, 'success');
        } catch (err) {
          showToast('Error al procesar el inicio de sesión', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar a Mi Cuenta';
          }
        }
      });
    }

    // Submit Crear Cuenta
    if (formAuthRegister) {
      formAuthRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('regFullName')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim();
        const phone = document.getElementById('regPhone')?.value.trim();
        const password = document.getElementById('regPassword')?.value;
        const submitBtn = formAuthRegister.querySelector('button[type="submit"]');

        if (!fullName || !password) return;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creando cuenta...';
        }

        try {
          const payload = {
            name: fullName,
            email: email,
            phone: phone,
            password: password
          };

          if (typeof SupabaseService !== 'undefined') {
            const res = await SupabaseService.registerUser(payload);
            if (!res.success && !res.localOnly) {
              showToast(`⚠️ ${res.message}`, 'error');
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Registrarme y Comenzar';
              }
              return;
            }
          }

          state.authUser = {
            name: fullName,
            email: email,
            phone: phone
          };

          // Actualizar datos del perfil de entrega
          state.customerProfile.name = fullName;
          if (phone) state.customerProfile.phone = phone;
          localStorage.setItem('alcosto_customer_profile', JSON.stringify(state.customerProfile));
          localStorage.setItem('alcosto_auth_user', JSON.stringify(state.authUser));
          
          updateAuthUI();
          closeAuthModal();
          showToast(`🎉 ¡Cuenta creada con éxito! Bienvenido, ${state.authUser.name}`, 'success');
        } catch (err) {
          showToast('Error al registrar usuario', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Registrarme y Comenzar';
          }
        }
      });
    }

    // Logout
    if (btnLogoutUser) {
      btnLogoutUser.addEventListener('click', () => {
        state.authUser = null;
        localStorage.removeItem('alcosto_auth_user');
        updateAuthUI();
        if (userAccountMenu) userAccountMenu.classList.remove('active');
        showToast('🔒 Sesión cerrada correctamente');
      });
    }

    // Alternador de Tema Claro / Oscuro (Dark Mode)
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');

    function applyTheme(theme) {
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggleIcon) {
          themeToggleIcon.className = 'fa-solid fa-sun';
          themeToggleIcon.style.color = '#F59E0B';
        }
        if (themeToggleBtn) themeToggleBtn.title = 'Cambiar a Tema Claro';
      } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeToggleIcon) {
          themeToggleIcon.className = 'fa-solid fa-moon';
          themeToggleIcon.style.color = '#4B5563';
        }
        if (themeToggleBtn) themeToggleBtn.title = 'Cambiar a Tema Oscuro';
      }
    }

    // Inicializar tema guardado o preferencia del sistema
    const savedTheme = localStorage.getItem('alcosto_theme') || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        localStorage.setItem('alcosto_theme', newTheme);
        applyTheme(newTheme);
        showToast(newTheme === 'dark' ? '🌙 Modo Oscuro activado' : '☀️ Modo Claro activado', 'normal');
      });
    }

    // Botón flotante: reabrir el seguimiento del pedido en curso desde la tienda
    if (activeOrderFabBtn) {
      activeOrderFabBtn.addEventListener('click', async () => {
        const { activeId, status, order } = await getActiveOrderSnapshot();

        if (!activeId) {
          refreshActiveOrderFab();
          return;
        }

        if (status && isFinalOrderStatus(status)) {
          clearActiveOrderId();
          refreshActiveOrderFab();
          showToast('ℹ️ Tu último pedido ya fue entregado o cancelado');
          return;
        }

        if (order) {
          startOrderTracker(order, order.status || 'nuevo');
        } else {
          const resumedStatus = status || 'nuevo';
          startOrderTracker({ id: activeId, status: resumedStatus }, resumedStatus);
        }
      });
    }

    // Order Tracker Modal
    if (closeOrderTrackerBtn) closeOrderTrackerBtn.addEventListener('click', closeOrderTracker);
    const trackerBackToShopBtn = document.getElementById('trackerBackToShopBtn');
    if (trackerBackToShopBtn) trackerBackToShopBtn.addEventListener('click', closeOrderTracker);
    if (chatWithShopperBtn) chatWithShopperBtn.addEventListener('click', openChatModal);
    if (closeChatBtn) closeChatBtn.addEventListener('click', closeChatModal);
    if (chatModalEl) {
      // Tocar fuera del cuadro de diálogo (fondo difuminado) lo cierra
      chatModalEl.addEventListener('click', (e) => {
        if (e.target === chatModalEl) closeChatModal();
      });
    }
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendChatMessage(chatInput ? chatInput.value : '');
      });
    }
    if (chatInput && chatSendBtn) {
      // El botón de enviar solo se activa si hay texto
      chatInput.addEventListener('input', () => {
        chatSendBtn.disabled = chatInput.value.trim().length === 0;
      });
    }

    // Búsqueda
    if (searchInputEl) {
      searchInputEl.addEventListener('input', handleSearchInput);
      searchInputEl.addEventListener('focus', () => {
        if (state.searchQuery.trim() && searchDropdownEl) {
          searchDropdownEl.classList.add('active');
        }
      });
    }

    if (searchClearBtnEl) {
      searchClearBtnEl.addEventListener('click', () => {
        searchInputEl.value = '';
        state.searchQuery = '';
        searchClearBtnEl.style.display = 'none';
        if (searchDropdownEl) searchDropdownEl.classList.remove('active');
        renderProducts();
      });
    }

    document.addEventListener('click', (e) => {
      if (searchDropdownEl && !e.target.closest('.search-container')) {
        searchDropdownEl.classList.remove('active');
      }
    });

    // Filtros por chips
    filterTagChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterTagChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFilterTag = chip.getAttribute('data-tag');
        renderProducts();
      });
    });

    // Ordenamiento
    if (sortSelectEl) {
      sortSelectEl.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderProducts();
      });
    }

    // Botones de propina al shopper
    tipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tipButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.shopperTipPercent = parseInt(btn.getAttribute('data-tip'), 10);
        updateCartUI();
      });
    });

    // Aplicar Cupón
    if (applyCouponBtn && couponInputEl) {
      applyCouponBtn.addEventListener('click', () => {
        const code = couponInputEl.value.trim().toUpperCase();
        if (!code) return;

        const promo = PROMOS.find(p => p.code === code);
        const { subtotal } = calculateCartTotals();

        if (!promo) {
          showToast('❌ Cupón no válido o expirado');
          return;
        }

        if (promo.minOrder && subtotal < promo.minOrder) {
          showToast(`⚠️ Este cupón requiere una compra mínima de $${promo.minOrder}`);
          return;
        }

        state.appliedCoupon = promo;
        updateCartUI();
        showToast(`🎉 ¡Cupón ${promo.code} aplicado con éxito!`, 'success');
      });
    }



    // Botón de wishlist en header (filtra productos en favoritos)
    if (wishlistHeaderBtn) {
      wishlistHeaderBtn.addEventListener('click', () => {
        if (state.wishlist.length === 0) {
          showToast('❤️ Aún no tienes productos en tu lista de favoritos');
          return;
        }
        state.activeCategory = 'todos';
        state.activeFilterTag = 'all';
        
        // Filtrar solo los productos en favoritos
        if (sectionTitleEl) sectionTitleEl.innerHTML = '❤️ Mis Productos Favoritos';
        const filtered = PRODUCTS_DATA.filter(p => state.wishlist.includes(p.id));
        if (sectionCountEl) sectionCountEl.textContent = `${filtered.length} productos`;

        // Renderizar estos favoritos
        if (productsGridEl) {
          productsGridEl.innerHTML = filtered.map(product => {
            const inCartQty = state.cart[product.id] ? state.cart[product.id].quantity : 0;
            return `
              <article class="product-card" data-product-id="${product.id}">
                <button class="btn-wishlist active" data-id="${product.id}" title="Favorito">❤️</button>
                <div class="product-image-wrap open-detail-trigger" data-id="${product.id}">
                  <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
                </div>
                <div class="product-info open-detail-trigger" data-id="${product.id}">
                  <div class="product-price-row">
                    <span class="product-current-price">$${product.price.toFixed(2)}</span>
                  </div>
                  <div class="product-unit">${product.unit}</div>
                  <h3 class="product-title">${product.name}</h3>
                </div>
                <div class="product-card-actions">
                  ${inCartQty === 0 
                    ? `<button class="btn-add-instacart" data-id="${product.id}">+ Agregar</button>` 
                    : `<div class="quantity-stepper" data-id="${product.id}">
                         <button class="stepper-btn btn-stepper-minus" data-id="${product.id}">−</button>
                         <span class="stepper-count">${inCartQty}</span>
                         <button class="stepper-btn btn-stepper-plus" data-id="${product.id}">+</button>
                       </div>`
                  }
                </div>
              </article>
            `;
          }).join('');
          bindProductCardEvents();
        }
      });
    }

    // Escuchar actualizaciones de tasas en vivo desde la API o admin
    // (el indicador de tasas del header fue retirado; solo se re-renderiza catálogo y carrito)
    window.addEventListener('alcosto:rates-updated', () => {
      renderProducts();
      updateCartUI();
    });

    // Escuchar cambios en productos en tiempo real (creados, editados o eliminados desde admin.html)
    function onProductsUpdated() {
      loadCatalogProductsFromDatabase().then(() => updateCartUI());
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'alcosto_supabase_config') {
        onProductsUpdated();
      }
    });

    window.addEventListener('alcosto:products-updated', onProductsUpdated);

    try {
      if (window.BroadcastChannel) {
        const bc = new BroadcastChannel('alcosto_sync_channel');
        bc.onmessage = (msg) => {
          if (msg.data && msg.data.type === 'products_updated') {
            onProductsUpdated();
          }
        };
      }
    } catch (e) {}

    // Interacciones de la Barra de Navegación Inferior para Teléfonos (Mobile App Bar)
    const mobileNavHome = document.getElementById('mobileNavHome');
    const mobileNavSearch = document.getElementById('mobileNavSearch');
    const mobileNavDeals = document.getElementById('mobileNavDeals');
    const mobileNavWishlist = document.getElementById('mobileNavWishlist');
    const mobileNavCart = document.getElementById('mobileNavCart');

    if (mobileNavHome) {
      mobileNavHome.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        mobileNavHome.classList.add('active');
      });
    }

    if (mobileNavSearch) {
      mobileNavSearch.addEventListener('click', () => {
        if (searchInput) {
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        mobileNavSearch.classList.add('active');
      });
    }

    if (mobileNavDeals) {
      mobileNavDeals.addEventListener('click', () => {
        // El chip real del catálogo usa data-tag="oferta" (antes nunca coincidía y el botón no filtraba)
        const promoFilter = document.querySelector('.filter-tag-chip[data-tag="oferta"]');
        if (promoFilter) {
          promoFilter.click();
        }
        const catalogSection = document.getElementById('catalogo');
        if (catalogSection) {
          catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        mobileNavDeals.classList.add('active');
      });
    }

    if (mobileNavWishlist) {
      mobileNavWishlist.addEventListener('click', () => {
        // Reutiliza la lógica del botón de favoritos del header (no existía #wishlistBtn)
        if (wishlistHeaderBtn) wishlistHeaderBtn.click();
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        mobileNavWishlist.classList.add('active');
      });
    }

    if (mobileNavCart) {
      mobileNavCart.addEventListener('click', () => {
        openCartDrawer();
      });
    }

    // ==========================================================================
    // BARRA LATERAL GLASS MÓVIL: aparece al hacer scroll y se oculta al detenerse
    // ==========================================================================
    const mobileBottomNavEl = document.getElementById('mobileBottomNav');
    if (mobileBottomNavEl) {
      let mobileNavHideTimer = null;

      const showMobileNavRail = () => {
        // Si el carrito está abierto no se muestra (el drawer cubre toda la pantalla)
        if (document.body.classList.contains('cart-drawer-open')) return;
        mobileBottomNavEl.classList.add('visible');
        if (mobileNavHideTimer) clearTimeout(mobileNavHideTimer);
        // Se oculta 2.5 segundos después del último scroll (tiempo de más para tocar un ítem)
        mobileNavHideTimer = setTimeout(() => {
          mobileBottomNavEl.classList.remove('visible');
        }, 2500);
      };

      window.addEventListener('scroll', showMobileNavRail, { passive: true });
    }

    // Tecla Escape para cerrar modales
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Si el chat está abierto, Escape lo cierra solo (sigue el seguimiento detrás)
        if (chatModalEl && chatModalEl.classList.contains('active')) {
          closeChatModal();
          return;
        }
        closeCartDrawer();
        closeProductModal();
        closeCheckoutModal();
        closeOrderTracker();
      }
    });
  }
  // Iniciar la aplicación
  init();
});
