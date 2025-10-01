function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if (summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer, menu-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (event.target !== container && event.target !== last && event.target !== first) return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if ((event.target === container || event.target === first) && event.shiftKey) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);


  if (elementToFocus) {
    elementToFocus.focus();
  }

  if (
    elementToFocus.tagName === 'INPUT' &&
    ['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
    elementToFocus.value
  ) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(':focus-visible');
} catch (e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = [
    'ARROWUP',
    'ARROWDOWN',
    'ARROWLEFT',
    'ARROWRIGHT',
    'TAB',
    'ENTER',
    'SPACE',
    'ESCAPE',
    'HOME',
    'END',
    'PAGEUP',
    'PAGEDOWN',
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if (navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener(
    'focus',
    () => {
      if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

      if (mouseClick) return;

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add('focused');
    },
    true
  );
}


function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });
    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach((button) =>
      button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    if (event.target.name === 'plus') {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.dataset.min === previousValue && event.target.name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', parseInt(value) <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', value >= max);
    }
  }
}

customElements.define('quantity-input', QuantityInput);

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return fn(...args);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
  };
}

/*
 * Shopify Common JS
 *
 */
if (typeof window.Shopify == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function (target, eventName, callback) {
  target.addEventListener
    ? target.addEventListener(eventName, callback, false)
    : target.attachEvent('on' + eventName, callback);
};

Shopify.postLink = function (path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};

  var form = document.createElement('form');
  form.setAttribute('method', method);
  form.setAttribute('action', path);

  for (var key in params) {
    var hiddenField = document.createElement('input');
    hiddenField.setAttribute('type', 'hidden');
    hiddenField.setAttribute('name', key);
    hiddenField.setAttribute('value', params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (country_domid, province_domid, options) {
  this.countryEl = document.getElementById(country_domid);
  this.provinceEl = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler, this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function () {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function () {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function (e) {
    var opt = this.countryEl.options[this.countryEl.selectedIndex];
    var raw = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = '';
    }
  },

  clearOptions: function (selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function (selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  },
};



class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach((summary) =>
      summary.addEventListener('click', this.onSummaryClick.bind(this))
    );
    this.querySelectorAll(
      'button:not(.localization-selector):not(.country-selector__close-button):not(.country-filter__reset-button)'
    ).forEach((button) => button.addEventListener('click', this.onCloseButtonClick.bind(this)));

    this.trapLinkLevel1();
    this.trapLink();
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle
      ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary'))
      : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest('.has-submenu');
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);

      if (window.matchMedia('(max-width: 990px)')) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        parentMenuElement && parentMenuElement.classList.add('submenu-open');
        !reducedMotion || reducedMotion.matches
          ? addTrapFocus()
          : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 150);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });
    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach((details) => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach((submenu) => {
      submenu.classList.remove('submenu-open');
    });
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);

    if (event instanceof KeyboardEvent) elementToFocus?.setAttribute('aria-expanded', false);
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement))
        this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);

  }

  closeAnimation(detailsElement) {
    detailsElement.classList.add('is-closing');
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        
        detailsElement.removeAttribute('open');
        detailsElement.classList.remove('is-closing'); 
        if (detailsElement.closest('details[open]')) {
          trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }
  setupTrapLinks(selector, getFocusTarget) {
    const trapLinks = this.querySelectorAll(selector);
    if (!trapLinks.length) return;
  
    trapLinks.forEach(link => {
      if (link._handleTrapLinkFocus) {
        link.removeEventListener('focus', link._handleTrapLinkFocus);
        link._handleTrapLinkFocus = null;
      }
    });
  
    trapLinks.forEach(trapLink => {
      trapLink._handleTrapLinkFocus = (event) => {
        event.preventDefault();
  
        const target = getFocusTarget(trapLink);
        if (target) target.focus();
      };
  
      trapLink.addEventListener('focus', trapLink._handleTrapLinkFocus);
    });
  }
  
  trapLink() {
    this.setupTrapLinks('.focus-trap-link', (trapLink) => {
      const submenu = trapLink.closest('.menu-drawer__inner-submenu');
      if (!submenu) return null;
      return submenu.querySelector('.menu-drawer__close-button') || submenu;
    });
  }
  
  trapLinkLevel1() {
    this.setupTrapLinks('.focus-trap-link-close', (trapLink) => {
      const headerDrawer = trapLink.closest('header-drawer');
      if (!headerDrawer) return null;
      return headerDrawer.querySelector('.header__icon--menu');
    });
  }
  
}

customElements.define('menu-drawer', MenuDrawer);
class CustomDrawer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    const content = document.createElement('div');
    while (this.firstChild) {
      content.appendChild(this.firstChild);
    }
    this.shadowRoot.appendChild(content);

    this.overlay = this.shadowRoot.querySelector('.overlay');
    this.drawer = this.shadowRoot.querySelector('.drawer');
    this.closeButton = this.shadowRoot.querySelector('.close-drawer-btn');

    this.overlay.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());
  }

  open() {
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
  }

  static get observedAttributes() {
    return ['open'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'open' && newValue !== null) {
      this.style.display = 'block';
    } else {
      this.style.display = 'none';
    }
  }
}

customElements.define('custom-drawer', CustomDrawer);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.open-drawer-btn').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const targetDrawer = document.getElementById(targetId);
      if (targetDrawer) {
        targetDrawer.open();
      }
    });
  });
});


class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
  }

  openMenuDrawer(summaryElement) {
    this.header = this.header || document.querySelector('.section-header');
    this.borderOffset =
      this.borderOffset || this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom') ? 1 : 0;
    document.documentElement.style.setProperty(
      '--header-bottom-position',
      `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`
    );
    this.header.classList.add('menu-open');
    this.mainDetailsToggle.classList.add('is-opening');

    requestAnimationFrame(() => {
      this.mainDetailsToggle.setAttribute('open', '');
      this.mainDetailsToggle.classList.add('menu-opening');
  
      setTimeout(() => {
        this.mainDetailsToggle.classList.remove('is-opening');
      }, 300); 
    });

    summaryElement.setAttribute('aria-expanded', true);
    window.addEventListener('resize', this.onResize);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove('menu-open');
    window.removeEventListener('resize', this.onResize);
  }

  onResize = () => {
    this.header &&
      document.documentElement.style.setProperty(
        '--header-bottom-position',
        `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`
      );
    document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
  };
}

customElements.define('header-drawer', HeaderDrawer);



class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener('click', this.hide.bind(this, false));
    this.handleKeyDown = this.handleKeyDown.bind(this);
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.addEventListener('keydown', this.handleKeyDown);
  }
  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(event) {
    if (event.key === 'Escape' && this.hasAttribute('open')) {
      this.hide();
    }
  }

  show(opener) {
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
  
    // Trap focus within the modal dialog
    setTimeout(() => {
      const firstFocusableElement = this.querySelector('a, input, button, [tabindex]:not([tabindex="-1"])');
      trapFocus(this, firstFocusableElement);
    },300);
    
  }
  

  hide() {
    this.setAttribute("closing", "true"),
    setTimeout(() => {
    document.body.classList.remove('overflow-hidden');
    document.body.dispatchEvent(new CustomEvent('modalClosed'));
    this.removeAttribute('open');
    this.removeAttribute("closing");
    removeTrapFocus(this.openedBy);
    },300);
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;
    button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);


// --- API Loading Functions (loadYouTubeApi, loadVimeoApi) remain the same ---

let onYouTubeApiReadyPromise = null;
function loadYouTubeApi() {
  if (!onYouTubeApiReadyPromise) {
    onYouTubeApiReadyPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      const existingCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCallback) {
          existingCallback();
        }
        resolve();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    });
  }
  return onYouTubeApiReadyPromise;
}

let vimeoApiPromise = null;
function loadVimeoApi() {
  if (!vimeoApiPromise) {
    vimeoApiPromise = new Promise((resolve) => {
      if (window.Vimeo && window.Vimeo.Player) {
        resolve();
        return;
      }
       if (!document.querySelector('script[src="https://player.vimeo.com/api/player.js"]')) {
          const tag = document.createElement('script');
          tag.src = "https://player.vimeo.com/api/player.js";
          tag.onload = resolve;
          document.head.appendChild(tag);
       } else {
         const checkVimeo = setInterval(() => {
            if (window.Vimeo && window.Vimeo.Player) {
               clearInterval(checkVimeo);
               resolve();
            }
         }, 100);
       }
    });
  }
  return vimeoApiPromise;
}


class DeferredMedia extends HTMLElement {
  static get observedAttributes() {
    return ['playing'];
  }

  constructor() {
    super();
    this.poster = this.querySelector('[id^="Deferred-Poster-"]');
    this.template = this.querySelector('template');
    this.mediaElement = null;
    this.playerController = null;
    this.mediaKind = null;
    this.boundActivate = this.activate.bind(this);
    this.visibilityObserver = null;
    this.playPauseButton = null;
    this.boundHandlePlayPauseClick = this._handlePlayPauseClick.bind(this);

    if (!this.poster || !this.template) { return; }
    this.poster.addEventListener('click', this.boundActivate);
  }

  connectedCallback() {
    if (this.hasAttribute('autoplay')) {
      this._initiateAutoplayObserver();
    }
  }

  disconnectedCallback() {
    if (this.poster) {
      this.poster.removeEventListener('click', this.boundActivate);
    }
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }
    if (this.playPauseButton) {
       this.playPauseButton.removeEventListener('click', this.boundHandlePlayPauseClick);
       this.playPauseButton = null;
    }
    this.removeAttribute('has-play-pause-button');

    if (this.playerController && typeof this.playerController.destroy === 'function') {
       try { this.playerController.destroy(); } catch(e) {}
    } else if (this.mediaKind === 'video' && this.mediaElement) {
        this.mediaElement.pause();
    } else if (this.mediaKind === 'model' && this.playerController && typeof this.playerController.pause === 'function') {
        try { this.playerController.pause(); } catch(e) {}
    }
    this._detachStateListeners();
    this.playerController = null;
    this.mediaElement = null;
  }

  activate() {
    if (this.hasAttribute('playing')) return;

    if (!this.getAttribute('loaded')) {
      this._initializeMedia().then(loaded => {
        if (loaded) {
          this._initiatePlayback();
        }
      }).catch(error => {
         console.error("DeferredMedia: Error initializing media:", error);
      });
    } else {
      this._initiatePlayback();
    }
  }

  pause() {
    if (!this.hasAttribute('playing') || (!this.mediaElement && !this.playerController)) return;

    if (this.playerController) {
      if (this.mediaKind === 'youtube' && typeof this.playerController.pauseVideo === 'function') {
        this.playerController.pauseVideo();
      } else if (this.mediaKind === 'vimeo' && typeof this.playerController.pause === 'function') {
        this.playerController.pause();
      } else if (this.mediaKind === 'model' && typeof this.playerController.pause === 'function') {
        try { this.playerController.pause(); } catch(e) {}
      }
    } else if (this.mediaKind === 'video' && this.mediaElement) {
      this.mediaElement.pause();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'playing' && this.hasAttribute('loaded')) {
      this._updatePlayPauseButtonState(newValue !== null);
      if (newValue !== null) {
        this.dispatchEvent(new CustomEvent("media:play", { bubbles: true, detail: this }));
        const group = this.getAttribute('group');
        if (group) {
          document.querySelectorAll(`deferred-media[group="${group}"], product-model[group="${group}"]`).forEach(item => {
            if (item !== this && typeof item.pause === 'function') {
              item.pause();
            }
          });
        }
      } else {
        this.dispatchEvent(new CustomEvent("media:pause", { bubbles: true, detail: this }));
      }
    }
  }

  _initiatePlayback() {
     if (!this.mediaElement && !this.playerController) {
       return;
     }

     if (this.playerController) {
        if (this.mediaKind === 'youtube' && typeof this.playerController.playVideo === 'function') {
          this.playerController.playVideo();
        } else if (this.mediaKind === 'vimeo' && typeof this.playerController.play === 'function') {
          this.playerController.play().catch(error => console.error("Vimeo play error:", error));
        } else if (this.mediaKind === 'model' && typeof this.playerController.play === 'function') {
           try { this.playerController.play(); } catch(e) {}
        }
     } else if (this.mediaKind === 'video' && this.mediaElement) {
        const playPromise = this.mediaElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name === "NotAllowedError") { this.mediaElement.controls = true; }
          });
        }
     }
  }

  async _initializeMedia(focus = false) {
    if (this.getAttribute('loaded')) return true;
    if (!this.template || !this.template.content || !this.template.content.firstElementChild) return false;

    const container = document.createElement('div');
    const elementContent = this.template.content.cloneNode(true);
    container.appendChild(elementContent);

    const mediaNode = container.querySelector('video, iframe, model-viewer');
    const playPauseButtonNode = container.querySelector('.deferred-media-control__play-pause');

    if (!mediaNode) return false;

    this.mediaElement = mediaNode;
    this.appendChild(this.mediaElement);
    this.setAttribute('loaded', true);

    if (playPauseButtonNode) {
        this.appendChild(playPauseButtonNode);
        this.playPauseButton = playPauseButtonNode;
        if (this.hasAttribute('autoplay')) {
            this.playPauseButton.addEventListener('click', this.boundHandlePlayPauseClick);
            this.setAttribute('has-play-pause-button', '');
            this._updatePlayPauseButtonState(true);
        }
    }

    const nodeName = this.mediaElement.nodeName;

    if (nodeName === 'VIDEO') {
        this.mediaKind = 'video';
        this._attachStateListeners();
    } else if (nodeName === 'IFRAME') {
        const source = this.mediaElement.getAttribute('src') || '';
        if (source.includes('youtube.com') || source.includes('youtu.be')) {
            this.mediaKind = 'youtube';
            if (!this.mediaElement.id) {
                this.mediaElement.id = `deferred-yt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            }
            try {
                await loadYouTubeApi();
                this.playerController = new YT.Player(this.mediaElement.id, {
                    events: { 'onStateChange': this._handleYouTubeStateChange.bind(this) }
                });
            } catch(error) {
                console.error("YouTube Player init error:", error);
                this.removeAttribute('loaded'); this.removeChild(this.mediaElement); return false;
            }
        } else if (source.includes('vimeo.com')) {
            this.mediaKind = 'vimeo';
             try {
                 await loadVimeoApi();
                 this.playerController = new Vimeo.Player(this.mediaElement);
                 this._attachVimeoListeners();
             } catch(error) {
                 console.error("Vimeo Player init error:", error);
                 this.removeAttribute('loaded'); this.removeChild(this.mediaElement); return false;
             }
        } else {
            this.mediaKind = 'iframe_unknown';
        }
    } else if (nodeName === 'MODEL-VIEWER') {
        this.mediaKind = 'model';
    } else {
         this.mediaKind = 'unknown';
         this.removeAttribute('loaded'); this.removeChild(this.mediaElement); return false;
    }

    if(this.poster) {
        this.poster.style.display = 'none';
        this.poster.removeEventListener('click', this.boundActivate);
    }

    if (focus && this.mediaElement && typeof this.mediaElement.focus === 'function') {
        try { this.mediaElement.focus(); } catch (e) {}
    }

    return true;
  }

  _attachStateListeners() {
      if (!this.mediaElement || this.mediaKind !== 'video') return;
      this._detachStateListeners();
      this._stateListeners = {
          play: () => this.setAttribute('playing', ''),
          pause: () => this.removeAttribute('playing'),
          ended: () => this.removeAttribute('playing')
      };
      this.mediaElement.addEventListener('play', this._stateListeners.play);
      this.mediaElement.addEventListener('pause', this._stateListeners.pause);
      this.mediaElement.addEventListener('ended', this._stateListeners.ended);
  }

  _handleYouTubeStateChange(event) {
      if (event.data === YT.PlayerState.PLAYING) {
          this.setAttribute('playing', '');
      } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.BUFFERING) {
          this.removeAttribute('playing');
      }
  }

  _attachVimeoListeners() {
      if(!this.playerController || this.mediaKind !== 'vimeo') return;
      this._detachStateListeners();
      this._stateListeners = {
          play: () => this.setAttribute('playing', ''),
          pause: () => this.removeAttribute('playing'),
          ended: () => this.removeAttribute('playing')
      };
      this.playerController.on('play', this._stateListeners.play);
      this.playerController.on('pause', this._stateListeners.pause);
      this.playerController.on('ended', this._stateListeners.ended);
  }

  _detachStateListeners() {
      const listeners = this._stateListeners;
      if (this.mediaElement && this.mediaKind === 'video' && listeners) {
          this.mediaElement.removeEventListener('play', listeners.play);
          this.mediaElement.removeEventListener('pause', listeners.pause);
          this.mediaElement.removeEventListener('ended', listeners.ended);
      }
      else if (this.playerController && this.mediaKind === 'vimeo' && listeners) {
          try {
              this.playerController.off('play', listeners.play);
              this.playerController.off('pause', listeners.pause);
              this.playerController.off('ended', listeners.ended);
          } catch(e) {}
      }
      else if (this.mediaElement && this.mediaKind === 'model' && listeners) {
           try {
               this.mediaElement.removeEventListener('shopify_model_viewer_ui_toggle_play', listeners.play);
               this.mediaElement.removeEventListener('shopify_model_viewer_ui_toggle_pause', listeners.pause);
           } catch(e) {}
      }
      this._stateListeners = null;
  }

  _initiateAutoplayObserver() {
    if (this.visibilityObserver || !('IntersectionObserver' in window)) {
      return;
    }
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    this.visibilityObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAttribute('playing') && !this.getAttribute('loaded')) {
          this.activate();
          observer.disconnect();
          this.visibilityObserver = null;
        }
      });
    }, observerOptions);
    this.visibilityObserver.observe(this);
  }

  _handlePlayPauseClick() {
    if (this.hasAttribute('playing')) {
      this.pause();
    } else {
      this.activate();
    }
  }

  _updatePlayPauseButtonState(isPlaying) {
    if (!this.playPauseButton) return;
    if (isPlaying) {
      this.playPauseButton.classList.remove('is-paused');
      this.playPauseButton.classList.add('is-playing');
      this.playPauseButton.setAttribute('aria-label', 'Pause');
    } else {
      this.playPauseButton.classList.remove('is-playing');
      this.playPauseButton.classList.add('is-paused');
      this.playPauseButton.setAttribute('aria-label', 'Play');
    }
  }
}

customElements.define('deferred-media', DeferredMedia);




class VariantSelects extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('change', this.onVariantChange);
  }
  connectedCallback() {
    this.getVariantData();
  }
  onVariantChange(event) {
    this.updateOptions();
    this.updateMasterId();
    this.updateSelectedSwatchValue(event);
    this.toggleAddButton(true, '', false);
    this.toggleStickyAddButton(true, '', false);
    this.updatePickupAvailability();
    this.removeErrorMessage();
    this.updateVariantStatuses();
    this.updateVariantText();
    this.updateSoldOutState();
    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.toggleStickyAddButton(true, '', true);
      this.setUnavailable();
    } else {
      this.updateURL();
      this.updateVariantInput();
      this.renderProductInfo();
      this.updateShareUrl();
      this.updateCarousel();
      
    }
  }

  updateCarousel() {
    const updateCarouselForElement = (element) => {
      if (element && this.currentVariant.featured_media) {
        element.updateCarouselImages(this.currentVariant.featured_media.id);
      }
    };
    const galleryCarousel = document.getElementById(`Gallery-carousel-${this.dataset.section}`);
    updateCarouselForElement(galleryCarousel);
    const quickViewContainer = document.querySelector('.product-modal-content');
    if (quickViewContainer) {
      const galleryCarouselQuickView = quickViewContainer.querySelector(`#Gallery-carousel-${this.dataset.section}`);
      updateCarouselForElement(galleryCarouselQuickView);
    }
  }
  
  updateOptions() {
    this.options = Array.from(this.querySelectorAll('select, fieldset'), (element) => {
      if (element.tagName === 'SELECT') {
        return element.value;
      }
      if (element.tagName === 'FIELDSET') {
        return Array.from(element.querySelectorAll('input')).find((radio) => radio.checked)?.value;
      }
    });
  }
  updateVariantText() {
    this.querySelectorAll('.product-form__input').forEach((item, i) => 
      item.querySelector('.form__label-value').innerHTML = this.options[i]
    );
  }
  
  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options
        .map((option, index) => {
          return this.options[index] === option;
        })
        .includes(false);
    });
  }

  updateSelectedSwatchValue({ target }) {
    const { name, value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = this.querySelector(`[data-selected-dropdown-swatch="${name}"] > .swatch`);
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }

      selectedDropdownSwatchValue.style.setProperty(
        '--swatch-focal-point',
        target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
      );
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = this.querySelector(`[data-selected-swatch-value="${name}"]`);
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  updateURL() {
    if (!this.currentVariant || this.dataset.updateUrl === 'false') return;
    window.history.replaceState({}, '', `${this.dataset.url}?variant=${this.currentVariant.id}`);
  }


  updateShareUrl() {
    const shareButton = document.getElementById(`Share-${this.dataset.section}`);
    if (!shareButton ) return;
    shareButton.setAttribute('data-url', `${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(
      `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
    );
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updateVariantStatuses() {
    const selectedOptionOneVariants = this.variantData.filter(
      (variant) => this.querySelector(':checked').value === variant.option1
    );
    const inputWrappers = [...this.querySelectorAll('.product-form__input')];
    inputWrappers.forEach((option, index) => {
      if (index === 0) return;
      const optionInputs = [...option.querySelectorAll('input[type="radio"], option')];
      const previousOptionSelected = inputWrappers[index - 1].querySelector(':checked').value;
      const availableOptionInputsValue = selectedOptionOneVariants
        .filter((variant) => variant.available && variant[`option${index}`] === previousOptionSelected)
        .map((variantOption) => variantOption[`option${index + 1}`]);
      this.setInputAvailability(optionInputs, availableOptionInputsValue);
    });
  }

  setInputAvailability(elementList, availableValuesList) {
    elementList.forEach((element) => {
      const value = element.getAttribute('value');
      const availableElement = availableValuesList.includes(value);

      if (element.tagName === 'INPUT') {
        element.classList.toggle('disabled', !availableElement);
      } else if (element.tagName === 'OPTION') {
        element.innerText = availableElement
          ? value
          : window.variantStrings.unavailable_with_option.replace('[value]', value);
        element.classList.toggle('disabled', !availableElement); 
      }
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector('pickup-availability');
   
    if (!pickUpAvailability) return;

    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  updateSoldOutState() {
    const soldOutMessageElement = document.getElementById(`sold-out-message-${this.dataset.section}`);
    const soldOutVariantNameElement = document.querySelector(`#sold-out-variant-name-${this.dataset.section}`);
    const soldOutSelectElement = document.getElementById(`ContactFormSoldout-select-${this.dataset.section}`);
    
    if (this.currentVariant && !this.currentVariant.available) {
      if (soldOutMessageElement) {
        soldOutMessageElement.classList.remove('hidden');
      }
      if (soldOutVariantNameElement) {
        soldOutVariantNameElement.textContent = this.currentVariant.title;
      }
  
      if (soldOutSelectElement) {
        const selectedVariantId = this.currentVariant.id;
        const options = soldOutSelectElement.querySelectorAll('option');
  
        options.forEach((option) => {
          const optionId = option.getAttribute('option-id');
          if (optionId == selectedVariantId) {
            option.selected = true; 
          }
        });
      }
  
    } else {
      if (soldOutMessageElement) {
        soldOutMessageElement.classList.add('hidden');
      }
      if (soldOutVariantNameElement) {
        soldOutVariantNameElement.textContent = '';
      }
    }
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm) productForm.handleErrorMessage();
  }
  renderProductInfo() {
    const requestedVariantId = this.currentVariant.id;
    const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;
    

    fetch(
      `${this.dataset.url}?variant=${requestedVariantId}&section_id=${
        this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section
      }`
    )
      .then((response) => response.text())
      .then((responseText) => {
        // prevent unnecessary ui changes from abandoned selections
        if (!this.currentVariant) {
          return;
        }
        if (this.currentVariant.id !== requestedVariantId) return;

        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const destination = document.getElementById(`price-${this.dataset.section}`);
        const source = html.getElementById(
          `price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
        );
        const skuSource = html.getElementById(
          `Sku-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
        );
        const skuDestination = document.getElementById(`Sku-${this.dataset.section}`);
        const inventorySource = html.getElementById(
          `Inventory-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
        );
        const inventoryDestination = document.getElementById(`Inventory-${this.dataset.section}`);

        const volumePricingSource = html.getElementById(
          `Volume-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
        );

        this.updateStickyImage(sectionId, html);
        this.updateStickyPrice(sectionId, html);

        const pricePerItemDestination = document.getElementById(`Price-Per-Item-${this.dataset.section}`);
        const pricePerItemSource = html.getElementById(
          `Price-Per-Item-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
        );

        const volumePricingDestination = document.getElementById(`Volume-${this.dataset.section}`);
        const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`);
        const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`);

        if (volumeNote) volumeNote.classList.remove('hidden');
        if (volumePricingDestination) volumePricingDestination.classList.remove('hidden');
        if (qtyRules) qtyRules.classList.remove('hidden');

        if (source && destination) destination.innerHTML = source.innerHTML;
        if (inventorySource && inventoryDestination) inventoryDestination.innerHTML = inventorySource.innerHTML;
        if (skuSource && skuDestination) {
          skuDestination.innerHTML = skuSource.innerHTML;
          skuDestination.classList.toggle('hidden', skuSource.classList.contains('hidden'));
        }

        if (volumePricingSource && volumePricingDestination) {
          volumePricingDestination.innerHTML = volumePricingSource.innerHTML;
        }

        if (pricePerItemSource && pricePerItemDestination) {
          pricePerItemDestination.innerHTML = pricePerItemSource.innerHTML;
          pricePerItemDestination.classList.toggle('hidden', pricePerItemSource.classList.contains('hidden'));
        }

        const price = document.getElementById(`price-${this.dataset.section}`);
        if (price) price.classList.remove('hidden');

        if (inventoryDestination) inventoryDestination.classList.toggle('hidden', inventorySource.innerText === '');

        const addButtonUpdated = html.getElementById(`ProductSubmitButton-${sectionId}`);
        this.toggleAddButton(
          addButtonUpdated ? addButtonUpdated.hasAttribute('disabled') : true,
          window.variantStrings.soldOut
        );
        const stickyAddButtonUpdated = html.getElementById(`StickyProductSubmitButton-${sectionId}`);
        this.toggleStickyAddButton(
            stickyAddButtonUpdated ? stickyAddButtonUpdated.hasAttribute('disabled') : true,
            window.variantStrings.soldOut
        );

        publish(PUB_SUB_EVENTS.variantChange, {
          data: {
            sectionId,
            html,
            variant: this.currentVariant,
          },
        });
      });
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForm = document.getElementById(`product-form-${this.dataset.section}`);
    if (!productForm) return;
    const addButton = productForm.querySelector('[name="add"]');
    const addButtonText = productForm.querySelector('[name="add"] > span');
    if (!addButton) return;

    if (disable) {
      addButton.setAttribute('disabled', 'disabled');
      if (text) addButtonText.textContent = text;
    } else {
      addButton.removeAttribute('disabled');
      addButtonText.textContent = addButton.hasAttribute('data-preorder') ? 
          window.variantStrings.preOrder : 
          window.variantStrings.addToCart;
    }

    if (!modifyClass) return;
  }
  toggleStickyAddButton(disable = true, text, modifyClass = true) {
    const stickyProductForm = document.getElementById(`sticky-atc-${this.dataset.section}`);
    if (!stickyProductForm) return;
    const stickyAddButton = stickyProductForm.querySelector('[name="add"]');
    const stickyAddButtonText = stickyAddButton.querySelector('[name="add"] > span');
  
    if (!stickyAddButton) return;
  
    if (disable) {
      stickyAddButton.setAttribute('disabled', 'disabled');
      if (text) stickyAddButtonText.textContent = text;
    } else {
      stickyAddButton.removeAttribute('disabled');
      stickyAddButtonText.textContent = stickyAddButton.hasAttribute('data-preorder') ? 
          window.variantStrings.preOrder : 
          window.variantStrings.addToCart;
    }
    if (!modifyClass) return;
  }
  
  updateStickyPrice(sectionId, html) {
    const stickyPriceSourceId = `price-${sectionId}-sticky`;
    const stickyPriceDestinationId = `price-${sectionId}-sticky`;
    
    const source = html.getElementById(stickyPriceSourceId);
    const destination = document.getElementById(stickyPriceDestinationId);
  
    if (source && destination) {
      destination.innerHTML = source.innerHTML;
      destination.classList.toggle('hidden', source.classList.contains('hidden'));
    }
    const price = document.getElementById(`price-${sectionId}-sticky`);
    if (price) {
      price.classList.remove('hidden');
    }
  }
  updateStickyImage(sectionId, html) {
    const sourceImage = html.getElementById(`image-${sectionId}-sticky`);
    const destinationImage = document.getElementById(`image-${sectionId}-sticky`);

    if (sourceImage && destinationImage) {
      destinationImage.src = sourceImage.src;
      destinationImage.srcset = sourceImage.srcset;
      destinationImage.sizes = sourceImage.sizes;
    }
  }

  setUnavailable() {
    const button = document.getElementById(`product-form-${this.dataset.section}`);
    const addButton = button.querySelector('[name="add"]');
    const addButtonText = button.querySelector('[name="add"] > span');
    const buttonSticky = document.getElementById(`sticky-atc-${this.dataset.section}`);
    const addButtonSticky = buttonSticky?.querySelector('[name="add"]');
    const addButtonTextSticky = buttonSticky?.querySelector('[name="add"] > span');
    const price = document.getElementById(`price-${this.dataset.section}`);
    const priceSticky = document.getElementById(`price-${this.dataset.section}-sticky`);
    const inventory = document.getElementById(`Inventory-${this.dataset.section}`);
    const sku = document.getElementById(`Sku-${this.dataset.section}`);
    const pricePerItem = document.getElementById(`Price-Per-Item-${this.dataset.section}`);
    const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`);
    const volumeTable = document.getElementById(`Volume-${this.dataset.section}`);
    const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`);

    if (addButton && addButtonText) {
      addButtonText.textContent = window.variantStrings.unavailable;
    }
    if (addButtonSticky && addButtonTextSticky) {
      addButtonTextSticky.textContent = window.variantStrings.unavailable;
    }
    if (price) price.classList.add('hidden');
    if (priceSticky) priceSticky.classList.add('hidden');
    if (inventory) inventory.classList.add('hidden');
    if (sku) sku.classList.add('hidden');
    if (pricePerItem) pricePerItem.classList.add('hidden');
    if (volumeNote) volumeNote.classList.add('hidden');
    if (volumeTable) volumeTable.classList.add('hidden');
    if (qtyRules) qtyRules.classList.add('hidden');
  }

  getVariantData() {
    this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }
}
customElements.define('variant-selects', VariantSelects);



class AccountIcon extends HTMLElement {
  constructor() {
    super();

    this.icon = this.querySelector('.icon');
  }

  connectedCallback() {
    document.addEventListener('storefront:signincompleted', this.handleStorefrontSignInCompleted.bind(this));
  }

  handleStorefrontSignInCompleted(event) {
    if (event?.detail?.avatar) {
      this.icon?.replaceWith(event.detail.avatar.cloneNode());
    }
  }
}

customElements.define('account-icon', AccountIcon);

var dispatchCustomEvent = function dispatchCustomEvent(eventName) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var detail = {
    detail: data
  };
  var event = new CustomEvent(eventName, data ? detail : null);
  document.dispatchEvent(event);
};

const setScrollbarWidth = () => {
  const scrollbarWidth = window.innerWidth - document.body.clientWidth;
  if (scrollbarWidth > 0) {
    document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);
  }
};
setScrollbarWidth();
window.addEventListener("resize", throttle(setScrollbarWidth));

class ResponsiveImage extends HTMLElement {
  constructor() {
    super();
    this.handleIntersection = this.handleIntersection.bind(this);
    this.onImageLoad = this.onImageLoad.bind(this);
    this.onResize = this.onResize.bind(this);

    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '10px',
      threshold: 0
    });

    this.resizeObserver = new ResizeObserver(this.onResize);
  }

  connectedCallback() {
    this.img = this.querySelector('img');
    if (this.img) {
      this.img.addEventListener('load', this.onImageLoad);
      this.img.classList.add('img-loading');

      if (this.img.hasAttribute('srcset')) {
        this.originalSrcset = this.img.getAttribute('srcset');
        this.img.removeAttribute('srcset');
        this.intersectionObserver.observe(this.img);
      }
    }
  }

  disconnectedCallback() {
    if (this.img) {
      this.img.removeEventListener('load', this.onImageLoad);
      this.intersectionObserver.unobserve(this.img);
      this.resizeObserver.unobserve(this.img);
      this.intersectionObserver.disconnect();
      this.resizeObserver.disconnect();
    }
  }

  onImageLoad() {
    this.img.classList.remove('img-loading');
    this.img.classList.add('img-loaded');
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;

        if (this.hasAttribute('data-sizes') && this.getAttribute('data-sizes') === "true") {
          this.updateSizes(img);
          this.resizeObserver.observe(img);
        }

        img.setAttribute('srcset', this.originalSrcset);
        this.intersectionObserver.unobserve(img);
      }
    });
  }

  onResize(entries) {
    entries.forEach(entry => {
      if (this.hasAttribute('data-sizes') && this.getAttribute('data-sizes') === "true") {
        this.updateSizes(entry.target);
      }
    });
  }

  updateSizes(img) {
    const width = Math.floor(img.getBoundingClientRect().width);
    img.setAttribute('sizes', `${width}px`);
  }
}

customElements.define('responsive-image', ResponsiveImage);


/**
 *  @class
 *  @function ViewportMedia
 */

if (!customElements.get('viewport-media')) {
  class ViewportMedia extends HTMLElement {
    constructor() {
      super();
      this.initObserver();
    }
  
    initObserver() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.loadContent();
              this.observer.unobserve(entry.target);
              this.observer.disconnect();
            }
          });
        }, {
          rootMargin: '200px 0px 200px 0px' 
        });
  
        this.observer.observe(this);
      } else {
        this.loadContent();
      }
    }
  
    loadContent() {
      if (!this.getAttribute('loaded')) {
        const template = this.querySelector('template');
        if (template && template.content && template.content.firstElementChild) {
          const content = document.createElement('div');
          content.appendChild(template.content.firstElementChild.cloneNode(true));
    
          this.setAttribute('loaded', true);
          const deferredElement = this.appendChild(content.querySelector('video, iframe'));
    
          if (deferredElement.nodeName === 'IFRAME') {
            const src = deferredElement.getAttribute('data-src');
            if (src) {
              deferredElement.setAttribute('src', src);
            }
            deferredElement.onload = () => this.removePlaceholder();
          }
          if (deferredElement.nodeName === 'VIDEO') {
            const isAutoplay = deferredElement.getAttribute('autoplay');
            const poster = deferredElement.getAttribute('poster');
            if (!isAutoplay && poster) {
              deferredElement.setAttribute('poster', poster);
            }
            deferredElement.onloadeddata = () => {
             
              this.removePlaceholder();
              if (isAutoplay) {
                deferredElement.muted = true; 
                deferredElement.play().catch(error => {
                  console.warn('Autoplay failed:', error);
                });
              }
              this.initVideoControls(deferredElement);
            };
            deferredElement.load();
          }
        }
      }
    }


    initVideoControls(video) {
      const playPauseButton = this.querySelector('.video-play-pause');
      const muteToggleButton = this.querySelector('.video-mute-toggle');
      const progressFilled = this.querySelector('.video-progress-filled');
      let updateProgress;
    
      // Handle Play/Pause Button
      if (playPauseButton) {
        playPauseButton.addEventListener('click', () => {
          if (video.paused) {
            video.play();
            playPauseButton.classList.remove('is-play');
            playPauseButton.classList.add('is-pause');
            updateProgress = requestAnimationFrame(updateProgressBar);
          } else {
            video.pause();
            playPauseButton.classList.remove('is-pause');
            playPauseButton.classList.add('is-play');
            cancelAnimationFrame(updateProgress);
          }
        });
    
        // Reset button state on video end
        video.addEventListener('ended', () => {
          if (playPauseButton) {
            playPauseButton.classList.remove('is-pause');
            playPauseButton.classList.add('is-play');
          }
        });
      }
    
      // Handle Mute/Unmute Button
      if (muteToggleButton) {
        muteToggleButton.addEventListener('click', () => {
          video.muted = !video.muted;
          if (video.muted) {
            muteToggleButton.classList.add('is-muted');
            muteToggleButton.classList.remove('is-unmuted');
          } else {
            muteToggleButton.classList.remove('is-muted');
            muteToggleButton.classList.add('is-unmuted');
          }
        });
      }
    
      // Handle Progress Bar
      if (progressFilled) {
        const updateProgressBar = () => {
          const percentage = (video.currentTime / video.duration) * 100 || 0;
          progressFilled.style.width = `${percentage}%`;
    
          // Continue updating while playing
          updateProgress = requestAnimationFrame(updateProgressBar);
        };
    
        video.addEventListener('timeupdate', updateProgressBar);
    
        // Reset progress on end
        video.addEventListener('ended', () => {
          cancelAnimationFrame(updateProgress);
          if (progressFilled) {
            progressFilled.style.width = '0%';
          }
        });
    
        // Start progress tracking when the video can play
        video.addEventListener('canplay', () => {
          if (progressFilled) {
            progressFilled.style.width = '0%';
          }
          if (!video.paused) updateProgress = requestAnimationFrame(updateProgressBar);
        });
      }
    }
    
    
    removePlaceholder() {
      const placeholder = this.querySelector('.video-placeholder');
      if (placeholder) {
        placeholder.style.display = 'none';
      }
    }
  }
  
  customElements.define('viewport-media', ViewportMedia);
}


/**
 *  @class
 *  @function SplideCarousel
 */


  class SplideCarousel extends HTMLElement {
    constructor() {
      super();
      this.slideInstance = null;
      this.isUserInteracting = false; // Track if user is interacting
    }

    connectedCallback() {
      if (!this.slideInstance) { 
        const splideElement = this.querySelector('.splide');
        const options = splideElement.getAttribute('data-splide');
        
        if (options) {
          try {
            const parsedOptions = JSON.parse(options);
            this.slideInstance = new Splide(splideElement, parsedOptions);
            
            this.slideInstance.on('mounted', () => {
              this.handleVideoPlayback(); 
            });
            this.slideInstance.on('moved', () => {
              this.handleVideoPlayback();
            });
            setTimeout(() => this.handleVideoPlayback(), 100);
            
            setTimeout(() => this.initializeProgressBar(), 300);
            this.fixFadeRtlBug();
            this.slideInstance.mount();
          } catch (e) {
            console.error('Failed to initialize Splide carousel:', e);
          }
        }
        this.initObserver(); 
        if (Shopify.designMode) {
          this.addShopifyEventListeners();
        }
      }
    }

    disconnectedCallback() {
      if (Shopify.designMode) {
        this.removeShopifyEventListeners();
      }
    }

    initObserver() {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.handleVideoPlayback();
            }
          });
        }, {
          rootMargin: '0px 0px -50% 0px' 
        });
        
        this.observer.observe(this);
      } else {
        this.handleVideoPlayback();
      }
    }

    handleVideoPlayback() {
      if (!this.slideInstance) return;
    
      if (this.hasAttribute('data-play-videos') && this.getAttribute('data-play-videos') === 'true') {
        return;
      }
      const slides = this.slideInstance.Components.Elements.slides;
    
      slides.forEach((slide, index) => {
        const video = slide.querySelector('.shopable-video__video');
    
        if (video && !slide.classList.contains('is-clone')) {
          const isActiveSlide = this.slideInstance.index === index;
    
          if (isActiveSlide) {
            if (video.paused) {
              video.play().catch((e) => {
                console.error('Error playing video:', e);
              });
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
          }
        } else if (video) {
          video.pause();
        }
      });
    }

    addShopifyEventListeners() {
      this.handleBlockSelect = this.handleBlockSelect.bind(this);
      this.handleBlockDeselect = this.handleBlockDeselect.bind(this);
      document.addEventListener('shopify:block:select', this.handleBlockSelect);
      document.addEventListener('shopify:block:deselect', this.handleBlockDeselect);
    }

    removeShopifyEventListeners() {
      document.removeEventListener('shopify:block:select', this.handleBlockSelect);
      document.removeEventListener('shopify:block:deselect', this.handleBlockDeselect);
    }

    handleBlockSelect(event) {
      const blockElement = event.target;
      const carouselElement = blockElement.closest('splide-carousel');
      if (carouselElement === this && this.slideInstance) {
        const index = parseInt(blockElement.getAttribute('data-splide-index'));
        if (!isNaN(index)) {
          this.slideInstance.go(index);
          this.isUserInteracting = true;
          this.slideInstance.Components.Autoplay.pause();
        }
      }
    }

    handleBlockDeselect(event) {
      const blockElement = event.target;
      const carouselElement = blockElement.closest('splide-carousel');
      if (carouselElement === this && this.slideInstance) {
        this.isUserInteracting = false;
      }
    }

    initializeProgressBar() {
      const bar = this.querySelector('.splide-carousel-progress-bar');
      if (bar && this.slideInstance) {
        const updateProgressBar = () => {
          requestAnimationFrame(() => {
            const end = this.slideInstance.Components.Controller.getEnd() + 1;
            const rate = Math.min((this.slideInstance.index + 1) / end, 1);
            bar.style.width = `${100 * rate}%`;
          });
        };

        updateProgressBar();
        this.slideInstance.on('mounted move', updateProgressBar);

        this.slideInstance.on('destroy', () => {
          this.slideInstance.off('mounted move', updateProgressBar);
        });
      }
    }

    fixFadeRtlBug() {
      if (this.getAttribute('data-fix-fade-rtl') === 'true') {
        const isRtl = () => {
          const html = document.querySelector('html');
          const dir = html && html.getAttribute('dir');
          return dir === 'rtl';
        };

        if (isRtl()) {
          this.slideInstance.on('ready', () => {
            const slides = this.querySelectorAll('.splide__slide');
            slides.forEach((slide) => {
              const transform = slide.style.transform;
              if (transform && transform.includes('-')) {
                slide.style.transform = transform.replace('-', '');
              }
            });
          });
        }
      }
    }
    
  }
  customElements.define('splide-carousel', SplideCarousel);


/**
 *  @class
 *  @function Slideshow
 */
if (!customElements.get('slide-show')) {
  class Slideshow extends HTMLElement {
    constructor() {
      super();
      this.slideInstance = null;
      this.videoStates = new Map();
      this.isUserInteracting = false;
      this.movingCursor = null; 
      this.isMouseOverSlideshow = false; 
      this.cursorUpdateRAF = null;
      this.lastMouseEvent = null;
    }

    connectedCallback() {
      this.init();
      this.initializeMovingCursor();
      if (Shopify && Shopify.designMode) {
        document.addEventListener('shopify:block:select', this.handleBlockSelect.bind(this));
        document.addEventListener('shopify:block:deselect', this.handleBlockDeselect.bind(this));
      }
    }
    disconnectedCallback(){
      if (this.cursorUpdateRAF) {
        cancelAnimationFrame(this.cursorUpdateRAF);
      }
    }

    init() {
      const options = this.getAttribute('data-splide');
      if (options) {
        const parsedOptions = JSON.parse(options);
        this.slideInstance = new Splide(this, parsedOptions);

        if (this.getAttribute('data-pagination') === 'numbers') {
          this.slideInstance.on('pagination:mounted', this.customizePagination);
        }
        this.fixFadeRtlBug();
        this.slideInstance.mount();
        this.slideInstance.on('moved', this.handleVideoPlayback.bind(this));
        this.slideInstance.on('moved', this.updateSlideCounter.bind(this));
        this.slideInstance.on('moved', this.handleFirstSlide.bind(this)); 
        this.updateSlideCounter(this.slideInstance.index);
      }
    }

    handleFirstSlide() {
      const slides = this.slideInstance.Components.Elements.slides;
      slides.forEach((slide) => {
        slide.classList.remove('first-slide');
      });
    }
    fixFadeRtlBug() {
      const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
    
      if (!isRtl) return;
    
      this.slideInstance.on('ready', () => {
        const slides = this.querySelectorAll('.splide__slide');
        slides.forEach((slide) => {
          const transform = slide.style.transform;
          if (transform?.includes('-')) {
            slide.style.transform = transform.replace('-', '');
          }
        });
      });
    }
    

    handleVideoPlayback() {
      const slides = this.slideInstance.Components.Elements.slides;
      slides.forEach((slide) => {
        const video = slide.querySelector('video');
        if (video) {
          video.muted = true;
          if (slide.classList.contains('is-active')) {
            video.play();
          } else {
            video.pause();
          }
        }
      });
    }

    updateSlideCounter(newIndex) {
      const totalSlides = this.slideInstance.length;
      const currentSlideElement = this.querySelector('.current-slide');
      const totalSlidesElement = this.querySelector('.total-slides');
      const slideCounter = this.querySelector('.slide-counter');

      if (currentSlideElement && totalSlidesElement) {
        if (slideCounter) {
          slideCounter.classList.remove('slide-counter-progress');
          void slideCounter.offsetWidth;
        }
        
        totalSlidesElement.textContent = totalSlides;
        currentSlideElement.textContent = newIndex + 1;
        
        if (slideCounter) {
          slideCounter.classList.add('slide-counter-progress');
        }
      }
    }

    customizePagination(data) {
      data.list.classList.add('splide__pagination--custom');
      data.items.forEach((item) => {
        item.button.textContent = String(item.page + 1).padStart(2, '0');
      });
    }

    initializeMovingCursor() {
      this.movingCursor = this.querySelector('.slideshow__moving-cursor');

      if (this.movingCursor) {
        this.addEventListener('mouseenter', this.handleMouseEnterSlideshow.bind(this));
        this.addEventListener('mouseleave', this.handleMouseLeaveSlideshow.bind(this));
        this.addEventListener('mousemove', this.handleMouseMoveOnSlideshow.bind(this));
        this.addEventListener('click', this.handleClickOnSlideshow.bind(this));
      }
    }
    isInteractiveElement(target) {
      if (!target || typeof target.closest !== 'function') return false;
      return target.closest('.slideshow-interactive-element, .splide__pagination, .splide__arrow');
    }

    handleMouseEnterSlideshow(event) {
      if (!this.movingCursor || (this.slideInstance && this.slideInstance.length <= 1)) return;
      this.isMouseOverSlideshow = true;
      this.lastMouseEvent = event; 

      if (this.isInteractiveElement(event.target)) {
        this.classList.remove('cursor-active'); 
        this.movingCursor.classList.remove('visible');
      } else {
        this.classList.add('cursor-active'); 
        this.movingCursor.classList.add('visible');
        this.updateMovingCursorState(); 
      }
    }

    handleMouseLeaveSlideshow() {
      this.isMouseOverSlideshow = false;
      this.lastMouseEvent = null; 
      if (this.movingCursor) {
        this.movingCursor.classList.remove('visible');
      }
      this.classList.remove('cursor-active');
      if (this.cursorUpdateRAF) {
        cancelAnimationFrame(this.cursorUpdateRAF);
      }
    }

    handleMouseMoveOnSlideshow(event) {
      this.lastMouseEvent = event;

      if (!this.isMouseOverSlideshow || !this.movingCursor || !this.slideInstance || this.slideInstance.length <= 1) {
        if (this.movingCursor) this.movingCursor.classList.remove('visible');
        this.classList.remove('cursor-active');
        return;
      }

      if (this.isInteractiveElement(event.target)) {
        this.movingCursor.classList.remove('visible');
        this.classList.remove('cursor-active'); 
        if (this.cursorUpdateRAF) {
          cancelAnimationFrame(this.cursorUpdateRAF); 
          this.cursorUpdateRAF = null;
        }
        return; 
      }

      if (!this.movingCursor.classList.contains('visible')) {
        this.movingCursor.classList.add('visible');
      }
      if (!this.classList.contains('cursor-active')) {
        this.classList.add('cursor-active');
      }
      
      if (this.cursorUpdateRAF) {
        cancelAnimationFrame(this.cursorUpdateRAF);
      }
      this.cursorUpdateRAF = requestAnimationFrame(() => {
        this.updateMovingCursorState();
      });
    }
    
    updateMovingCursorState() {
      if (!this.movingCursor || !this.isMouseOverSlideshow || !this.lastMouseEvent) return;

      const event = this.lastMouseEvent;
      const slideshowRect = this.getBoundingClientRect();
      const xRelativeToSlideshow = event.clientX - slideshowRect.left;
      const yRelativeToSlideshow = event.clientY - slideshowRect.top;

      this.movingCursor.style.left = `${xRelativeToSlideshow}px`;
      this.movingCursor.style.top = `${yRelativeToSlideshow}px`;

      const mouseXInSlideshow = xRelativeToSlideshow;
      const slideshowWidth = slideshowRect.width;

      if (mouseXInSlideshow < slideshowWidth / 2) {
        this.movingCursor.classList.add('prev-style');
        this.movingCursor.classList.remove('next-style');
      } else {
        this.movingCursor.classList.add('next-style');
        this.movingCursor.classList.remove('prev-style');
      }
    }

    handleClickOnSlideshow(event) {
      if (this.isInteractiveElement(event.target)) {
        return;
      }

      if (!this.slideInstance || this.slideInstance.length <= 1 || this.isUserInteracting) {
        return;
      }
      const rect = this.getBoundingClientRect();
      const mouseXInSlideshow = event.clientX - rect.left;
      const slideshowWidth = rect.width;

      if (mouseXInSlideshow < slideshowWidth / 2) {
        this.slideInstance.go('<'); 
      } else {
        this.slideInstance.go('>'); 
      }
    }

    handleBlockSelect(event) {
      if (!this.contains(event.target)) {
        return;
      }
      const clickedShopifyBlock = event.target; 
      const slideElement = clickedShopifyBlock.closest('.splide__slide');

      if (this.slideInstance && slideElement && this.contains(slideElement)) {
        const index = parseInt(slideElement.getAttribute('data-splide-index'));

        if (!isNaN(index)) {
          this.slideInstance.go(index);
          this.isUserInteracting = true; 
          if (this.slideInstance.Components.Autoplay && this.slideInstance.options.autoplay) { 
            this.slideInstance.Components.Autoplay.pause();
          }
        }
      }
    }

    handleBlockDeselect(event) {
      if (this.slideInstance) {
        this.isUserInteracting = false;
      }
    }

  }

  customElements.define('slide-show', Slideshow);
}

/**
 *  @class
 *  @function AsyncCarousel
 */

if (!customElements.get('async-carousel')) {
  class AsyncCarousel extends HTMLElement {
    constructor() {
      super();
      this.slideInstance = null;
      this.thumbnailInstance = null;
      this.isUserInteracting = false;
      this.thumbnails = null;
      this.currentThumbnail = null;
    }

    connectedCallback() {
      this.initCarousel();
    }

    initCarousel() {
      const mainSlider = this.querySelector('[data-slider="main"]');
      const thumbnailSlider = this.querySelector('[data-slider="thumbnail"]');

      if (mainSlider) {
        const mainOptions = JSON.parse(mainSlider.getAttribute('data-splide') || '{}');
        this.slideInstance = new Splide(mainSlider, mainOptions);
        
        if (thumbnailSlider) {
          const thumbnailOptions = JSON.parse(thumbnailSlider.getAttribute('data-splide') || '{}');
          this.thumbnailInstance = new Splide(thumbnailSlider, thumbnailOptions);
          this.slideInstance.sync(this.thumbnailInstance);
          this.updateThumbnailARIA(thumbnailSlider);
        }
        this.fixFadeRtlBug();
        this.slideInstance.mount();
        if (this.thumbnailInstance) {
          this.thumbnailInstance.mount();
        }
        
        setTimeout(() => this.initializeProgressBar(), 300);
        this.initThumbnails();
        this.addShopifyEventListeners();
      }
    }

    disconnectedCallback() {
      if (Shopify.designMode) {
        this.removeShopifyEventListeners();
      }
    }

    addShopifyEventListeners() {
      if (Shopify.designMode) {
        document.addEventListener('shopify:block:select', this.handleBlockSelect.bind(this));
        document.addEventListener('shopify:block:deselect', this.handleBlockDeselect.bind(this));
      }
    }

    removeShopifyEventListeners() {
      document.removeEventListener('shopify:block:select', this.handleBlockSelect.bind(this));
      document.removeEventListener('shopify:block:deselect', this.handleBlockDeselect.bind(this));
    }

    handleBlockSelect(event) {
      const blockElement = event.target;
      const index = parseInt(blockElement.getAttribute('data-splide-index'));

      if (!isNaN(index) && this.slideInstance) {
        this.slideInstance.go(index);
        this.isUserInteracting = true;
        this.slideInstance.Components.Autoplay.pause();
      }
    }

    handleBlockDeselect() {
      this.isUserInteracting = false;
    }

    initThumbnails() {
      this.thumbnails = this.querySelectorAll('.thumbnail-item');
      this.thumbnails.forEach((thumbnail, index) => {
        thumbnail.addEventListener('click', () => {
          this.slideInstance.go(index);
        });
      });

      this.slideInstance.on('mounted move', () => {
        const thumbnail = this.thumbnails[this.slideInstance.index];
        if (thumbnail) {
          if (this.currentThumbnail) {
            this.currentThumbnail.classList.remove('is-active');
          }
          thumbnail.classList.add('is-active');
          this.currentThumbnail = thumbnail;
        }
      });
    }

    initializeProgressBar() {
      const bar = this.querySelector('.splide-carousel-progress-bar');
      if (bar && this.slideInstance) {
        const updateProgressBar = () => {
          const end = this.slideInstance.Components.Controller.getEnd() + 1;
          const rate = Math.min((this.slideInstance.index + 1) / end, 1);
          bar.style.width = `${100 * rate}%`;
        };

        updateProgressBar();
        this.slideInstance.on('mounted move', updateProgressBar);
      }
    }
    fixFadeRtlBug() {
      if (this.getAttribute('data-fix-fade-rtl') === 'true') {
        const isRtl = () => {
          const html = document.querySelector('html');
          const dir = html && html.getAttribute('dir');
          return dir === 'rtl';
        };

        if (isRtl()) {
          this.slideInstance.on('ready', () => {
            const slides = this.querySelector('[data-slider="main"]').querySelectorAll('.splide__slide');
            slides.forEach((slide) => {
              const transform = slide.style.transform;
              if (transform && transform.includes('-')) {
                slide.style.transform = transform.replace('-', '');
              }
            });
          });
        }
      }
    }

    updateThumbnailARIA(thumbnailSlider) {
      const thumbnailItems = thumbnailSlider.querySelectorAll('.splide__slide');
      thumbnailItems.forEach(thumbnailItem => {
        thumbnailItem.setAttribute('role', 'group');
      });
    }
    
  }

  customElements.define('async-carousel', AsyncCarousel);
}


/**
 *  @class
 *  @function GalleryCarousel
 */

if (!customElements.get('gallery-carousel')) {
  class GalleryCarousel extends HTMLElement {
    constructor() {
      super();
      this.main = null;
      this.thumbnails = null;
      this.shouldAutoplay = false;
      this.originalSlides = [];
      this.originalThumbnails = [];
    }

    connectedCallback() {
      const mainCarousel = this.querySelector('[id^="Main-Carousel"]');
      const thumbnailCarousel = this.querySelector('[id^="Thumbnail-Carousel"]');

      if (!mainCarousel || !thumbnailCarousel) {
        console.error('Main or thumbnail carousel element not found.');
        return;
      }

      this.originalSlides = [...mainCarousel.querySelectorAll('.splide__slide')];
      this.originalThumbnails = [...thumbnailCarousel.querySelectorAll('.splide__slide')];

      this.shouldAutoplay = this.getAttribute('data-autoplay') === 'true';
      mainCarousel.classList.add('is-initializing');

      const mainOptions = this.getCarouselOptions(mainCarousel);
      const thumbnailOptions = this.getCarouselOptions(thumbnailCarousel);
      const initialSlideIndex = this.getInitialSlideIndex();

      mainOptions.start = initialSlideIndex;
      thumbnailOptions.start = initialSlideIndex;

      this.initializeCarousels(mainCarousel, mainOptions, thumbnailCarousel, thumbnailOptions);

      // Filtering media by variant or alt image
      const enableFiltering = this.dataset.mediaGrouping === "true";
      if (enableFiltering) {
        const defaultFilter = this.dataset.filterSelected;
        this.filterSlides(defaultFilter);

        document.querySelectorAll(".variant-picker__color input[type='radio']").forEach((radio) => {
          radio.addEventListener("change", () => this.filterSlides(radio.value));
        });
      }
    }

    getCarouselOptions(carouselElement) {
      return JSON.parse(carouselElement.getAttribute('data-splide') || '{}');
    }

    getInitialSlideIndex() {
      const selectedThumbnailSlide = this.querySelector('.thumbnail-carousel .splide__slide[data-selected="true"]');

      if (selectedThumbnailSlide) {
        const thumbnailSlides = Array.from(this.querySelectorAll('.thumbnail-carousel .splide__slide'));
        return thumbnailSlides.indexOf(selectedThumbnailSlide);
      }
      return 0;
    }

    initializeCarousels(mainCarousel, mainOptions, thumbnailCarousel, thumbnailOptions) {
      this.main = new Splide(mainCarousel, mainOptions);
      this.thumbnails = new Splide(thumbnailCarousel, thumbnailOptions);
      const isVerticalThumbnail = thumbnailCarousel.getAttribute('data-thumbnail') === 'vertical';

      if (isVerticalThumbnail) {
        this.thumbnails.on('mounted', () => {
          const thumbnailList = thumbnailCarousel.querySelector('.splide__list');
          if (thumbnailList) {
            thumbnailList.setAttribute('role', 'tablist');
          }
        });
        this.thumbnails.on('mounted', this.updateThumbnailARIA.bind(this));
      }
      
      this.main.on('mounted', () => {
        mainCarousel.classList.remove('is-initializing');
    
        if (this.main.index !== undefined) {
            this.updateSlideCounter(this.main.index);
        }
      });

      this.main.on('active', this.handleMainActiveSlide.bind(this));

      this.main.on('move', (newIndex, prevIndex) => {
        if (typeof prevIndex !== 'undefined' && prevIndex !== null) {
          const prevSlide = this.main.Components.Elements.slides[prevIndex];
          if (prevSlide) {
            this.pauseMediaInSlide(prevSlide);
          }
        }
      });

      this.thumbnails.mount();
      this.main.sync(this.thumbnails);
      this.main.mount();

      this.main.on('moved', this.updateSlideCounter.bind(this));
      this.updateSlideCounter(this.main.index);
    }


    pauseMediaInSlide(slideElement) {
      if (!slideElement) return;
      const mediaElements = slideElement.querySelectorAll(
        'deferred-media, product-model, video, iframe'
      );
      mediaElements.forEach(media => {
        if (typeof media.pause === 'function') {
          media.pause();
        } else if (media.nodeName === 'VIDEO') {
          media.pause();
        } else if (media.nodeName === 'IFRAME') {
          if (media.classList.contains('js-youtube')) {
            media.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          } else if (media.classList.contains('js-vimeo')) {
            media.contentWindow.postMessage('{"method":"pause"}', '*');
          }
        }
      });
    }
    updateSlideCounter(newIndex) {
      const totalSlides = this.main.length;
      const currentSlideElement = this.querySelector('.current-slide');
      const totalSlidesElement = this.querySelector('.total-slides');

      if (currentSlideElement && totalSlidesElement) {
        totalSlidesElement.textContent = totalSlides;
        currentSlideElement.textContent = newIndex + 1;
      }
    }


    handleMainActiveSlide(newSlide) {
      const activeSlideElement = newSlide.slide;

      const hasProductModel = activeSlideElement.querySelector('product-model') !== null;
      if (this.main && this.main.Components && this.main.Components.Drag) {
        this.main.Components.Drag.disable(hasProductModel);
      }

      const mediaComponent = activeSlideElement.querySelector('deferred-media, product-model');

      if (mediaComponent) {
        if (this.shouldAutoplay) {
          if (typeof mediaComponent.activate === 'function') {
            mediaComponent.activate();
          } else if (typeof mediaComponent.play === 'function') {
            mediaComponent.play();
          }
        } else {
          if (typeof mediaComponent.pause === 'function') {
            mediaComponent.pause();
          }
        }
      }
      this.handleActiveSlide(activeSlideElement);
    }


    handleActiveSlide(slideElement) {
      if (slideElement && !slideElement.dataset.played && this.shouldAutoplay) {
         slideElement.dataset.played = true;
      }
    }


    updateCarouselImages(mediaId) {
      if (!this.main) {
        return;
      }
      const mainSlides = this.main.Components.Elements.slides;
      const targetSlide = mainSlides.find(slide => slide.getAttribute('data-media-id') === mediaId.toString());

      if (targetSlide) {
          const targetIndex = mainSlides.indexOf(targetSlide);
          if (targetIndex !== -1) {
              this.main.go(targetIndex, { transition: false });
          }
      }
      if (this.hasAttribute('desktop-grid') && window.innerWidth >= 768) {
        const galleryListsContainer = this.querySelector('.splide__gallery');
        if (galleryListsContainer) {
          const slides = galleryListsContainer.querySelectorAll('.splide__slide');
          
          const slideToMove = Array.from(slides).find(item => item.getAttribute('data-media-id') === mediaId.toString());
      
          if (slideToMove) {
            slides.forEach(slide => {
              if (slide !== slideToMove) {
                slide.classList.remove('splide__slide--current-variant');
              }
            });
            slideToMove.classList.add('splide__slide--current-variant');
      
            if (galleryListsContainer.firstElementChild !== slideToMove) {
              galleryListsContainer.insertBefore(slideToMove, galleryListsContainer.firstElementChild);
      
              const headerElem = document.querySelector('.header');
              const headerOffset = headerElem ? headerElem.offsetHeight + 16 : 16;
              const elementPosition = slideToMove.getBoundingClientRect().top + window.pageYOffset;
              const offsetPosition = elementPosition - headerOffset;
      
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
              });
            }
          }
        }
      }
      
    }

    updateThumbnailARIA() {
      if (!this.thumbnails || !this.thumbnails.Components || !this.thumbnails.Components.Elements.list) return;
      const thumbnailItems = this.thumbnails.Components.Elements.list.querySelectorAll('.splide__slide');

      thumbnailItems.forEach((thumbnailItem) => {
        thumbnailItem.setAttribute('role', 'tab');
      });
    }

    filterSlides(group) {
      let mainList = this.main.Components.Elements.list;
      let thumbList = this.thumbnails.Components.Elements.list;
    
      if (!mainList || !thumbList) {
        console.error('Splide list element not found for main or thumbnails.');
        return;
      }
    
      mainList.innerHTML = "";
      thumbList.innerHTML = "";
    
      let slidesToShow = this.originalSlides;
      let thumbsToShow = this.originalThumbnails;
    
      if (group && group.trim() !== "") {
        let filteredSlides = this.originalSlides.filter(slide => slide.dataset.mediaGroup === group);
        let filteredThumbs = this.originalThumbnails.filter(slide => slide.dataset.mediaGroup === group);
    
        if (filteredSlides.length > 0 && filteredThumbs.length > 0) {
            slidesToShow = filteredSlides;
            thumbsToShow = filteredThumbs;
        }
        
      }

      this.updateArrowVisibility(thumbsToShow.length);

      slidesToShow.forEach(slide => mainList.appendChild(slide));
      thumbsToShow.forEach(slide => thumbList.appendChild(slide));
    
      try {
          this.main.refresh();
          this.thumbnails.refresh();
    
          if (slidesToShow.length > 0) {
              this.main.go(0);
              this.thumbnails.go(0);
              this.updateSlideCounter(0); 
          } else {
              this.updateSlideCounter(-1); 
              console.warn("No slides to display in the carousel after filtering.");
          }
      } catch (error) {
          console.error("Error refreshing Splide instances:", error);
      }
    
      this.querySelectorAll('responsive-image').forEach(img => {
        if (img.img && img.intersectionObserver && img.img instanceof Element) {
          img.intersectionObserver.observe(img.img);
        }
      });
    
      // Update ARIA attributes for accessibility on the thumbnails
      this.updateThumbnailARIA();
    }

    updateArrowVisibility(slideCount) {
      const arrows = this.querySelectorAll('.splide__arrows-thumbnail');
      const shouldShow = slideCount > 5;
    
      arrows.forEach(arrow => {
        if (shouldShow) {
          arrow.classList.remove('hidden');
        } else {
          arrow.classList.add('hidden');
        }
      });
    }
    
  }

  customElements.define('gallery-carousel', GalleryCarousel);
}


/**
 *  @class
 *  @function ProductRecommendations
 */
if (!customElements.get('product-recommendations')) {
  class ProductRecommendations extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.dataset.url ? this.loadRecommendations() : console.error('No data-url attribute found.');
    }

    async loadRecommendations() {
      try {
        const response = await fetch(this.dataset.url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const recommendations = doc.querySelector('product-recommendations');
        
        if (recommendations && recommendations.innerHTML.trim()) {
          this.renderRecommendations(recommendations.innerHTML);
        } else {
          console.warn('No product recommendations found.');
        }

      } catch (error) {
        console.error('Error fetching product recommendations:', error);
      }
    }

    renderRecommendations(html) {
      this.innerHTML = html;
      this.initCarousels();
      this.classList.add('product-recommendations--loaded');
    }

    initCarousels() {
      const carousels = this.querySelectorAll('splide-carousel');
      carousels.forEach(carousel => carousel.connectedCallback?.());
    }
  }

  customElements.define('product-recommendations', ProductRecommendations);
}



class ComponentDrawer extends HTMLElement {
  constructor() {
    super();

    this.overlay = this.querySelector('.drawer-overlay');
    this.drawer = this.querySelector('.drawer-content');
    this.closeButton = this.querySelector('.close-drawer-btn');
    this.triggerButton = null;

    this.overlay.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.trapFocus = this.trapFocus.bind(this);
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'dialog');
    }
    document.addEventListener('keydown', this.handleKeyPress);
  }
  
  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleKeyPress);
    document.removeEventListener('focus', this.trapFocus, true);
  }

  open(triggerButton) {
    this.triggerButton = triggerButton; 
    this.setAttribute('open', '');
    document.body.classList.add('overflow-hidden');
    this.drawer.setAttribute('aria-hidden', 'false');
    this.closeButton.focus();
    document.addEventListener('focus', this.trapFocus, true);
  }

  close() {
    this.removeAttribute('open');
    document.body.classList.remove('overflow-hidden');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.removeEventListener('focus', this.trapFocus, true);
  
    if (this.triggerButton) {
      this.triggerButton.focus();
      this.triggerButton = null;
    }
  }

  handleKeyPress(event) {
    if (event.key === 'Escape') {
      this.close();
    }
  }
  
  trapFocus(event) {
    if (!this.contains(event.target)) {
      event.stopPropagation();
      this.closeButton.focus();
    }
  }

  static get observedAttributes() {
    return ['open'];
  }
}

customElements.define('component-drawer', ComponentDrawer);

class SearchDrawer extends ComponentDrawer {
  constructor() {
    super();
    this.predictiveSearch = this.querySelector('predictive-search');
    this.openTransitionEndHandler = this.openTransitionEndHandler.bind(this);
  }

  open(triggerButton) {
    this.triggerButton = triggerButton; 
    this.setAttribute('open', '');
    document.body.classList.add('overflow-hidden');
    this.drawer.setAttribute('aria-hidden', 'false');
    this.addEventListener('transitionend', this.openTransitionEndHandler);
    document.addEventListener('focus', this.trapFocus, true);
  }

  openTransitionEndHandler(event) {
    if (event.target === this.overlay) {
      this.removeEventListener('transitionend', this.openTransitionEndHandler);

      if (this.predictiveSearch) {
        setTimeout(() => {
          const focusElement = this.predictiveSearch.querySelector('input:not([type="hidden"])');
          if (focusElement && typeof focusElement.focus === 'function') {
            focusElement.focus();
          }
        }, 150);
      }
    }
  }

  close() {
    if (this.predictiveSearch) {
      const inputElement = this.predictiveSearch.querySelector('input:not([type="hidden"])');
      if (inputElement) {
        inputElement.value = '';
      }
      if (this.predictiveSearch.hasAttribute('open')) {
        this.predictiveSearch.removeAttribute('open');
      }
      this.predictiveSearch.setAttribute('results', 'false');
    }

    super.close();
  }
}


customElements.define('search-drawer', SearchDrawer);

class DrawerButton extends HTMLElement {
  constructor() {
    super();
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  connectedCallback() {
    this.targetId = this.getAttribute('data-target');
    this.targetDrawer = document.getElementById(this.targetId);
    
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'button');
    
    if (this.targetDrawer) {
      this.addEventListener('click', this.handleClick);
      this.addEventListener('keydown', this.handleKeyPress);
    } else {
      console.warn(`Drawer element with ID '${this.targetId}' does not exist.`);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
    this.removeEventListener('keydown', this.handleKeyPress);
  }

  handleKeyPress(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleClick();
    }
  }

  handleClick() {
    if (this.targetDrawer && typeof this.targetDrawer.open === 'function') {
      this.targetDrawer.open(this); 
    }
  }
}

customElements.define('drawer-button', DrawerButton);

/**
 *  @class
 *  @function QuickView
 */
if (!customElements.get('quick-view')) {
  class QuickView extends HTMLElement {
    constructor() {
      super();
      this.initElements();
      this.bindEvents();
    }

    initElements() {
      const modal = document.getElementById('product-quick-view');
      this.elements = {
        overlay: document.querySelector('.product-quick-view__overlay'),
        modal,
        body: document.body,
        closeButton: modal?.querySelector('.product-quick-view__close'),
        modalContent: modal?.querySelector('#product-quick-view__product-content')
      };
    }

    bindEvents() {
      const { overlay, closeButton, modal } = this.elements;
      this.addEventListener('click', this.onQuickViewClick.bind(this));
      this.addEventListener('keydown', this.onQuickViewKeydown.bind(this));
      if(closeButton){
        overlay.addEventListener('click', this.closeQuickView.bind(this));
        closeButton.addEventListener('click', this.closeQuickView.bind(this));
        document.addEventListener('keydown', this.onKeyDown.bind(this));
      }
      modal?.addEventListener('transitionend', this.onTransitionEnd.bind(this));
    }

    onKeyDown(event) {
      if (event.key === 'Escape' && this.elements.modal.classList.contains('quick-view-loaded')) {
        this.closeQuickView();
      }
    }
    onQuickViewKeydown(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); 
        this.onQuickViewClick(event);
      }
    }
    trapFocus(event) {
      if (event.key === "Tab") {
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableContent = this.elements.modal.querySelectorAll(focusableElements);
        const firstFocusableElement = focusableContent[0];
        const lastFocusableElement = focusableContent[focusableContent.length - 1];

        if (event.shiftKey) { 
          if (document.activeElement === firstFocusableElement) {
            event.preventDefault();
            lastFocusableElement.focus();
          }
        } else { 
          if (document.activeElement === lastFocusableElement) {
            event.preventDefault();
            firstFocusableElement.focus();
          }
        }
      }
    }

    onTransitionEnd() {
      if (
        !this.elements.modal.classList.contains('quick-view-loaded') &&
        this.elements.modalContent.innerHTML !== ''
      ) {
        this.elements.modalContent.innerHTML = '';
      }
    }


    async onQuickViewClick(event) {
      event.preventDefault();
      const quickViewUrl = this.buildProductUrl();
    
      if (!quickViewUrl) return;
    
      this.classList.add('loading');
      this.elements.modalContent.classList.add('is-loading');
      try {
        this.cache = this.cache || {};
        if (!this.cache[quickViewUrl] || Date.now() - this.cache[quickViewUrl].timestamp > 60000) {
          const content = await this.fetchProductContent(quickViewUrl);
          this.cache[quickViewUrl] = { content, timestamp: Date.now() };
        }
        this.renderQuickView(this.cache[quickViewUrl].content, quickViewUrl);
      } finally {
        this.classList.remove('loading');
        setTimeout(() => {
          this.elements.modalContent.classList.remove('is-loading');
        }, 150);
      }
    }

    buildProductUrl() {
      const url = this.dataset.productUrl;
      if (!url) return '';
      const cleanUrl = url.split('?')[0];
      return `${cleanUrl}?view=quick-view`;
    }   

    async fetchProductContent(url) {
      const response = await fetch(url);
      const text = await response.text();
      return new DOMParser().parseFromString(text, 'text/html').querySelector('#product-quick-view__product-content').innerHTML;
    }

    renderQuickView(content, url) {
      if (!content) return;
    
      this.elements.modalContent.innerHTML = content;
      requestAnimationFrame(() => {
        this.loadJavaScriptFiles();
        this.initializeShopifyComponents();
        this.openQuickView();
        this.dispatchQuickViewOpenEvent(url);
      });
    }

    loadJavaScriptFiles() {
      if (!this.loadedScripts) this.loadedScripts = new Set();
    
      this.elements.modalContent.querySelectorAll('script[src]').forEach(script => {
        if (!this.loadedScripts.has(script.src) && !document.querySelector(`script[src="${script.src}"]`)) {
          const newScript = document.createElement('script');
          newScript.src = script.src;
          newScript.async = true;
          document.head.appendChild(newScript);
          this.loadedScripts.add(script.src);
        }
      });
    }
    
    initializeShopifyComponents() {
      setTimeout(() => {
        if (Shopify?.PaymentButton) Shopify.PaymentButton.init();
        if (window.ProductModel) window.ProductModel.loadShopifyXR();
      }, 200);
    }
    
    openQuickView() {
      const { body, modal, closeButton } = this.elements;
      body.classList.add('quickview-open');
      modal.classList.add('quick-view-loaded');
      closeButton?.focus();
      
      if (!this.isFocusTrapped) {
        this.isFocusTrapped = true;
        document.addEventListener('keydown', this.trapFocus.bind(this));
      }
    }
    
    closeQuickView() {
      const { body, modal } = this.elements;
      body.classList.remove('quickview-open');
      modal.classList.remove('quick-view-loaded');
    
      if (this.isFocusTrapped) {
        this.isFocusTrapped = false;
        document.removeEventListener('keydown', this.trapFocus.bind(this));
      }
    }
    
    

    dispatchQuickViewOpenEvent(url) {
      document.dispatchEvent(new CustomEvent('quick-view:loaded', {
        detail: { productUrl: url }
      }));
    }
  }

  customElements.define('quick-view', QuickView);
}


/**
 *  @class
 *  @function CollapsibleDetails
 */

if (!customElements.get('collapsible-details')) {
  class CollapsibleDetails extends HTMLElement {
    constructor() {
      super();
      this.toggleContent = this.toggleContent.bind(this);
      this.onTransitionEnd = this.onTransitionEnd.bind(this);
      this.updateHeight = this.updateHeight.bind(this);
      this.setResponsiveState = this.setResponsiveState.bind(this);
      this.isAnimating = false;
    }

    connectedCallback() {
      this.detailsEl = this.querySelector('details');
      this.summaryEl = this.querySelector('summary');
      this.contentEl = this.querySelector('.collapsible__content');
      this.contentInnerEl = this.querySelector('.collapsible__content-inner');
    
      if (!this.detailsEl || !this.summaryEl || !this.contentEl) {
        return;
      }
    
      this.wrapContent();
      this.setupInitialState();
      this.addEventListeners();
    
      // Setup ResizeObserver to handle content size changes
      if (this.contentInnerEl) {
        this.resizeObserver = new ResizeObserver(this.updateHeight);
        this.resizeObserver.observe(this.contentInnerEl);
      }
    
      if (this.detailsEl.dataset.responsive === 'true') {
        this.setResponsiveState();
      }
    
      this.mutationObserver = new MutationObserver(this.updateContentHeight.bind(this));
      if (this.contentInnerEl) {
        this.mutationObserver.observe(this.contentInnerEl, { 
          childList: true, 
          subtree: true, 
          characterData: true 
        });
      }
    }


    wrapContent() {
      if (!this.contentEl || !this.contentEl.parentElement) {
        return;
      }
    
      if (this.contentEl.parentElement.classList.contains('collapsible__content-wrapper')) {
        this.contentWrapper = this.contentEl.parentElement;
        return;
      }
    
      this.contentWrapper = document.createElement('div');
      this.contentWrapper.className = 'collapsible__content-wrapper';
    
      this.contentEl.parentNode.insertBefore(this.contentWrapper, this.contentEl);
      this.contentWrapper.appendChild(this.contentEl);
    }
    

    setupInitialState() {
      if (!this.detailsEl) {
        return;
      }
    
      if (this.detailsEl.hasAttribute('open')) {
        this.contentWrapper.style.height = 'auto';
        this.contentEl.style.transform = 'translateY(0)';
        this.detailsEl.classList.add('is-open');
      } else {
        this.contentWrapper.style.height = '0';
        this.contentEl.style.transform = 'translateY(16px)';
      }
    }


    addEventListeners() {
      if (!this.summaryEl || !this.contentWrapper) {
        return;
      }
    
      this.summaryEl.addEventListener('click', this.toggleContent);
      this.contentWrapper.addEventListener('transitionend', this.onTransitionEnd);
    }

    toggleContent(event) {
      event.preventDefault();
      if (this.isAnimating) {
        this.pendingState = !this.detailsEl.open;
        return;
      }
      
      this[this.detailsEl.open ? 'closeContent' : 'openContent']();
    }

    openContent() {
      this.isAnimating = true;
      this.detailsEl.open = true;
      
      requestAnimationFrame(() => {
        const height = this.contentEl.scrollHeight;
        this.contentWrapper.style.height = '0';
        this.contentEl.style.transform = 'translateY(16px)';
        
        requestAnimationFrame(() => {
          this.detailsEl.classList.add('is-open');
          this.contentWrapper.style.height = `${height}px`;
          this.contentEl.style.transform = 'translateY(0)';
        });
      });
    }

    closeContent() {
      this.isAnimating = true;
      
      requestAnimationFrame(() => {
        const height = this.contentWrapper.scrollHeight;
        this.contentWrapper.style.height = `${height}px`;
        
        requestAnimationFrame(() => {
          this.detailsEl.classList.remove('is-open');
          this.contentWrapper.style.height = '0';
          this.contentEl.style.transform = 'translateY(16px)';
        });
      });
    }

    onTransitionEnd(event) {
      if (event.propertyName !== 'height' || event.target !== this.contentWrapper) return;
      
      this.isAnimating = false;
      
      if (!this.detailsEl.classList.contains('is-open')) {
        this.detailsEl.open = false;
      } else {
        this.contentWrapper.style.height = 'auto';
      }

      if (this.pendingState !== undefined) {
        this[this.pendingState ? 'openContent' : 'closeContent']();
        this.pendingState = undefined;
      }
    }

    updateHeight() {
      if (this.detailsEl.open && !this.isAnimating) {
        this.contentWrapper.style.height = 'auto';
        const height = this.contentWrapper.scrollHeight;
        this.contentWrapper.style.height = `${height}px`;
      }
    }
    updateContentHeight() {
      if (this.detailsEl.open) {
        const height = this.contentEl.scrollHeight;
        this.contentWrapper.style.height = `${height}px`;
      }
    }

    disconnectedCallback() {
      if (this.summaryEl) {
        this.summaryEl.removeEventListener('click', this.toggleContent);
      }
    
      if (this.contentWrapper) {
        this.contentWrapper.removeEventListener('transitionend', this.onTransitionEnd);
      }
    
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
    
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }
    }
    setResponsiveState() {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
      if (isMobile && this.detailsEl.open) {
        return;
      }
    
      this.detailsEl.open = !isMobile;
      this.detailsEl.classList.toggle('is-open', !isMobile);
    
      if (isMobile) {
        this.contentWrapper.style.height = '0';
      } else {
        this.contentWrapper.style.height = 'auto';
        this.contentEl.style.transform = 'translateY(0)';
        
        setTimeout(() => {
          const height = this.contentEl.scrollHeight;
          this.contentWrapper.style.height = `${height}px`;
        }, 0);
      }
    }
    
    
  }

  customElements.define('collapsible-details', CollapsibleDetails);
}

// Use a debounced resize handler for better performance
function debounce(func, wait = 100) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

window.addEventListener('resize', debounce(() => {
  document.querySelectorAll('collapsible-details details[data-responsive="true"]')
    .forEach(details => details.closest('collapsible-details').setResponsiveState());
}));

/**
 *  @class
 *  @function TabsComponent
 */

if (!customElements.get('tabs-component')) {
  class TabsComponent extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.tabsHeader = this.querySelector('.tabs-header');
      this.tabsContent = this.querySelector('.tabs-content');
      this.tabActiveIndicator = this.querySelector('.indicator');

      this.tabsHeader.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
          this.activateTab(e.target);
        }
      });

      this.tabsHeader.addEventListener('keydown', (e) => {
        if (e.target.classList.contains('tab-button')) {
          this.handleKeyDown(e);
        }
      });

      this.activateTab(this.tabsHeader.querySelector('.tab-button'));

      if (Shopify && Shopify.designMode) {
        document.addEventListener('shopify:block:select', this.handleBlockSelect.bind(this));
      }
    }

    activateTab(tab) {
      const tabIndex = tab.getAttribute('data-tab');

      this.tabsHeader.querySelectorAll('.tab-button').forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive);
        //t.setAttribute('tabindex', isActive ? '0' : '-1'); 
      });

      this.tabsContent.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.toggle('active', content.getAttribute('id') === tabIndex);
      });

      const tabRect = tab.getBoundingClientRect();
      const tabsHeaderRect = this.tabsHeader.getBoundingClientRect();
      const isRTL = getComputedStyle(this.tabsHeader).direction === 'rtl';
      const offset = isRTL
        ? tabsHeaderRect.right - tabRect.right
        : tabRect.left - tabsHeaderRect.left;

        this.tabsHeader.style.setProperty('--indicator-width', `${tabRect.width}px`);
        this.tabsHeader.style.setProperty('--indicator-offset', `${offset}px`);
    }

    handleKeyDown(e) {
      const key = e.key;
      const currentTab = e.target;
      let newTab;

      switch (key) {
        case 'ArrowRight':
          newTab = currentTab.nextElementSibling || this.tabsHeader.firstElementChild;
          break;
        case 'ArrowLeft':
          newTab = currentTab.previousElementSibling || this.tabsHeader.lastElementChild;
          break;
        case 'Enter':
        case 'Space':  
          this.activateTab(currentTab);
          return;
      }

      if (newTab && newTab.classList.contains('tab-button')) {
        e.preventDefault();
        newTab.focus(); 
      }
    }

    handleBlockSelect(e) {
      const blockId = e.detail.blockId;
      const tabToActivate = this.tabsHeader.querySelector(`[data-tab="tab-${blockId}"]`);
      if (tabToActivate) {
        this.activateTab(tabToActivate);
      }
    }
  }

  customElements.define('tabs-component', TabsComponent);
}

if (!customElements.get('card-product-swatch')) {
  class CardProductSwatch extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.swatchButtons = this.querySelectorAll('.swatch-button');
      this.image = this.closest('.card-product').querySelector('.product-first-image img');
      this.link = this.closest('.card-product').querySelector('.product-link'); 

      this.swatchButtons.forEach((button) => {
        button.addEventListener('click', (e) => {
          this.handleSwatchInteraction(e.currentTarget, true);
        });

        button.addEventListener('mouseenter', (e) => {
          this.handleSwatchInteraction(e.currentTarget, false);
        });

        button.addEventListener('mouseleave', () => {
          const active = this.querySelector('.swatch-button.active');
          if (active) {
            this.updateProductImage(active);
            this.updateProductLink(active);
          }
        });
      });
    }

    handleSwatchInteraction(button, isClick) {
      if (isClick) {
        this.updateActiveSwatch(button);
      }
      this.updateProductImage(button);
      this.updateProductLink(button);
    }

    updateActiveSwatch(button) {
      this.swatchButtons.forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
    }

    updateProductImage(button) {
      const newImageSrcset = button.getAttribute('data-srcset');
      const newImageSrc = button.getAttribute('data-src');
      if (newImageSrcset) {
        this.image.srcset = newImageSrcset;
      }
      if (newImageSrc) {
        this.image.src = newImageSrc;
      }
    }

    updateProductLink(button) {
      const newLink = button.getAttribute('data-link');
      if (newLink) {
        this.link.href = newLink;
      }
    }
  }

  customElements.define('card-product-swatch', CardProductSwatch);
}


/**
 *  @class
 *  @function CountdownTimer
 */

if (!customElements.get('count-down')) {
  class CountdownTimer extends HTMLElement {
    constructor() {
      super();
      this.endTime = this.parseEndTime();
      this.timerId = null;
      this.elements = this.getElements();
    }

    parseEndTime() {
      const timeAttr = this.getAttribute('data-timer');
      const parsedTime = Date.parse(timeAttr);
      return isNaN(parsedTime) ? Date.now() : parsedTime;
    }

    getElements() {
      return {
        days: this.querySelector('[data-value="days"] .countdown-day'),
        hours: this.querySelector('[data-value="hours"] .countdown-hour'),
        minutes: this.querySelector('[data-value="minutes"] .countdown-minute'),
        seconds: this.querySelector('[data-value="seconds"] .countdown-second')
      };
    }

    calculateTimeRemaining() {
      const now = Date.now();
      const total = Math.max(this.endTime - now, 0);
      return {
        total,
        days: Math.floor(total / (1000 * 60 * 60 * 24)),
        hours: Math.floor((total / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((total / (1000 * 60)) % 60),
        seconds: Math.floor((total / 1000) % 60)
      };
    }

    initializeDisplay() {
      this.updateDisplay(this.calculateTimeRemaining());
    }

    startCountdown() {
      this.classList.add("active");

      this.timerId = setInterval(() => {
        const remainingTime = this.calculateTimeRemaining();

        if (remainingTime.total <= 0) {
          this.updateDisplay(remainingTime);
          this.stopCountdown();
          this.dispatchEvent(new CustomEvent('countdown-finished'));
          return;
        }

        this.updateDisplay(remainingTime);
      }, 1000);
    }

    updateDisplay(remainingTime) {
      Object.keys(this.elements).forEach(key => {
        if (this.elements[key]) {
          this.elements[key].textContent = remainingTime[key].toString().padStart(2, '0');
        }
      });
    }

    connectedCallback() {
      this.initializeDisplay();
      setTimeout(() => this.startCountdown(), 50);
    }

    disconnectedCallback() {
      this.stopCountdown();
    }

    stopCountdown() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }
  }

  customElements.define('count-down', CountdownTimer);
}

if (!customElements.get('newsletter-form')) {
  class NewsletterForm extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const form = this.querySelector('form');
      if (!form) return;
      const input = form.querySelector('input[type="email"]');
      const button = form.querySelector('button[type="submit"]');
      const error = form.querySelector('.newsletter-form__message');
      const errorText = error.querySelector('.newsletter-form__message-error');
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const errorMessage = newsletterFormStrings.error;

      function validate() {
        if (!input.value) {
          error.style.display = 'none';
          errorText.textContent = '';
          button.disabled = true;
          return;
        }
        if (emailPattern.test(input.value)) {
          error.style.display = 'none';
          errorText.textContent = '';
          button.disabled = false;
        } else {
          errorText.textContent = errorMessage;
          error.style.display = 'flex';
          button.disabled = true;
        }
      }

      input.addEventListener('input', validate);

      form.addEventListener('submit', function(e) {
        if (!emailPattern.test(input.value)) {
          errorText.textContent = errorMessage;
          error.style.display = 'flex';
          button.disabled = true;
          e.preventDefault();
        } else {
          errorText.textContent = '';
          error.style.display = 'none';
          button.disabled = false;
        }
      });

      validate();
    }
  }

  customElements.define('newsletter-form', NewsletterForm);
}

if (!customElements.get('moving-button')) {
  class MovingButton extends HTMLElement {
    constructor() {
      super();
      this.button = null;
      this.buttonRect = null;
      this.proximity = 50;
      this.isEffectActive = false;
      this.targetOffsetX = 0;
      this.targetOffsetY = 0;
      this.rafId = null;

      this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
      this.cacheButtonPosition = this.cacheButtonPosition.bind(this);
      this.applyCurrentTransform = this.applyCurrentTransform.bind(this);
      this.handleScrollOrResize = this.handleScrollOrResize.bind(this);
    }

    static get observedAttributes() {
      return ['data-proximity'];
    }

    connectedCallback() {
      this.button = this.querySelector(".moving-button");
      if (!this.button) {
        return;
      }

      this.updateProximityFromAttribute();

      requestAnimationFrame(() => {
        this.cacheButtonPosition();
      });

      document.addEventListener('mousemove', this.handleDocumentMouseMove);
      window.addEventListener('scroll', this.handleScrollOrResize, { passive: true });
      window.addEventListener('resize', this.handleScrollOrResize);
    }

    disconnectedCallback() {
      document.removeEventListener('mousemove', this.handleDocumentMouseMove);
      window.removeEventListener('scroll', this.handleScrollOrResize);
      window.removeEventListener('resize', this.handleScrollOrResize);

      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.button && this.isEffectActive) {
        this.button.style.willChange = 'auto';
        this.button.style.transform = 'translate3d(0px, 0px, 0px)';
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === 'data-proximity') {
        this.updateProximityFromAttribute();
      }
    }

    updateProximityFromAttribute() {
      const proximityAttr = this.getAttribute('data-proximity');
      if (proximityAttr !== null) {
        const parsedProximity = parseInt(proximityAttr, 10);
        if (!isNaN(parsedProximity) && parsedProximity >= 0) {
          this.proximity = parsedProximity;
        }
      }
    }

    cacheButtonPosition() {
      if (!this.button) return;
      this.buttonRect = this.button.getBoundingClientRect();
    }

    handleScrollOrResize() {
      this.cacheButtonPosition();
    }

    applyCurrentTransform() {
      if (!this.button) return;
      this.button.style.transform = `translate3d(${this.targetOffsetX}px, ${this.targetOffsetY}px, 0px)`;
      this.rafId = null;
    }

    handleDocumentMouseMove(e) {
      if (!this.button || !this.buttonRect) {
        return;
      }

      const mouseX_viewport = e.clientX;
      const mouseY_viewport = e.clientY;

      const zoneLeft = this.buttonRect.left - this.proximity;
      const zoneTop = this.buttonRect.top - this.proximity;
      const zoneRight = this.buttonRect.right + this.proximity;
      const zoneBottom = this.buttonRect.bottom + this.proximity;

      const mouseInZone = (
        mouseX_viewport >= zoneLeft && mouseX_viewport <= zoneRight &&
        mouseY_viewport >= zoneTop && mouseY_viewport <= zoneBottom
      );

      if (mouseInZone) {
        if (!this.isEffectActive) {
          this.isEffectActive = true;
          if (this.button) this.button.style.willChange = 'transform';
        }

        const buttonCenterX_viewport = this.buttonRect.left + this.buttonRect.width / 2;
        const buttonCenterY_viewport = this.buttonRect.top + this.buttonRect.height / 2;

        let offsetX = mouseX_viewport - buttonCenterX_viewport;
        let offsetY = mouseY_viewport - buttonCenterY_viewport;

        const maxMove = 20;
        this.targetOffsetX = Math.max(-maxMove, Math.min(maxMove, offsetX));
        this.targetOffsetY = Math.max(-maxMove, Math.min(maxMove, offsetY));

        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
        }
        this.rafId = requestAnimationFrame(this.applyCurrentTransform);

      } else {
        if (this.isEffectActive) {
          this.isEffectActive = false;
          if (this.button) {
            this.button.style.willChange = 'auto';
            this.button.style.transform = 'translate3d(0px, 0px, 0px)';
          }
          if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
          }
        }
      }
    }
  }

  customElements.define("moving-button", MovingButton);
}


(function() {
  function getAbsoluteTop(element) {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return rect.top + scrollTop;
  }

  function initSmoothScroll() {
    document.addEventListener('click', function(event) {
      if (event.target.matches('[data-anchor]')) {
        event.preventDefault();
        
        const href = event.target.getAttribute('href');
        if (!href || href === '#') return;
        
        const targetId = href.replace('#', '');
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) {
          const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
          const targetPosition = getAbsoluteTop(targetSection) - headerHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  }

  // Init when DOM is ready
  document.addEventListener('DOMContentLoaded', initSmoothScroll);
})();

(function() {
  const copyURL = () => {
    var button = document.querySelector('.share-button__copy');
    if (!button) return;
    button.addEventListener('click', function() {
      var url = button.getAttribute('data-url');
      navigator.clipboard.writeText(url).then(function() {
        button.classList.add('copied');
        setTimeout(function() {
          button.classList.remove('copied');
        }, 2000);
      }).catch(function(err) {
        console.error(err);
      });
    });

  }
  document.addEventListener("DOMContentLoaded", function() {
    copyURL();
  });
})()

if (!customElements.get('card-variant-size')) {
  customElements.define('card-variant-size', class extends HTMLElement {
    constructor() {
      super();
      this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      this.addEventListener('click', this.handleClick.bind(this));
    }

    handleClick(event) {
      const button = event.target.closest('.variant-size-button');
      if (!button || button.disabled) return;

      const variantId = button.dataset.variantId;
      if (!variantId) return;

      const spinner = button.querySelector('.loading__spinner');

      this.loading = true;
      const allButtons = this.querySelectorAll('.variant-size-button');
      allButtons.forEach(btn => {
        btn.setAttribute('aria-disabled', true);
        btn.classList.add('disabled');
      });

      button.classList.add('loading');
      button.setAttribute('aria-disabled', true);
      if (spinner) spinner.classList.remove('hidden');

      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', 1);

      if (this.cart?.getSectionsToRender) {
        const sections = this.cart.getSectionsToRender().map((s) => s.id);
        formData.append('sections', sections.join(','));
        formData.append('sections_url', window.location.pathname);
        this.cart.setActiveElement?.(document.activeElement);
      }

      fetch(`${routes.cart_add_url}.js`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      })
      .then(res => {
        if (!res.ok) return res.text().then(text => { throw new Error(text); });
        return res.json();
      })
      .then(data => {
        if (data.status) {
          console.warn(data.message || data.description);
          return;
        }

        if (this.cart?.renderContents) {
          this.cart.renderContents(data);
        } else {
          window.location = window.routes.cart_url;
        }
      })
      .catch(err => {
        console.error(err);
      })
      .finally(() => {
        allButtons.forEach(btn => {
          btn.removeAttribute('aria-disabled');
          btn.classList.remove('disabled', 'loading');
          btn.querySelector('.loading__spinner')?.classList.add('hidden');
        });
        this.loading = false;
      
        if (this.cart && this.cart.classList.contains('is-empty')) {
          this.cart.classList.remove('is-empty');
        }
      });      
    }
  });
}

if (!customElements.get('show-more-toggle')) {
  customElements.define(
    'show-more-toggle',
    class ShowMoreToggle extends HTMLElement {
      constructor() {
        super();
        this.content = this.querySelector('[data-show-more-content]');
        this.button = this.querySelector('button');
        this.showMoreText = this.querySelector('.label-show-more');
        this.showLessText = this.querySelector('.label-show-less');

        this.button.addEventListener('click', () => this.toggle());
      }

      toggle() {
        this.content.classList.toggle('content-truncated');
        this.showMoreText.classList.toggle('hidden');
        this.showLessText.classList.toggle('hidden');
      }
    }
  );
}

