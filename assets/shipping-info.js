class ShippingDate extends HTMLElement {
  constructor() {
      super();
  }

  connectedCallback() {
      const fromAttr = this.getAttribute("data-shipping-date-from");
      const toAttr = this.getAttribute("data-shipping-date-to");

      if (!fromAttr || !toAttr) return;

      const fromDays = parseInt(fromAttr, 10);
      const toDays = parseInt(toAttr, 10);

      if (isNaN(fromDays) || isNaN(toDays)) return;

      const today = new Date();
      const fromDate = this.addBusinessDays(today, fromDays);
      const toDate = this.addBusinessDays(today, toDays);

      const options = { day: "numeric", month: "short", weekday: "short" };
      const fromFormatted = fromDate.toLocaleDateString("en-AU", options);
      const toFormatted = toDate.toLocaleDateString("en-AU", options);

      const dateRange = `${fromFormatted} - ${toFormatted}`;

      const textEl = this.querySelector(".product__info-item-text");
      if (textEl) {
          textEl.textContent = `${textEl.textContent.trim()} : ${dateRange}`;
      }
  }

  addBusinessDays(date, days) {
      const result = new Date(date.getTime());
      let count = 0;
      while (count < days) {
          result.setDate(result.getDate() + 1);
          const dayOfWeek = result.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              count++;
          }
      }
      return result;
  }
}

customElements.define("shipping-date", ShippingDate);