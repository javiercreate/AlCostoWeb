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
    routeConfirmed: localStorage.getItem('alcosto_route_confirmed') === 'true',
    realGpsLocation: (function() {
      try { return JSON.parse(localStorage.getItem('alcosto_user_gps')); } catch(e) { return null; }
    })(),
    currentAddress: JSON.parse(localStorage.getItem('alcosto_address')) || PRESET_ADDRESSES[0],
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
    orderTrackerInterval: null
  };

  // --- ELEMENTOS DEL DOM ---
  const categoriesListEl = document.getElementById('categoriesPillsList');
  const deptRailIconsListEl = document.getElementById('deptRailIconsList');
  const productsGridEl = document.getElementById('productsGrid');
  const sectionTitleEl = document.getElementById('catalogSectionTitle');
  const sectionCountEl = document.getElementById('catalogSectionCount');
  const searchInputEl = document.getElementById('searchInput');
  const searchClearBtnEl = document.getElementById('searchClearBtn');
  const searchDropdownEl = document.getElementById('searchDropdown');
  const sortSelectEl = document.getElementById('sortSelect');
  const filterTagChips = document.querySelectorAll('.filter-tag-chip');

  // Header & Profile & Auth Elements
  const headerAddressLabelEl = document.getElementById('headerAddressLabel');
  const headerDeliveryTypeEl = document.getElementById('headerDeliveryType');
  const deliverySelectorBtn = document.getElementById('deliverySelectorBtn');
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

  const customerProfileBtn = document.getElementById('customerProfileBtn');
  const customerProfileBtnLabel = document.getElementById('customerProfileBtnLabel');
  const heroOpenProfileBtn = document.getElementById('heroOpenProfileBtn');
  const modalOpenProfileBtn = document.getElementById('modalOpenProfileBtn');
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
  const addressModalEl = document.getElementById('addressModal');
  const closeAddressModalBtn = document.getElementById('closeAddressModalBtn');
  const addressOptionsContainerEl = document.getElementById('addressOptionsContainer');
  const checkoutModalEl = document.getElementById('checkoutModal');
  const closeCheckoutModalBtn = document.getElementById('closeCheckoutModalBtn');
  const checkoutFormEl = document.getElementById('checkoutForm');
  const orderTrackerModalEl = document.getElementById('orderTrackerModal');
  const closeOrderTrackerBtn = document.getElementById('closeOrderTrackerBtn');
  const chatWithShopperBtn = document.getElementById('chatWithShopperBtn');
  const toastContainerEl = document.getElementById('toastContainer');

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
    renderCategoryPills();
    updateAddressUI();
    renderProducts();
    updateCartUI();
    updateWishlistBadge();
    initHeroCarousel();
    setupEventListeners();

    // Sincronizar catálogo desde Supabase si está disponible
    if (typeof SupabaseService !== 'undefined') {
      try {
        const cloudProducts = await SupabaseService.fetchProductsFromSupabase();
        if (cloudProducts && cloudProducts.length > 0) {
          PRODUCTS_DATA = cloudProducts;
          renderProducts();
        }
      } catch (e) {
        console.warn('Catálogo local activo');
      }
    }
  }

  // ==========================================================================
  // CARRUSEL HERO INTERACTIVO DE 3 PARTES (PUBLICIDAD Y PROMOS)
  // ==========================================================================
  function initHeroCarousel() {
    const track = document.getElementById('heroCarouselTrack');
    const container = document.getElementById('heroCarousel');
    const prevBtn = document.getElementById('heroPrevBtn');
    const nextBtn = document.getElementById('heroNextBtn');
    const dots = document.querySelectorAll('.hero-dot');
    const slides = document.querySelectorAll('.hero-slide');

    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    const totalSlides = slides.length;
    let autoPlayTimer = null;

    function goToSlide(index) {
      if (index < 0) {
        currentIndex = totalSlides - 1;
      } else if (index >= totalSlides) {
        currentIndex = 0;
      } else {
        currentIndex = index;
      }

      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      slides.forEach((slide, idx) => {
        slide.classList.toggle('active', idx === currentIndex);
      });

      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentIndex);
      });
    }

    function startAutoPlay() {
      stopAutoPlay();
      autoPlayTimer = setInterval(() => {
        goToSlide(currentIndex + 1);
      }, 5000);
    }

    function stopAutoPlay() {
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        goToSlide(currentIndex - 1);
        startAutoPlay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        goToSlide(currentIndex + 1);
        startAutoPlay();
      });
    }

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const target = parseInt(dot.getAttribute('data-slide-to'), 10);
        if (!isNaN(target)) {
          goToSlide(target);
          startAutoPlay();
        }
      });
    });

    if (container) {
      container.addEventListener('mouseenter', stopAutoPlay);
      container.addEventListener('mouseleave', startAutoPlay);

      // Soporte táctil / Swipe para teléfonos móviles
      let touchStartX = 0;
      let touchEndX = 0;

      container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
      }, { passive: true });

      container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) {
            goToSlide(currentIndex + 1);
          } else {
            goToSlide(currentIndex - 1);
          }
        }
        startAutoPlay();
      }, { passive: true });
    }

    // Botones de copiar cupones en los slides
    document.querySelectorAll('.hero-copy-coupon-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-coupon');
        if (code) {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(code).catch(() => {});
          }
          if (couponInputEl) couponInputEl.value = code;
          showToast(`📋 Cupón ${code} copiado`, 'success');
        }
      });
    });

    // Filtros rápidos de categoría desde cualquier banner o tarjeta
    document.querySelectorAll('[data-filter-category], .hero-filter-charcuteria-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = btn.getAttribute('data-filter-category') || 'charcuteria';
        if (cat) {
          setActiveCategory(cat);
          const target = document.getElementById('catalogo');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    startAutoPlay();
  }

  // ==========================================================================
  // CATEGORÍAS Y NAVEGACIÓN (BARRA VERTICAL SOLO ICONOS FONT AWESOME)
  // ==========================================================================
  function renderCategoryPills() {
    renderVerticalDeptRail();
    renderDepartmentsDropdown();
  }

  function renderVerticalDeptRail() {
    if (!deptRailIconsListEl) return;
    deptRailIconsListEl.innerHTML = CATEGORIES.map(cat => {
      const iconClass = cat.icon.startsWith('fa-') ? cat.icon : `fa-solid ${cat.icon}`;
      return `
        <button type="button" 
                class="dept-rail-icon-btn ${cat.id === state.activeCategory ? 'active' : ''}" 
                data-cat-id="${cat.id}" 
                data-dept-name="${cat.name}" 
                title="${cat.name}">
          <i class="${iconClass}"></i>
        </button>
      `;
    }).join('');

    deptRailIconsListEl.querySelectorAll('.dept-rail-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        setActiveCategory(catId);
        const target = document.getElementById('catalogo');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function renderDepartmentsDropdown() {
    const gridMenuEl = document.getElementById('departmentsGridMenu');
    const dropdownMenuEl = document.getElementById('departmentsDropdownMenu');
    const btnMenu = document.getElementById('btnDepartmentsMenu');
    const btnViewAll = document.getElementById('btnViewAllFromDropdown');

    if (!gridMenuEl) return;

    gridMenuEl.innerHTML = CATEGORIES.map(cat => {
      const iconClass = cat.icon.startsWith('fa-') ? cat.icon : `fa-solid ${cat.icon}`;
      return `
        <div class="dept-menu-item ${cat.id === state.activeCategory ? 'active' : ''}" data-cat-id="${cat.id}" role="menuitem">
          <span class="dept-item-icon"><i class="${iconClass}"></i></span>
          <div class="dept-item-info">
            <span class="dept-item-name">${cat.name}</span>
            <span class="dept-item-badge">${cat.badge || 'Pasillo'}</span>
          </div>
        </div>
      `;
    }).join('');

    gridMenuEl.querySelectorAll('.dept-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const catId = item.getAttribute('data-cat-id');
        setActiveCategory(catId);
        if (dropdownMenuEl) dropdownMenuEl.classList.remove('active');
        if (btnMenu) {
          btnMenu.classList.remove('active');
          btnMenu.setAttribute('aria-expanded', 'false');
        }
        const target = document.getElementById('catalogo');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    if (btnViewAll) {
      btnViewAll.onclick = (e) => {
        e.preventDefault();
        setActiveCategory('todos');
        if (dropdownMenuEl) dropdownMenuEl.classList.remove('active');
        if (btnMenu) {
          btnMenu.classList.remove('active');
          btnMenu.setAttribute('aria-expanded', 'false');
        }
        const target = document.getElementById('catalogo');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      };
    }

    if (btnMenu && !btnMenu.dataset.listenerAttached) {
      btnMenu.dataset.listenerAttached = 'true';
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenuEl.classList.toggle('active');
        btnMenu.classList.toggle('active', isOpen);
        btnMenu.setAttribute('aria-expanded', String(isOpen));
      });

      // Cerrar al hacer clic fuera
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#departmentsDropdownWrapper')) {
          if (dropdownMenuEl) dropdownMenuEl.classList.remove('active');
          btnMenu.classList.remove('active');
          btnMenu.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  function setActiveCategory(catId) {
    state.activeCategory = catId;
    state.searchQuery = '';
    if (searchInputEl) searchInputEl.value = '';
    if (searchClearBtnEl) searchClearBtnEl.style.display = 'none';

    renderCategoryPills();
    renderProducts();

    const categoryObj = CATEGORIES.find(c => c.id === catId);
    if (sectionTitleEl && categoryObj) {
      const iconClass = categoryObj.icon.startsWith('fa-') ? categoryObj.icon : `fa-solid ${categoryObj.icon}`;
      sectionTitleEl.innerHTML = `<i class="${iconClass}" style="color: #108910; margin-right: 8px;"></i> ${categoryObj.name}`;
    }
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
      if (state.activeFilterTag === 'fresco' && prod.tag !== 'fresco' && prod.category !== 'frutas-verduras') {
        return false;
      }

      // Filtro por búsqueda
      if (state.searchQuery.trim() !== '') {
        const query = state.searchQuery.toLowerCase();
        const matchName = prod.name.toLowerCase().includes(query);
        const matchDesc = prod.description.toLowerCase().includes(query);
        const matchCategory = prod.category.toLowerCase().includes(query);
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

  function renderProducts(reloadFromActive = false) {
    if ((reloadFromActive || !PRODUCTS_DATA || PRODUCTS_DATA.length === 0) && typeof getActiveProducts === 'function') {
      PRODUCTS_DATA = getActiveProducts();
    }
    const filtered = getFilteredProducts();
    
    if (sectionCountEl) {
      sectionCountEl.textContent = `${filtered.length} productos`;
    }

    if (!productsGridEl) return;

    if (filtered.length === 0) {
      productsGridEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px dashed #ccc;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 6px;">No encontramos productos que coincidan</h3>
          <p style="color: #666; font-size: 0.9rem; margin-bottom: 16px;">Prueba buscando con otros términos o seleccionando otra categoría.</p>
          <button class="btn-hero-cta" style="background: var(--color-primary); color: white;" id="resetFilterBtn">Ver todos los productos</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetFilterBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.activeCategory = 'todos';
          state.activeFilterTag = 'all';
          state.searchQuery = '';
          if (searchInputEl) searchInputEl.value = '';
          filterTagChips.forEach(chip => chip.classList.toggle('active', chip.dataset.tag === 'all'));
          renderCategoryPills();
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
      } else if (product.category === 'charcuteria' || product.category === 'frutas-verduras') {
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
            <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80'">
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
          <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-thumb">
          
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
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCartDrawer() {
    if (cartDrawerEl && drawerBackdropEl) {
      cartDrawerEl.classList.remove('active');
      drawerBackdropEl.classList.remove('active');
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
          <img src="${product.image}" alt="${product.name}">
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
  function updateAddressUI() {
    if (state.customerProfile && state.customerProfile.address && state.deliveryType === 'delivery') {
      state.currentAddress.address = state.customerProfile.address;
    }

    if (headerAddressLabelEl) {
      const displayName = state.customerProfile.name ? `${state.customerProfile.name}: ` : '';
      headerAddressLabelEl.textContent = displayName + state.currentAddress.address;
    }
    if (headerDeliveryTypeEl) {
      headerDeliveryTypeEl.textContent = state.deliveryType === 'delivery' ? 'Entrega a' : 'Recoger en';
    }
    if (customerProfileBtnLabel) {
      customerProfileBtnLabel.textContent = state.customerProfile.name ? state.customerProfile.name.split(' ')[0] : 'Mis Datos';
    }
  }

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
  // MODAL DE SELECCIÓN OBLIGATORIA DE RUTA Y UBICACIÓN GPS
  // ==========================================================================
  let pendingCheckoutAfterRoute = false;

  function openAddressModal(forCheckout = false) {
    if (!addressModalEl) return;
    pendingCheckoutAfterRoute = Boolean(forCheckout);

    const routeCardDelivery = document.getElementById('routeCardDelivery');
    const routeCardPickup = document.getElementById('routeCardPickup');
    const radioDelivery = document.getElementById('radioRouteDelivery');
    const radioPickup = document.getElementById('radioRoutePickup');
    const routeInputAddress = document.getElementById('routeInputAddress');
    const routeInputReference = document.getElementById('routeInputReference');
    const btnDetectGps = document.getElementById('btnDetectGpsLocation');
    const gpsResultBox = document.getElementById('gpsResultBox');
    const gpsCoordsDisplay = document.getElementById('gpsCoordsDisplay');
    const gpsMapLink = document.getElementById('gpsMapLink');
    const btnConfirmRoute = document.getElementById('btnConfirmRouteSelection');

    // Prellenar campos
    if (routeInputAddress) {
      routeInputAddress.value = state.customerProfile.address || '';
    }
    if (routeInputReference) {
      routeInputReference.value = state.customerProfile.reference || '';
    }

    // Si ya existe ubicación GPS guardada, mostrarla
    if (state.realGpsLocation && gpsResultBox && gpsCoordsDisplay && gpsMapLink) {
      gpsResultBox.style.display = 'block';
      gpsCoordsDisplay.textContent = `Lat: ${state.realGpsLocation.lat.toFixed(6)}, Lng: ${state.realGpsLocation.lng.toFixed(6)} (Precisión: ±${state.realGpsLocation.accuracy || 10}m)`;
      gpsMapLink.href = state.realGpsLocation.mapsUrl || `https://www.google.com/maps?q=${state.realGpsLocation.lat},${state.realGpsLocation.lng}`;
    }

    // Sincronizar selección actual
    const currentType = state.deliveryType || 'delivery';
    if (currentType === 'pickup') {
      if (routeCardPickup) routeCardPickup.classList.add('active');
      if (routeCardDelivery) routeCardDelivery.classList.remove('active');
      if (radioPickup) radioPickup.checked = true;
    } else {
      if (routeCardDelivery) routeCardDelivery.classList.add('active');
      if (routeCardPickup) routeCardPickup.classList.remove('active');
      if (radioDelivery) radioDelivery.checked = true;
    }

    // Toggle interactivo de rutas
    if (routeCardDelivery) {
      routeCardDelivery.onclick = () => {
        routeCardDelivery.classList.add('active');
        if (routeCardPickup) routeCardPickup.classList.remove('active');
        if (radioDelivery) radioDelivery.checked = true;
      };
    }
    if (routeCardPickup) {
      routeCardPickup.onclick = () => {
        routeCardPickup.classList.add('active');
        if (routeCardDelivery) routeCardDelivery.classList.remove('active');
        if (radioPickup) radioPickup.checked = true;
      };
    }

    // Botón GPS
    if (btnDetectGps) {
      btnDetectGps.onclick = (e) => {
        e.stopPropagation();
        detectLiveGpsLocation(btnDetectGps, gpsResultBox, gpsCoordsDisplay, gpsMapLink, routeInputAddress);
      };
    }

    // Confirmar ruta y ubicación (Obligatorio)
    if (btnConfirmRoute) {
      btnConfirmRoute.onclick = () => {
        const isDelivery = radioDelivery ? radioDelivery.checked : true;
        if (isDelivery) {
          const addrVal = routeInputAddress ? routeInputAddress.value.trim() : '';
          const hasGps = Boolean(state.realGpsLocation && state.realGpsLocation.lat);
          if (!addrVal && !hasGps) {
            showToast('⚠️ Por favor detecta tu ubicación GPS o escribe tu dirección para el despacho', 'warning');
            if (routeInputAddress) routeInputAddress.focus();
            return;
          }
          state.deliveryType = 'delivery';
          state.customerProfile.address = addrVal || `Ubicación GPS (${state.realGpsLocation.lat.toFixed(5)}, ${state.realGpsLocation.lng.toFixed(5)})`;
          if (routeInputReference) state.customerProfile.reference = routeInputReference.value.trim();
          localStorage.setItem('alcosto_customer_profile', JSON.stringify(state.customerProfile));
          state.currentAddress = {
            id: 'addr-delivery',
            label: 'Entrega a Domicilio con GPS',
            address: state.customerProfile.address + (state.customerProfile.reference ? ` (${state.customerProfile.reference})` : ''),
            zip: '5101',
            timeEst: '25-45 min'
          };
        } else {
          state.deliveryType = 'pickup';
          state.currentAddress = PRESET_ADDRESSES[1] || {
            id: 'addr-pickup',
            label: 'Recoger en Tienda Al Costo (Gratis)',
            address: `Sede Al Costo (Coords: ${STORE_COORDINATES})`,
            zip: '5101',
            timeEst: 'Listo en 15 min'
          };
        }

        state.routeConfirmed = true;
        localStorage.setItem('alcosto_route_confirmed', 'true');
        localStorage.setItem('alcosto_delivery_type', state.deliveryType);
        localStorage.setItem('alcosto_address', JSON.stringify(state.currentAddress));

        updateAddressUI();
        updateCartUI();
        closeAddressModal();
        showToast(`✅ Ruta fijada: ${state.currentAddress.label}`, 'success');

        if (pendingCheckoutAfterRoute) {
          pendingCheckoutAfterRoute = false;
          openCheckoutModal();
        }
      };
    }

    addressModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAddressModal() {
    if (addressModalEl) {
      addressModalEl.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ==========================================================================
  // CHECKOUT MODAL Y PROCESO DE PAGO
  // ==========================================================================
  async function openCheckoutModal() {
    const { total, itemCount } = calculateCartTotals();
    if (itemCount === 0) {
      showToast('⚠️ Agrega productos a tu carrito antes de pagar');
      return;
    }

    // VALIDACIÓN OBLIGATORIA: El usuario DEBE haber seleccionado su ruta antes de pagar
    if (!state.routeConfirmed) {
      showToast('📍 Por favor selecciona tu ruta de entrega y confirma tu ubicación antes de pagar');
      closeCartDrawer();
      openAddressModal(true);
      return;
    }

    closeCartDrawer();

    const checkoutTotalSummaryEl = document.getElementById('checkoutTotalSummary');
    if (checkoutTotalSummaryEl) {
      checkoutTotalSummaryEl.innerHTML = `
        <span style="font-size: 1.35rem; font-weight: 900; color: #108910;">$${total.toFixed(2)}</span>
        <div style="display: flex; gap: 6px; font-size: 0.78rem; font-weight: 700; margin-top: 4px;">
          <span class="badge-currency-bs">🇻🇪 ${(total * CURRENCY_RATES.BS).toFixed(2)} Bs</span>
          <span class="badge-currency-cop">🇨🇴 ${(Math.round(total * CURRENCY_RATES.COP)).toLocaleString('es-CO')} COP</span>
        </div>
      `;
    }

    // Renderizar resumen de la ruta seleccionada en el Checkout
    const checkoutRouteText = document.getElementById('checkoutRouteText');
    const checkoutGpsBadge = document.getElementById('checkoutGpsBadge');
    const checkoutGpsCoords = document.getElementById('checkoutGpsCoords');
    const checkoutGpsMapLink = document.getElementById('checkoutGpsMapLink');
    const btnRefreshCheckoutGps = document.getElementById('btnRefreshCheckoutGps');

    if (checkoutRouteText) {
      if (state.deliveryType === 'pickup') {
        checkoutRouteText.innerHTML = `
          <strong>🏪 Modalidad: Recoger en Tienda Al Costo (Gratis)</strong>
          <span style="color: #475569;">Sede Principal (Coords: ${STORE_COORDINATES}) • Listo en 15 min</span>
        `;
        if (checkoutGpsBadge) checkoutGpsBadge.style.display = 'none';
      } else {
        checkoutRouteText.innerHTML = `
          <strong>🛵 Modalidad: Delivery a Domicilio Express (25-45 min)</strong>
          <span>📍 ${state.customerProfile.address || 'Ubicación confirmada'} ${state.customerProfile.reference ? `<br><small style="color:#64748B;">Ref: ${state.customerProfile.reference}</small>` : ''}</span>
        `;
        if (state.realGpsLocation && checkoutGpsBadge && checkoutGpsCoords && checkoutGpsMapLink) {
          checkoutGpsCoords.textContent = `${state.realGpsLocation.lat.toFixed(5)}, ${state.realGpsLocation.lng.toFixed(5)} (±${state.realGpsLocation.accuracy || 10}m)`;
          checkoutGpsMapLink.href = state.realGpsLocation.mapsUrl;
          checkoutGpsBadge.style.display = 'block';
        }
      }
    }

    const btnChangeRoute = document.getElementById('btnChangeRouteInCheckout');
    if (btnChangeRoute) {
      btnChangeRoute.onclick = () => {
        closeCheckoutModal();
        openAddressModal(true);
      };
    }

    if (btnRefreshCheckoutGps) {
      btnRefreshCheckoutGps.onclick = () => {
        const orderAddressInput = document.getElementById('orderAddress');
        detectLiveGpsLocation(btnRefreshCheckoutGps, null, checkoutGpsCoords, checkoutGpsMapLink, orderAddressInput);
        if (checkoutGpsBadge) checkoutGpsBadge.style.display = 'block';
      };
    }

    // Prellenar con los datos guardados del cliente
    const nameInput = document.getElementById('orderName');
    const phoneInput = document.getElementById('orderPhone');
    const addrInput = document.getElementById('orderAddress');
    if (nameInput) {
      nameInput.value = (state.authUser && state.authUser.name) ? state.authUser.name : (state.customerProfile.name || '');
    }
    if (phoneInput) {
      phoneInput.value = (state.authUser && state.authUser.phone) ? state.authUser.phone : (state.customerProfile.phone || '');
    }
    if (addrInput) {
      if (state.deliveryType === 'pickup') {
        addrInput.value = `Recogida en Tienda Al Costo (Coords: ${STORE_COORDINATES})`;
      } else if (state.customerProfile.address) {
        addrInput.value = state.customerProfile.address + (state.customerProfile.reference ? ` (Ref: ${state.customerProfile.reference})` : '');
      }
    }

    // Cargar y mostrar datos del método de pago activo (Pago Móvil / Zelle / Binance Pay / Efectivo)
    await renderActivePaymentDetails();

    if (checkoutModalEl) {
      checkoutModalEl.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  // Renderizar detalles del método de pago activo
  async function renderActivePaymentDetails() {
    const box = document.getElementById('paymentDetailsBox');
    if (!box) return;

    const activeCard = document.querySelector('.payment-method-card.active');
    const payType = activeCard ? activeCard.getAttribute('data-pay-type') : 'pagomovil';

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
  function launchLiveOrderTracker() {
    closeCheckoutModal();

    if (orderTrackerModalEl) {
      orderTrackerModalEl.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    // Reset de los pasos
    const stepItems = document.querySelectorAll('.tracker-step-item');
    stepItems.forEach((item, index) => {
      item.className = 'tracker-step-item';
      if (index === 0) item.classList.add('completed');
      if (index === 1) item.classList.add('current');
    });

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
      gpsCoordinates: state.realGpsLocation || null,
      deliveryAddress: (state.deliveryType === 'pickup') 
        ? `Recogida en Sede Al Costo (${STORE_COORDINATES})` 
        : (addrInput ? addrInput.value.trim() : (state.customerProfile.address || 'Dirección de Entrega')),
      deliverySlot: slotInput ? slotInput.options[slotInput.selectedIndex].text : 'Hoy en 30-45 min',
      instructions: instInput ? instInput.value.trim() : '',
      paymentMethod: activePayCard ? activePayCard.querySelector('.payment-method-name').textContent.trim() : 'Tarjeta',
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
      console.error('Error guardando pedido:', e);
    }

    // Publicar pedido a Supabase si está conectado
    if (typeof SupabaseService !== 'undefined') {
      SupabaseService.sendOrderToSupabase(orderData);
    }

    // Configurar enlace de WhatsApp directo al dueño (+34 602 07 08 46)
    const waShareBtn = document.getElementById('orderWhatsAppShareBtn');
    if (waShareBtn && typeof SupabaseService !== 'undefined') {
      waShareBtn.href = SupabaseService.createOwnerWhatsAppLink(orderData);
    }

    // Vaciar el carrito ya que la orden fue creada
    state.cart = {};
    saveCart();
    renderProducts();
    updateCartUI();

    // Simular avance visual fluido de la entrega con movimiento en vivo del vehículo y barra
    if (state.orderTrackerInterval) clearInterval(state.orderTrackerInterval);
    
    const trackerRouteFill = document.getElementById('trackerRouteFill');
    const trackerVehicle = document.getElementById('trackerVehicle');
    const trackerEtaText = document.getElementById('trackerEtaText');
    const trackerPercentBadge = document.getElementById('trackerPercentBadge');

    // Estado inicial (Paso 1 completado, Paso 2 en curso)
    if (trackerRouteFill) trackerRouteFill.style.width = '25%';
    if (trackerVehicle) trackerVehicle.style.left = '25%';
    if (trackerPercentBadge) {
      trackerPercentBadge.textContent = 'En preparación (25%)';
      trackerPercentBadge.style.background = '#FEF3C7';
      trackerPercentBadge.style.color = '#92400E';
    }
    if (trackerEtaText) trackerEtaText.textContent = 'Tiempo estimado: 25 - 35 minutos';

    let currentStep = 1;
    // Transición ágil y realista cada 3.5 segundos para brindar una experiencia interactiva inmediata
    state.orderTrackerInterval = setInterval(() => {
      currentStep++;
      if (currentStep >= stepItems.length) {
        clearInterval(state.orderTrackerInterval);
        stepItems.forEach(item => {
          item.className = 'tracker-step-item completed';
        });
        if (trackerRouteFill) trackerRouteFill.style.width = '100%';
        if (trackerVehicle) trackerVehicle.style.left = '76%';
        if (trackerPercentBadge) {
          trackerPercentBadge.textContent = '¡Entregado con Éxito! (100%)';
          trackerPercentBadge.style.background = '#DCFCE7';
          trackerPercentBadge.style.color = '#15803D';
        }
        if (trackerEtaText) trackerEtaText.textContent = '¡Pedido entregado en tu puerta!';
        showToast('🎉 ¡Tu pedido de Al Costo ha llegado a tu puerta!', 'success');
      } else {
        stepItems.forEach((item, idx) => {
          if (idx < currentStep) item.className = 'tracker-step-item completed';
          else if (idx === currentStep) item.className = 'tracker-step-item current';
          else item.className = 'tracker-step-item';
        });

        if (currentStep === 2) {
          if (trackerRouteFill) trackerRouteFill.style.width = '55%';
          if (trackerVehicle) trackerVehicle.style.left = '45%';
          if (trackerPercentBadge) {
            trackerPercentBadge.textContent = 'Empacado & Saliendo (55%)';
            trackerPercentBadge.style.background = '#DBEAFE';
            trackerPercentBadge.style.color = '#1E40AF';
          }
          if (trackerEtaText) trackerEtaText.textContent = 'Tiempo estimado: 15 - 20 minutos';
          showToast('🛵 Carlos empacó tus víveres y ha salido en ruta hacia tu dirección');
        } else if (currentStep === 3) {
          if (trackerRouteFill) trackerRouteFill.style.width = '85%';
          if (trackerVehicle) trackerVehicle.style.left = '68%';
          if (trackerPercentBadge) {
            trackerPercentBadge.textContent = 'Repartidor muy cerca (85%)';
            trackerPercentBadge.style.background = '#EDE9FE';
            trackerPercentBadge.style.color = '#5B21B6';
          }
          if (trackerEtaText) trackerEtaText.textContent = 'Tiempo estimado: 3 - 5 minutos (Repartidor a 3 cuadras)';
          showToast('📍 El repartidor está a 3 cuadras de tu dirección con GPS activo');
        }
      }
    }, 3800);
  }

  function closeOrderTracker() {
    if (orderTrackerModalEl) {
      orderTrackerModalEl.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (state.orderTrackerInterval) {
      clearInterval(state.orderTrackerInterval);
    }
  }

  // ==========================================================================
  // BÚSQUEDA EN TIEMPO REAL CON SUGERENCIAS
  // ==========================================================================
  function handleSearchInput(e) {
    const val = e.target.value;
    state.searchQuery = val;

    if (searchClearBtnEl) {
      searchClearBtnEl.style.display = val ? 'flex' : 'none';
    }

    if (!val.trim()) {
      if (searchDropdownEl) searchDropdownEl.classList.remove('active');
      renderProducts();
      return;
    }

    const matches = PRODUCTS_DATA.filter(p => 
      p.name.toLowerCase().includes(val.toLowerCase()) || 
      p.category.toLowerCase().includes(val.toLowerCase())
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

    renderProducts();
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
    if (deliverySelectorBtn) deliverySelectorBtn.addEventListener('click', openAddressModal);
    if (closeAddressModalBtn) closeAddressModalBtn.addEventListener('click', closeAddressModal);

    // Botones para abrir Modal de Datos de Entrega
    if (customerProfileBtn) customerProfileBtn.addEventListener('click', openCustomerProfileModal);
    if (heroOpenProfileBtn) heroOpenProfileBtn.addEventListener('click', openCustomerProfileModal);
    if (modalOpenProfileBtn) modalOpenProfileBtn.addEventListener('click', () => {
      closeAddressModal();
      openCustomerProfileModal();
    });
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
        state.deliveryType = 'delivery';
        updateAddressUI();
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

    // Order Tracker Modal
    if (closeOrderTrackerBtn) closeOrderTrackerBtn.addEventListener('click', closeOrderTracker);
    if (chatWithShopperBtn) {
      chatWithShopperBtn.addEventListener('click', () => {
        const userMsg = prompt('Escribe un mensaje para Carlos (tu Shopper Al Costo):', 'Hola Carlos, por favor que los aguacates no estén muy blandos.');
        if (userMsg) {
          showToast('📨 Mensaje enviado a Carlos');
          setTimeout(() => {
            showToast('💬 Carlos: ¡Entendido! Seleccionaré los más firmes y frescos para ti. 👌', 'success');
          }, 2500);
        }
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

    // Copiar cupón desde el banner superior
    const copyPromoBtn = document.getElementById('copyPromoBtn');
    if (copyPromoBtn) {
      copyPromoBtn.addEventListener('click', () => {
        const code = copyPromoBtn.textContent.trim();
        if (couponInputEl) couponInputEl.value = code;
        showToast(`📋 Cupón ${code} copiado`, 'success');
        openCartDrawer();
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
        renderCategoryPills();
        
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

    // Actualizar indicador de tasas en el navbar de madera
    function updateHeaderRatesDisplay() {
      const tickerBsEl = document.getElementById('tickerBsRate');
      const tickerCopEl = document.getElementById('tickerCopRate');
      if (tickerBsEl && CURRENCY_RATES && CURRENCY_RATES.BS) {
        tickerBsEl.textContent = `${CURRENCY_RATES.BS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
      }
      if (tickerCopEl && CURRENCY_RATES && CURRENCY_RATES.COP) {
        tickerCopEl.textContent = `${Math.round(CURRENCY_RATES.COP).toLocaleString('es-CO')} COP`;
      }
    }

    // Escuchar actualizaciones de tasas en vivo desde la API o admin
    window.addEventListener('alcosto:rates-updated', () => {
      updateHeaderRatesDisplay();
      if (typeof renderProducts === 'function') renderProducts();
      if (typeof renderCart === 'function') renderCart();
    });

    // Escuchar cambios en productos en tiempo real (creados, editados o eliminados desde admin.html)
    function onProductsUpdated() {
      if (typeof getActiveProducts === 'function') {
        PRODUCTS_DATA = getActiveProducts();
      }
      renderProducts();
      renderCart();
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'alcosto_custom_products') {
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

    updateHeaderRatesDisplay();

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
        const promoFilter = document.querySelector('.filter-tag-chip[data-filter="ofertas"]');
        if (promoFilter) {
          promoFilter.click();
        }
        const productsGridEl = document.getElementById('productsGrid');
        if (productsGridEl) {
          productsGridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        mobileNavDeals.classList.add('active');
      });
    }

    if (mobileNavWishlist) {
      mobileNavWishlist.addEventListener('click', () => {
        const wishlistBtn = document.getElementById('wishlistBtn');
        if (wishlistBtn) wishlistBtn.click();
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        mobileNavWishlist.classList.add('active');
      });
    }

    if (mobileNavCart) {
      mobileNavCart.addEventListener('click', () => {
        openCartDrawer();
      });
    }

    // Tecla Escape para cerrar modales
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCartDrawer();
        closeProductModal();
        closeAddressModal();
        closeCheckoutModal();
        closeOrderTracker();
      }
    });
  }
  // Iniciar la aplicación
  init();
});
