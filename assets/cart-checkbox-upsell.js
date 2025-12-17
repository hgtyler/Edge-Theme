class CartCheckboxUpsell {
  constructor(cartItemsInstance) {
    this.cartItemsInstance = cartItemsInstance;
    this.baseUrl = '/cart';
    this.checkboxUpsellVariantId = this.getUpsellCheckboxVariantId();
    this.initEventDelegation();
    document.addEventListener('cartUpdated', this.handleCartUpdate.bind(this));
    this.updateCheckboxState();
  }

  initEventDelegation() {
    document.body.addEventListener('change', (event) => {
      if (event.target.id === 'cart-upsell-checkbox') {
        const isChecked = event.target.checked;
        if (isChecked) {
          this.addUpsellCheckboxToCart();
        } else {
          this.removeUpsellCheckboxFromCart();
        }
      }
    });
  }

  getUpsellCheckboxVariantId() {
    return document.querySelector('#cart-upsell-checkbox')?.getAttribute('data-variant-id');
  }

  updateCheckboxState() {
    fetch(`${this.baseUrl}.js`)
      .then(response => response.json())
      .then(cart => {
        const hasUpsellCheckbox = cart.items.some(item => item.variant_id.toString() === this.checkboxUpsellVariantId);
        const checkboxUpsellCheckbox = document.querySelector('#cart-upsell-checkbox');
        if (checkboxUpsellCheckbox) {
          checkboxUpsellCheckbox.checked = hasUpsellCheckbox;
        }
      })
      .catch(error => {
        console.error('Error fetching cart:', error);
      });
  }

  handleCartUpdate() {
    setTimeout(() => this.updateCheckboxState(), 500); 
  }

  addUpsellCheckboxToCart() {
    const formData = new FormData();
    formData.append('id', this.checkboxUpsellVariantId);
    formData.append('quantity', 1);

    fetch(`${this.baseUrl}/add.js`, {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (response.ok) {
        if (this.cartItemsInstance && typeof this.cartItemsInstance.onCartUpdate === 'function') {
          this.cartItemsInstance.onCartUpdate();
          this.onCartUpdateCheckboxUpsell();
        }
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error adding cart upsell:', error);
    });
  }

  removeUpsellCheckboxFromCart() {
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        const lineItemIndex = cart.items.findIndex(item => item.variant_id.toString() === this.checkboxUpsellVariantId);
        if (lineItemIndex !== -1) {
          const line = lineItemIndex + 1;
          this.cartItemsInstance.updateQuantity(line, 0, null, null);
        } else {
          console.error('Cart upsell product not found in cart.');
        }
      })
      .catch(error => {
        console.error('Error fetching cart for cart upsell removal:', error);
      });
  }

  getSectionsToRenderCheckboxUpsell() {
    const mainCartItems = document.getElementById('main-cart-items');
    const sections = [
      ...(mainCartItems ? [{
        id: 'main-cart-items',
        section: mainCartItems.dataset.id,
        selector: '.js-contents',
      }] : []),
      ...(mainCartItems ? [{
        id: 'main-cart-shipping',
        section: mainCartItems.dataset.id,
        selector: '#main-cart-shipping',
      }] : []),
      ...(mainCartItems ? [{
        id: 'main-cart-discount',
        section: mainCartItems.dataset.id,
        selector: '#main-cart-discount',
      }] : []),
      ...(mainCartItems ? [{
        id: 'main-cart-total',
        section: mainCartItems.dataset.id,
        selector: '#main-cart-total',
      }] : []),
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '#cart-icon-bubble',
      },
    ];
    return sections;
  }
  

  
  onCartUpdateCheckboxUpsell() {
    this.getSectionsToRenderCheckboxUpsell().forEach(section => {
      fetch(`${routes.cart_url}?section_id=${section.section}`)
        .then(response => response.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
  
          if (section.id === 'main-cart-items') {
            const newContents = doc.querySelectorAll('.js-contents');
            const currentContents = document.querySelectorAll('.js-contents');
  
            newContents.forEach((newContent, index) => {
              const currentContent = currentContents[index];
              if (currentContent && newContent) {
                currentContent.innerHTML = newContent.innerHTML;
              }
            });
  
          } else if (section.id === 'cart-icon-bubble') {
            const container = document.querySelector(section.selector);
            if (container) {
              container.innerHTML = html;
            } else {
              console.error(`Container not found for selector: ${section.selector}`);
            }
            
          } else if (['main-cart-shipping', 'main-cart-discount', 'main-cart-total'].includes(section.id)) {
            const newElement = doc.querySelector(section.selector);
            const currentElement = document.querySelector(section.selector);
            
            if (currentElement && newElement) {
              currentElement.innerHTML = newElement.innerHTML;
            } else if (!currentElement) {
              console.error(`Element not found for selector: ${section.selector}`);
            }
          }
        })
        .catch(error => console.error(`Error updating section ${section.id}:`, error));
    });
  }
  
  
}

document.addEventListener('DOMContentLoaded', function() {
    const cartItemsInstance = document.querySelector('cart-items');
    const cartDrawerItemsInstance = document.querySelector('cart-drawer-items');
    let activeCartInstance = cartDrawerItemsInstance || cartItemsInstance; 
    if (activeCartInstance) {
        new CartCheckboxUpsell(activeCartInstance);
    } else {
        console.log("Neither cart-items nor cart-drawer-items found in the DOM.");
    }
});

