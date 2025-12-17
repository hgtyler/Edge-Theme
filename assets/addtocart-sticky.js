if (!customElements.get('product-add-to-cart-sticky')) {
class ProductAddToCartSticky extends HTMLElement {
    constructor() {
        super();
        this.handleScroll = this.handleScroll.bind(this);
        this.handleVariantChange = this.handleVariantChange.bind(this);
        this.sectionId = this.dataset.section;
    }

    connectedCallback() {
        this.targetElement = document.querySelector('[id^="ProductSubmitButton-"]');
        this.footerElement = document.querySelector('footer');
        this.stickyAtcVariantInput = this.querySelector('.product-variant-id');

        window.addEventListener("scroll", this.handleScroll);
        document.body.addEventListener('change', this.handleVariantChange);
    }

    disconnectedCallback() {
        window.removeEventListener("scroll", this.handleScroll);
        document.body.removeEventListener('change', this.handleVariantChange);
    }

    getAbsoluteTop(element) {
        let top = 0;
        while (element) {
            top += element.offsetTop || 0;
            element = element.offsetParent;
        }
        return top;
    }

    handleScroll() {
        const targetTopPosition = this.getAbsoluteTop(this.targetElement);
        const footerTopPosition = this.getAbsoluteTop(this.footerElement);
        const isTargetElementOutOfView = targetTopPosition < window.scrollY;
        const isFooterInView = window.scrollY + window.innerHeight > footerTopPosition;

        if (isTargetElementOutOfView && !isFooterInView) {
            this.classList.add('show');
        } else {
            this.classList.remove('show');
        }
    }

    updateStickyATCOption(optionName, optionValue) {
        const matches = optionName.match(/options\[(.+)\]/);
        if (matches && matches[1]) {
            optionName = matches[1];
        }

        const optionDisplay = this.querySelector('.selected-variant-option[data-option-name="' + optionName + '"]');
        if (optionDisplay) {
            optionDisplay.textContent = optionName + ': ' + optionValue;
        }
    }

    handleVariantChange(event) {
        const target = event.target;
        const productSection = target.closest(`#MainProduct-${this.sectionId}`);
        if (!productSection) return;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            const optionName = target.name;
            const optionValue = target.tagName === 'INPUT' ? target.value : target.options[target.selectedIndex].textContent;
            this.updateStickyATCOption(optionName, optionValue);
        }
    }
}

customElements.define('product-add-to-cart-sticky', ProductAddToCartSticky);
}
