if (!customElements.get('text-reveal')) {
  class TextReveal extends HTMLElement {
    constructor() {
      super();
      this.words = [];
      this.isTicking = false;
      this.scrollY = 0;
      this.isVisible = false; 

      this.onScroll = this.onScroll.bind(this);
      this.update = this.update.bind(this);
    }

    connectedCallback() {
      if (window.Shopify?.designMode) return;

      this.original = this.querySelector('[data-text-reveal="original"]');
      this.overlay = this.querySelector('[data-text-reveal="overlay"]');

      if (!this.original || !this.overlay) return;

      setTimeout(() => this.init(),50); 
    }

    init() {
      const words = this.original.textContent
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0); 
    
      const className = this.dataset.revealClass || "text-reveal-word";
    
      const fragOriginal = document.createDocumentFragment();
      const fragOverlay = document.createDocumentFragment();
    
      words.forEach((w, index) => {
        const o = document.createElement("span");
        o.textContent = w;
        fragOriginal.appendChild(o);
    
        const ov = document.createElement("span");
        ov.className = className;
        ov.dataset.word = "";
        ov.textContent = w;
        fragOverlay.appendChild(ov);
        this.words.push(ov);
    
        if (index < words.length - 1) {
          fragOriginal.appendChild(document.createTextNode(" "));
          fragOverlay.appendChild(document.createTextNode(" "));
        }
      });
    
      this.original.textContent = "";
      this.overlay.textContent = "";
      this.original.appendChild(fragOriginal);
      this.overlay.appendChild(fragOverlay);
    
      this.measure();
    
      this.observer = new IntersectionObserver(entries => {
        this.isVisible = entries[0].isIntersecting;
        
        if (this.isVisible) {
          window.addEventListener("scroll", this.onScroll, { passive: true });
          this.scrollY = window.scrollY;
          this.update();
        } else {
          window.removeEventListener("scroll", this.onScroll);
        }
      }, {
        rootMargin: "10% 0px",
        threshold: 0
      });
    
      this.observer.observe(this);
      this.update(); 
    }

    measure() {
      const rect = this.original.getBoundingClientRect();
      const scrollTop = window.scrollY;

      this.start = rect.top + scrollTop - window.innerHeight * 0.5;
      this.end = this.start + rect.height + (window.innerWidth < 768 ? 200 : 100);
      this.total = this.end - this.start;
      
      if (this.total <= 0) this.total = 1;
    }

    onScroll() {
      this.scrollY = window.scrollY;

      if (!this.isTicking) {
        requestAnimationFrame(this.update);
        this.isTicking = true;
      }
    }

    update() {
      this.isTicking = false;
      if (!this.words.length) return;

      let p = (this.scrollY - this.start) / this.total;
      p = Math.max(0, Math.min(p, 1));

      const count = this.words.length;

      if (p === 0) {
        this.words.forEach(w => w.style.setProperty("--reveal-amount", "0%"));
        return;
      }
      
      if (p === 1) {
        this.words.forEach(w => w.style.setProperty("--reveal-amount", "100%"));
        return;
      }

      for (let i = 0; i < count; i++) {
        const start = i / count;
        const end = (i + 1) / count;

        let v = 0;
        if (p >= end) {
          v = 100;
        } else if (p > start) {
          v = ((p - start) / (end - start)) * 100;
        }

        this.words[i].style.setProperty("--reveal-amount", v.toFixed(1) + "%");
      }
    }

    refresh() {
      this.measure();
      this.scrollY = window.scrollY;
      this.update();
    }

    reset() {
      this.words.forEach(w => w.style.setProperty('--reveal-amount', '0%'));
    }

    disconnectedCallback() {
      window.removeEventListener("scroll", this.onScroll);
      this.observer?.disconnect();
    }
  }

  customElements.define("text-reveal", TextReveal);
}
