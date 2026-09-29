/* Sunfish Bay Rentals — booking flow controller. Plain JS, hash routing. */
(function () {
  "use strict";
  var SBR = window.SBR;

  var STEP_DEFS = [
    { key: "boat", label: "Boat" },
    { key: "date", label: "Date & Time" },
    { key: "addons", label: "Add-ons" },
    { key: "details", label: "Your Details" },
    { key: "confirm", label: "Confirmation" }
  ];

  var els = {};
  var wizard = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function defaultWizard() {
    var today = SBR.todayAtMidnight();
    return {
      boatId: null,
      date: null,
      slot: null,
      people: 1,
      addonIds: [],
      lifeJackets: { youth: 0, adultSM: 0, adultLXL: 0 },
      customer: { name: "", phone: "", email: "" },
      safetyConfirmed: false,
      calYear: today.getFullYear(),
      calMonth: today.getMonth(),
      maxStepIndex: 0,
      bookingResult: null
    };
  }

  function loadWizard() {
    var saved = SBR.getWizardState();
    var base = defaultWizard();
    if (saved && typeof saved === "object") {
      for (var k in base) {
        if (saved[k] !== undefined) base[k] = saved[k];
      }
    }
    return base;
  }
  function saveWizard() {
    SBR.saveWizardState(wizard);
  }

  /* ---------------- routing ---------------- */
  function stepIndex(key) {
    for (var i = 0; i < STEP_DEFS.length; i++) if (STEP_DEFS[i].key === key) return i;
    return 0;
  }
  function currentRouteKey() {
    var h = location.hash.replace(/^#\/?/, "");
    var valid = STEP_DEFS.some(function (s) { return s.key === h; });
    return valid ? h : "boat";
  }
  function guardRoute(key) {
    var hasBoat = !!wizard.boatId;
    var hasDateSlot = hasBoat && !!wizard.date && !!wizard.slot;
    if (key === "date" && !hasBoat) return "boat";
    if (key === "addons" && !hasDateSlot) return hasBoat ? "date" : "boat";
    if (key === "details" && !hasDateSlot) return hasBoat ? "date" : "boat";
    if (key === "confirm" && !wizard.bookingResult) return hasDateSlot ? "details" : (hasBoat ? "date" : "boat");
    return key;
  }
  function goTo(key) {
    location.hash = "#/" + key;
  }

  function render() {
    var requested = currentRouteKey();
    var actual = guardRoute(requested);
    if (actual !== requested) {
      location.replace("#/" + actual);
      return;
    }
    if (actual !== "confirm") {
      wizard.bookingResult = null;
    }
    var idx = stepIndex(actual);
    if (idx > wizard.maxStepIndex) wizard.maxStepIndex = idx;
    saveWizard();

    renderStepIndicator(actual);
    var showSummary = actual === "date" || actual === "addons" || actual === "details";
    els.flowLayout.classList.toggle("with-summary", showSummary);
    els.summaryPanel.hidden = !showSummary;
    els.bottomBar.hidden = !showSummary;

    if (actual === "boat") renderBoatStep();
    else if (actual === "date") renderDateStep();
    else if (actual === "addons") renderAddonsStep();
    else if (actual === "details") renderDetailsStep();
    else if (actual === "confirm") renderConfirmStep();

    if (showSummary) updateSummaryPanel();
    focusHeading();
  }

  function focusHeading() {
    var h = els.stepContent.querySelector("h1, h2");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: false });
    }
  }

  function renderStepIndicator(currentKey) {
    var currentIdx = stepIndex(currentKey);
    els.stepIndicator.innerHTML = STEP_DEFS.map(function (s, i) {
      var cls = "";
      if (i < currentIdx) cls = "done";
      if (i === currentIdx) cls += " active";
      var clickable = i <= wizard.maxStepIndex && i !== currentIdx && s.key !== "confirm";
      var numHtml = '<span class="num">' + (i < currentIdx ? "✓" : (i + 1)) + "</span>";
      if (clickable) {
        return '<li class="' + cls.trim() + '"><button type="button" class="step-link" data-step="' + s.key +
          '" style="all:unset;cursor:pointer;color:inherit;font:inherit">' + numHtml + esc(s.label) + "</button></li>";
      }
      return '<li class="' + cls.trim() + '">' + numHtml + esc(s.label) + "</li>";
    }).join("");
    Array.prototype.forEach.call(els.stepIndicator.querySelectorAll("[data-step]"), function (btn) {
      btn.addEventListener("click", function () { goTo(btn.getAttribute("data-step")); });
    });
  }

  /* ---------------- summary panel ---------------- */
  function currentPricing() {
    if (!wizard.boatId || !wizard.slot) return null;
    return SBR.computePricing({
      boatId: wizard.boatId,
      slot: wizard.slot,
      people: wizard.people,
      addonIds: wizard.addonIds
    });
  }
  function summaryHtml() {
    var boat = SBR.getBoat(wizard.boatId);
    var slot = wizard.slot ? SBR.getSlot(wizard.slot) : null;
    var pricing = currentPricing();
    var lines = "";
    if (boat) lines += '<div class="summary-line"><span>' + esc(boat.name) + "</span><span>" + (wizard.date ? esc(wizard.date) : "") + "</span></div>";
    if (slot) lines += '<div class="summary-line"><span>' + esc(slot.label) + "</span><span>" + esc(slot.time) + "</span></div>";
    if (!pricing) {
      return '<h3>Your booking</h3><p class="lede" style="margin:0">Pick a boat, date and time to see pricing.</p>';
    }
    lines += '<div class="summary-line"><span>Rental</span><span>' + SBR.money(pricing.rental) + "</span></div>";
    pricing.addonLines.forEach(function (a) {
      lines += '<div class="summary-line"><span>' + esc(a.name) + "</span><span>" + SBR.money(a.price) + "</span></div>";
    });
    lines += '<div class="summary-line"><span>Tax (6%)</span><span>' + SBR.money(pricing.tax) + "</span></div>";
    lines += '<div class="summary-line deposit"><span>Damage deposit<small>Refundable at return</small></span><span>' + SBR.money(pricing.deposit) + "</span></div>";
    lines += '<div class="summary-line total"><span>Total due at dock</span><span>' + SBR.money(pricing.total) + "</span></div>";
    return '<h3>Your booking</h3>' + lines;
  }
  function updateSummaryPanel() {
    els.summaryPanel.innerHTML = '<div class="card summary-box">' + summaryHtml() + "</div>";
    var pricing = currentPricing();
    els.bottomBarTotal.innerHTML = pricing
      ? SBR.money(pricing.total) + "<small>Total at dock</small>"
      : "<small>Pick a boat to see price</small>";
  }

  /* ---------------- Step 1: boat ---------------- */
  function renderBoatStep() {
    var html = "<h1>Choose your boat</h1>" +
      '<p class="lede">All rentals include a safety briefing, life jackets and a full tank. Pick what fits your crew.</p>' +
      '<div class="boat-grid">' +
      SBR.BOATS.map(function (b) {
        var selected = wizard.boatId === b.id ? " selected" : "";
        var priceLine = b.priceMode === "perPerson"
          ? SBR.money(b.priceHalf) + " <small>per person / half-day</small>"
          : SBR.money(b.priceHalf) + " <small>half-day</small>";
        return '<button type="button" class="boat-card' + selected + '" data-boat="' + b.id + '" aria-pressed="' + (wizard.boatId === b.id) + '">' +
          b.svg +
          '<p class="boat-name">' + esc(b.name) + "</p>" +
          '<p class="boat-meta">' + esc(b.category) + " &middot; seats up to " + b.capacity + "</p>" +
          '<ul class="boat-features">' + b.features.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
          '<div class="boat-price">' + priceLine + "</div>" +
          "</button>";
      }).join("") +
      "</div>" +
      '<div class="nav-row"><span></span><button type="button" class="btn btn-primary" id="primaryActionBtn" ' +
      (wizard.boatId ? "" : "disabled") + ">Continue &rarr;</button></div>";
    els.stepContent.innerHTML = html;

    Array.prototype.forEach.call(els.stepContent.querySelectorAll(".boat-card"), function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-boat");
        if (wizard.boatId !== id) {
          wizard.boatId = id;
          wizard.people = 1;
          wizard.addonIds = [];
        }
        saveWizard();
        renderBoatStep();
        updateSummaryPanel();
      });
    });
    var primary = document.getElementById("primaryActionBtn");
    primary.addEventListener("click", function () { if (wizard.boatId) goTo("date"); });
    wireBottomBar(primary);
  }

  /* ---------------- Step 2: date & time ---------------- */
  function renderDateStep() {
    var boat = SBR.getBoat(wizard.boatId);
    var today = SBR.todayAtMidnight();
    var isCurrentMonth = wizard.calYear === today.getFullYear() && wizard.calMonth === today.getMonth();
    var monthLabel = SBR.MONTH_NAMES[wizard.calMonth] + " " + wizard.calYear;

    var firstOfMonth = new Date(wizard.calYear, wizard.calMonth, 1);
    var startWeekday = firstOfMonth.getDay();
    var daysInMonth = new Date(wizard.calYear, wizard.calMonth + 1, 0).getDate();
    var bookings = SBR.getBookings();

    var cells = [];
    for (var e = 0; e < startWeekday; e++) cells.push({ empty: true });
    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(wizard.calYear, wizard.calMonth, d);
      var dateStr = SBR.fmtDateStr(dateObj);
      cells.push({
        day: d,
        dateStr: dateStr,
        past: SBR.isPastDateStr(dateStr),
        hasBooking: SBR.dateHasAnyBooking(dateStr, bookings),
        selected: wizard.date === dateStr
      });
    }

    var gridHtml = SBR.DOW_NAMES.map(function (n) { return '<div class="cal-dow">' + n + "</div>"; }).join("") +
      cells.map(function (c) {
        if (c.empty) return '<div class="cal-day empty" aria-hidden="true"></div>';
        var cls = "cal-day";
        if (c.past) cls += " disabled";
        if (c.hasBooking) cls += " has-booking";
        if (c.selected) cls += " selected";
        var label = SBR.MONTH_NAMES[wizard.calMonth] + " " + c.day + ", " + wizard.calYear + (c.hasBooking ? " (has bookings)" : "");
        return '<button type="button" class="' + cls + '" data-date="' + c.dateStr + '" ' +
          (c.past ? "disabled" : "") + ' aria-pressed="' + !!c.selected + '" aria-label="' + esc(label) + '">' + c.day + "</button>";
      }).join("");

    var slotHtml = "";
    if (wizard.date) {
      slotHtml = "<h2>Pick a time</h2><div class=\"slot-grid\">" +
        SBR.SLOTS.map(function (s) {
          var avail = SBR.availability(wizard.boatId, wizard.date, s.id);
          var disabled = avail <= 0;
          var selected = wizard.slot === s.id ? " selected" : "";
          var note = disabled ? "Fully booked" : (SBR.priceForSlot(boat, s.id) ? SBR.money(SBR.priceForSlot(boat, s.id)) + (boat.priceMode === "perPerson" ? "/person" : "") : "");
          return '<button type="button" class="slot-btn' + selected + '" data-slot="' + s.id + '" ' + (disabled ? "disabled" : "") +
            '><span class="slot-time">' + esc(s.label) + "</span><span class=\"slot-note\">" + esc(s.time) + " &middot; " + note + "</span></button>";
        }).join("") + "</div>";
    }

    els.stepContent.innerHTML =
      "<h1>Pick a date &amp; time</h1>" +
      '<p class="lede">Booking a ' + esc(boat.name) + ". Dates already busy are marked with a dot; fully booked slots are grayed out.</p>" +
      '<div class="card">' +
      '<div class="cal-header"><button type="button" class="cal-nav-btn" id="calPrev" ' + (isCurrentMonth ? "disabled" : "") +
      ' aria-label="Previous month">&larr;</button><h3>' + monthLabel + '</h3><button type="button" class="cal-nav-btn" id="calNext" aria-label="Next month">&rarr;</button></div>' +
      '<div class="cal-grid" id="calGrid" role="group" aria-label="Choose a date">' + gridHtml + "</div>" +
      '<div class="cal-legend"><span><span class="dot booked"></span> Has other bookings</span><span>Past dates are disabled</span></div>' +
      "</div>" +
      '<div id="slotSection">' + slotHtml + "</div>" +
      '<div class="nav-row"><button type="button" class="btn btn-secondary" id="backBtn">&larr; Back</button>' +
      '<button type="button" class="btn btn-primary" id="primaryActionBtn" ' + (wizard.date && wizard.slot ? "" : "disabled") + ">Continue &rarr;</button></div>";

    document.getElementById("calPrev").addEventListener("click", function () {
      var m = wizard.calMonth - 1, y = wizard.calYear;
      if (m < 0) { m = 11; y--; }
      wizard.calMonth = m; wizard.calYear = y; saveWizard(); renderDateStep();
    });
    document.getElementById("calNext").addEventListener("click", function () {
      var m = wizard.calMonth + 1, y = wizard.calYear;
      if (m > 11) { m = 0; y++; }
      wizard.calMonth = m; wizard.calYear = y; saveWizard(); renderDateStep();
    });
    var grid = document.getElementById("calGrid");
    Array.prototype.forEach.call(grid.querySelectorAll(".cal-day[data-date]"), function (btn) {
      btn.addEventListener("click", function () {
        wizard.date = btn.getAttribute("data-date");
        wizard.slot = null;
        saveWizard();
        renderDateStep();
      });
    });
    wireCalendarKeyboard(grid);

    Array.prototype.forEach.call(els.stepContent.querySelectorAll(".slot-btn"), function (btn) {
      btn.addEventListener("click", function () {
        wizard.slot = btn.getAttribute("data-slot");
        saveWizard();
        renderDateStep();
        updateSummaryPanel();
      });
    });
    document.getElementById("backBtn").addEventListener("click", function () { goTo("boat"); });
    var primary = document.getElementById("primaryActionBtn");
    primary.addEventListener("click", function () { if (wizard.date && wizard.slot) goTo("addons"); });
    wireBottomBar(primary);
  }

  function wireCalendarKeyboard(grid) {
    grid.addEventListener("keydown", function (ev) {
      var keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
      if (keys.indexOf(ev.key) === -1) return;
      var buttons = Array.prototype.slice.call(grid.querySelectorAll(".cal-day[data-date]:not([disabled])"));
      var focusIdx = buttons.indexOf(document.activeElement);
      if (focusIdx === -1) return;
      ev.preventDefault();
      var next = focusIdx;
      if (ev.key === "ArrowLeft") next = Math.max(0, focusIdx - 1);
      else if (ev.key === "ArrowRight") next = Math.min(buttons.length - 1, focusIdx + 1);
      else if (ev.key === "ArrowUp") next = Math.max(0, focusIdx - 7);
      else if (ev.key === "ArrowDown") next = Math.min(buttons.length - 1, focusIdx + 7);
      else if (ev.key === "Home") next = 0;
      else if (ev.key === "End") next = buttons.length - 1;
      buttons[next].focus();
    });
  }

  /* ---------------- Step 3: add-ons & people ---------------- */
  function renderAddonsStep() {
    var boat = SBR.getBoat(wizard.boatId);
    var maxPeople = boat.allowQty ? Math.min(boat.maxQty, boat.capacity) : boat.capacity;
    if (boat.allowQty) {
      var avail = SBR.availability(wizard.boatId, wizard.date, wizard.slot);
      maxPeople = Math.max(1, Math.min(maxPeople, avail));
    }
    if (wizard.people > maxPeople) wizard.people = maxPeople;
    if (wizard.people < 1) wizard.people = 1;

    var peopleLabel = boat.allowQty ? "Number of " + boat.name.toLowerCase() + "s needed" : "Number of people";

    var addonsHtml = SBR.ADDONS.map(function (a) {
      var checked = wizard.addonIds.indexOf(a.id) !== -1;
      return '<label class="addon-row"><span class="addon-info"><input type="checkbox" data-addon="' + a.id + '" ' + (checked ? "checked" : "") + '>' +
        '<span><span class="addon-title">' + esc(a.name) + '</span><span class="addon-desc">' + esc(a.desc) + "</span></span></span>" +
        '<span class="addon-price">' + SBR.money(a.price) + "</span></label>";
    }).join("");

    var ljHtml = SBR.LIFE_JACKET_SIZES.map(function (sz) {
      var val = wizard.lifeJackets[sz.id] || 0;
      return '<div class="field" style="flex:1;min-width:120px"><label for="lj-' + sz.id + '">' + esc(sz.label) + '</label>' +
        '<div class="qty-row"><button type="button" class="qty-btn" data-lj-dec="' + sz.id + '" aria-label="Fewer ' + esc(sz.label) + '">&minus;</button>' +
        '<span class="qty-value" id="lj-' + sz.id + '">' + val + '</span>' +
        '<button type="button" class="qty-btn" data-lj-inc="' + sz.id + '" aria-label="More ' + esc(sz.label) + '">+</button></div></div>';
    }).join("");

    els.stepContent.innerHTML =
      "<h1>Add-ons &amp; party size</h1>" +
      '<p class="lede">' + esc(boat.name) + " on " + esc(wizard.date) + " &middot; " + esc(SBR.getSlot(wizard.slot).label) + "</p>" +
      '<div class="card" style="margin-bottom:1rem"><div class="field" style="margin-bottom:0">' +
      "<label>" + peopleLabel + "</label>" +
      '<div class="qty-row"><button type="button" class="qty-btn" id="peopleDec" aria-label="Fewer people">&minus;</button>' +
      '<span class="qty-value" id="peopleVal">' + wizard.people + '</span>' +
      '<button type="button" class="qty-btn" id="peopleInc" aria-label="More people">+</button>' +
      '<span class="hint">Max ' + maxPeople + '</span></div></div></div>' +
      '<div class="card" style="margin-bottom:1rem"><h2 style="margin-top:0">Add-ons</h2><div class="addon-list">' + addonsHtml + "</div></div>" +
      '<div class="card"><h2 style="margin-top:0">Life jackets needed <small style="font-weight:500;color:var(--ink-soft)">(included, no charge)</small></h2>' +
      '<div style="display:flex;gap:0.75rem;flex-wrap:wrap">' + ljHtml + "</div></div>" +
      '<div class="nav-row"><button type="button" class="btn btn-secondary" id="backBtn">&larr; Back</button>' +
      '<button type="button" class="btn btn-primary" id="primaryActionBtn">Continue &rarr;</button></div>';

    document.getElementById("peopleDec").addEventListener("click", function () {
      wizard.people = Math.max(1, wizard.people - 1); saveWizard(); renderAddonsStep(); updateSummaryPanel();
    });
    document.getElementById("peopleInc").addEventListener("click", function () {
      wizard.people = Math.min(maxPeople, wizard.people + 1); saveWizard(); renderAddonsStep(); updateSummaryPanel();
    });
    Array.prototype.forEach.call(els.stepContent.querySelectorAll("[data-addon]"), function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-addon");
        var i = wizard.addonIds.indexOf(id);
        if (cb.checked && i === -1) wizard.addonIds.push(id);
        if (!cb.checked && i !== -1) wizard.addonIds.splice(i, 1);
        saveWizard();
        updateSummaryPanel();
      });
    });
    Array.prototype.forEach.call(els.stepContent.querySelectorAll("[data-lj-inc]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-lj-inc");
        wizard.lifeJackets[id] = (wizard.lifeJackets[id] || 0) + 1;
        saveWizard();
        document.getElementById("lj-" + id).textContent = wizard.lifeJackets[id];
      });
    });
    Array.prototype.forEach.call(els.stepContent.querySelectorAll("[data-lj-dec]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-lj-dec");
        wizard.lifeJackets[id] = Math.max(0, (wizard.lifeJackets[id] || 0) - 1);
        saveWizard();
        document.getElementById("lj-" + id).textContent = wizard.lifeJackets[id];
      });
    });
    document.getElementById("backBtn").addEventListener("click", function () { goTo("date"); });
    var primary = document.getElementById("primaryActionBtn");
    primary.addEventListener("click", function () { goTo("details"); });
    wireBottomBar(primary);
  }

  /* ---------------- Step 4: details ---------------- */
  function validateDetails(form) {
    var errors = {};
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    if (name.length < 2) errors.name = "Enter the name for this booking.";
    var phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) errors.phone = "Enter a 10-digit phone number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!form.safety.checked) errors.safety = "Please confirm you understand the boater-safety requirement.";
    return errors;
  }

  function renderDetailsStep() {
    var boat = SBR.getBoat(wizard.boatId);
    var c = wizard.customer;
    els.stepContent.innerHTML =
      "<h1>Your details</h1>" +
      '<p class="lede">Last step before your ' + esc(boat.name) + " on " + esc(wizard.date) + " is locked in.</p>" +
      '<form class="card" id="detailsForm" novalidate>' +
      '<div class="field" data-field="name"><label for="f-name">Full name</label>' +
      '<input type="text" id="f-name" name="name" value="' + esc(c.name) + '" required><p class="error-msg"></p></div>' +
      '<div class="field" data-field="phone"><label for="f-phone">Phone</label>' +
      '<input type="tel" id="f-phone" name="phone" value="' + esc(c.phone) + '" placeholder="555-0123" required><p class="error-msg"></p></div>' +
      '<div class="field" data-field="email"><label for="f-email">Email</label>' +
      '<input type="email" id="f-email" name="email" value="' + esc(c.email) + '" placeholder="you@example.com" required><p class="error-msg"></p></div>' +
      '<div class="field" data-field="safety"><label class="checkbox-field"><input type="checkbox" name="safety" ' + (wizard.safetyConfirmed ? "checked" : "") + '>' +
      '<span>I confirm at least one adult aboard holds a valid Kentucky boater education card, as required by the dock.</span></label>' +
      '<p class="error-msg"></p></div>' +
      '<p class="hint">No payment card needed &mdash; you pay at the dock when you arrive.</p>' +
      '<div class="nav-row"><button type="button" class="btn btn-secondary" id="backBtn">&larr; Back</button>' +
      '<button type="submit" class="btn btn-primary" id="primaryActionBtn">Confirm booking</button></div>' +
      "</form>";

    var form = document.getElementById("detailsForm");
    document.getElementById("backBtn").addEventListener("click", function () { goTo("addons"); });

    function liveSave() {
      wizard.customer.name = form.name.value;
      wizard.customer.phone = form.phone.value;
      wizard.customer.email = form.email.value;
      wizard.safetyConfirmed = form.safety.checked;
      saveWizard();
    }
    ["name", "phone", "email", "safety"].forEach(function (n) {
      form[n].addEventListener("input", liveSave);
      form[n].addEventListener("change", liveSave);
    });

    function showErrors(errors) {
      Array.prototype.forEach.call(form.querySelectorAll(".field"), function (fieldEl) {
        var key = fieldEl.getAttribute("data-field");
        var msg = fieldEl.querySelector(".error-msg");
        if (errors[key]) {
          fieldEl.classList.add("error");
          msg.textContent = errors[key];
        } else {
          fieldEl.classList.remove("error");
          msg.textContent = "";
        }
      });
    }

    function submit(ev) {
      if (ev) ev.preventDefault();
      liveSave();
      var errors = validateDetails(form);
      showErrors(errors);
      if (Object.keys(errors).length > 0) {
        var firstKey = Object.keys(errors)[0];
        var firstField = form.querySelector('[data-field="' + firstKey + '"] input');
        if (firstField) firstField.focus();
        return;
      }
      finalizeBooking();
    }
    form.addEventListener("submit", submit);
    var primary = document.getElementById("primaryActionBtn");
    wireBottomBar(primary, submit);
  }

  function finalizeBooking() {
    var bookings = SBR.getBookings();
    var code = SBR.generateCode(bookings);
    var pricing = currentPricing();
    var booking = {
      code: code,
      boatId: wizard.boatId,
      boatName: SBR.getBoat(wizard.boatId).name,
      date: wizard.date,
      slot: wizard.slot,
      people: wizard.people,
      addons: pricing.addonLines,
      lifeJackets: wizard.lifeJackets,
      pricing: pricing,
      customer: { name: wizard.customer.name.trim(), phone: wizard.customer.phone.trim(), email: wizard.customer.email.trim() },
      safetyConfirmed: true,
      status: "booked",
      createdAt: new Date().toISOString(),
      source: "customer"
    };
    bookings.push(booking);
    SBR.saveBookings(bookings);
    wizard.bookingResult = booking;
    saveWizard();
    goTo("confirm");
  }

  /* ---------------- Step 5: confirmation ---------------- */
  function renderConfirmStep() {
    var b = wizard.bookingResult;
    var boat = SBR.getBoat(b.boatId);
    var slot = SBR.getSlot(b.slot);
    var p = b.pricing;

    var addonRows = p.addonLines.length
      ? p.addonLines.map(function (a) { return "<li>" + esc(a.name) + " &mdash; " + SBR.money(a.price) + "</li>"; }).join("")
      : "<li>None</li>";
    var ljRows = SBR.LIFE_JACKET_SIZES.filter(function (sz) { return (b.lifeJackets[sz.id] || 0) > 0; })
      .map(function (sz) { return esc(sz.label) + ": " + b.lifeJackets[sz.id]; }).join(", ") || "Standard assortment";

    els.stepContent.innerHTML =
      '<div class="card confirm-hero">' +
      '<svg class="big-check" viewBox="0 0 64 64" role="img" aria-label="Confirmed"><circle cx="32" cy="32" r="30" fill="#2a8f4b"/><path d="M18 33 L27 42 L46 22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "<h1>You're booked!</h1>" +
      '<p class="lede">Thanks, ' + esc(b.customer.name) + '. Show this code at the dock.</p>' +
      '<div class="booking-code">' + esc(b.code) + "</div>" +
      '<button type="button" class="btn btn-primary" id="icsBtn">Add to calendar (.ics)</button>' +
      "</div>" +
      '<div class="confirm-grid">' +
      '<div class="card"><h2 style="margin-top:0">Booking summary</h2>' +
      "<p><strong>" + esc(boat.name) + "</strong><br>" + esc(b.date) + " &middot; " + esc(slot.label) + " (" + esc(slot.time) + ")<br>Party of " + b.people + "</p>" +
      "<p><strong>Add-ons</strong><ul>" + addonRows + "</ul></p>" +
      "<p><strong>Life jackets</strong><br>" + ljRows + "</p>" +
      "<p><strong>Contact</strong><br>" + esc(b.customer.name) + "<br>" + esc(b.customer.phone) + "<br>" + esc(b.customer.email) + "</p>" +
      "</div>" +
      '<div class="card"><h2 style="margin-top:0">Price &amp; what to bring</h2>' +
      '<div class="summary-line"><span>Rental</span><span>' + SBR.money(p.rental) + "</span></div>" +
      '<div class="summary-line"><span>Add-ons</span><span>' + SBR.money(p.addonsTotal) + "</span></div>" +
      '<div class="summary-line"><span>Tax (6%)</span><span>' + SBR.money(p.tax) + "</span></div>" +
      '<div class="summary-line deposit"><span>Damage deposit<small>Refundable at return</small></span><span>' + SBR.money(p.deposit) + "</span></div>" +
      '<div class="summary-line total"><span>Total &mdash; pay at the dock</span><span>' + SBR.money(p.total) + "</span></div>" +
      "<h3>What to bring</h3><ul class=\"bring-list\"><li>Photo ID for the primary renter</li><li>Boater education card (if required for your age group)</li>" +
      "<li>Swimsuit, towel &amp; sunscreen</li><li>Cash or card &mdash; payment happens at the dock</li></ul>" +
      "</div></div>" +
      '<div class="demo-note">This is a demo &mdash; no booking was made and nothing was sent. Built by Valleyside Electronics LLC.</div>' +
      '<div class="nav-row"><a href="staff.html" class="btn btn-secondary">View staff schedule</a>' +
      '<button type="button" class="btn btn-primary" id="newBookingBtn">Make another booking</button></div>';

    document.getElementById("icsBtn").addEventListener("click", function () { SBR.downloadICS(b); });
    document.getElementById("newBookingBtn").addEventListener("click", function () {
      wizard = defaultWizard();
      SBR.clearWizardState();
      goTo("boat");
    });
  }

  /* ---------------- bottom bar wiring ---------------- */
  function wireBottomBar(primaryBtn, altHandler) {
    els.bottomBarBtn.textContent = primaryBtn.textContent;
    els.bottomBarBtn.disabled = primaryBtn.disabled;
    els.bottomBarBtn.onclick = function () {
      if (altHandler) altHandler();
      else primaryBtn.click();
    };
  }

  /* ---------------- init ---------------- */
  function init() {
    els.stepIndicator = document.getElementById("stepIndicator");
    els.flowLayout = document.getElementById("flowLayout");
    els.stepContent = document.getElementById("stepContent");
    els.summaryPanel = document.getElementById("summaryPanel");
    els.bottomBar = document.getElementById("bottomBar");
    els.bottomBarTotal = document.getElementById("bottomBarTotal");
    els.bottomBarBtn = document.getElementById("bottomBarBtn");

    SBR.ensureSeedData();
    wizard = loadWizard();

    window.addEventListener("hashchange", render);
    if (!location.hash) location.replace("#/boat");
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
