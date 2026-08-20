class ParallaxGallery extends HTMLElement {
  constructor() {
    super();
    this._onScroll = this._onScroll.bind(this);
  }

  connectedCallback() {
    this.container = this.querySelector(".parallax-gallery__container");
    
    if (!this.container) {
      console.error("No `.parallax-gallery__container` found inside <parallax-gallery>.");
      return;
    }

    this.items = Array.from(
      this.container.querySelectorAll(".parallax-gallery__item")
    ).map((item) => ({
      element: item,
      offset: Number(item.dataset.offset) || 10,
    }));

    window.addEventListener("scroll", this._onScroll);
    this._onScroll();
  }

  disconnectedCallback() {
    window.removeEventListener("scroll", this._onScroll);
  }

  _onScroll() {
    const rect = this.container.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    const isVisible = 
      rect.top < windowHeight &&
      rect.bottom > 0;

    if (!isVisible) return;

    const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
    const scrollProgress = Math.max(0, Math.min(1, progress));
    
    this.items.forEach(({ element, offset }) => {
      let movement;
      
      if (offset < 0) {
        movement = scrollProgress * Math.abs(offset);
      } else {
        movement = -scrollProgress * offset;
      }

      element.style.transform = `translate(0%, ${movement}px)`;
    });
  }
}

customElements.define("parallax-gallery", ParallaxGallery);