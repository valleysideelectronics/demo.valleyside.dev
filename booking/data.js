/* Sunfish Bay Rentals — demo data, storage helpers, pricing & ICS.
   Everything here is fictional. No network calls. Plain script (window.SBR). */
(function () {
  "use strict";

  /* ---------------- storage (localStorage with in-memory fallback) ---------------- */
  var memoryStore = {};
  function lsGet(key) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? null : v;
    } catch (e) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    }
  }
  function lsSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      memoryStore[key] = value;
    }
  }
  function lsRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      delete memoryStore[key];
    }
  }

  var sessionMemoryStore = {};
  function ssGet(key) {
    try {
      var v = window.sessionStorage.getItem(key);
      return v === null ? null : v;
    } catch (e) {
      return Object.prototype.hasOwnProperty.call(sessionMemoryStore, key) ? sessionMemoryStore[key] : null;
    }
  }
  function ssSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (e) {
      sessionMemoryStore[key] = value;
    }
  }
  function ssRemove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (e) {
      delete sessionMemoryStore[key];
    }
  }

  function getJSON(getter, key, fallback) {
    var raw = getter(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function setJSON(setter, key, value) {
    setter(key, JSON.stringify(value));
  }

  var KEYS = {
    bookings: "sbr_bookings_v1",
    seedFlag: "sbr_seed_v2",
    wizard: "sbr_wizard_v1"
  };

  /* ---------------- date helpers ---------------- */
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDateStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function parseDateStr(s) {
    var parts = s.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function todayAtMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function addDays(d, n) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }
  function isPastDateStr(s) {
    return parseDateStr(s).getTime() < todayAtMidnight().getTime();
  }
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ---------------- boat illustrations (inline SVG strings) ---------------- */
  function svgWrap(inner) {
    return '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
      '<rect x="0" y="0" width="240" height="140" fill="#eaf7fb" rx="12"/>' +
      '<path d="M0 110 Q30 100 60 110 T120 110 T180 110 T240 110 V140 H0 Z" fill="#bfe9f2"/>' +
      '<path d="M0 122 Q30 114 60 122 T120 122 T180 122 T240 122 V140 H0 Z" fill="#8fd9ea"/>' +
      inner +
      "</svg>";
  }
  function pontoonSVG(seats) {
    var chairs = "";
    var count = Math.min(seats, 6);
    for (var i = 0; i < count; i++) {
      var x = 55 + i * 22;
      chairs += '<rect x="' + x + '" y="78" width="14" height="14" rx="3" fill="#ffb703"/>';
    }
    return svgWrap(
      '<rect x="40" y="88" width="160" height="22" rx="6" fill="#7a5230"/>' +
      '<rect x="34" y="70" width="8" height="40" rx="3" fill="#4f3620"/>' +
      '<rect x="198" y="70" width="8" height="40" rx="3" fill="#4f3620"/>' +
      '<rect x="46" y="94" width="148" height="6" fill="#5d3d24"/>' +
      chairs +
      '<path d="M70 78 Q120 30 170 78 Z" fill="#ffffff" stroke="#1487a3" stroke-width="3"/>' +
      '<rect x="118" y="50" width="4" height="30" fill="#0a5c6e"/>'
    );
  }
  function skiBoatSVG() {
    return svgWrap(
      '<path d="M30 100 Q40 80 90 78 L190 78 Q210 78 205 100 Q200 112 170 112 L55 112 Q34 112 30 100 Z" fill="#1487a3"/>' +
      '<path d="M60 78 L90 55 Q100 50 112 55 L118 78 Z" fill="#ffffff" stroke="#0a5c6e" stroke-width="2"/>' +
      '<rect x="123" y="60" width="3" height="18" fill="#4f3620"/>' +
      '<path d="M126 60 Q160 55 160 78" fill="none" stroke="#0a5c6e" stroke-width="3"/>' +
      '<rect x="105" y="90" width="60" height="8" rx="3" fill="#ffb703"/>'
    );
  }
  function kayakSVG() {
    return svgWrap(
      '<path d="M25 100 Q30 82 120 82 Q210 82 215 100 Q210 108 120 108 Q30 108 25 100 Z" fill="#e29500"/>' +
      '<path d="M40 100 Q120 92 200 100" fill="none" stroke="#4f3620" stroke-width="2"/>' +
      '<circle cx="120" cy="92" r="7" fill="#0a5c6e"/>' +
      '<rect x="90" y="50" width="6" height="55" fill="#4f3620" transform="rotate(18 93 77)"/>' +
      '<ellipse cx="80" cy="55" rx="12" ry="5" fill="#1487a3" transform="rotate(18 80 55)"/>' +
      '<ellipse cx="108" cy="98" rx="12" ry="5" fill="#1487a3" transform="rotate(18 108 98)"/>'
    );
  }
  function paddleboardSVG() {
    return svgWrap(
      '<ellipse cx="120" cy="100" rx="95" ry="14" fill="#6fd0e0" stroke="#0a5c6e" stroke-width="2"/>' +
      '<circle cx="120" cy="100" r="4" fill="#0a5c6e"/>' +
      '<rect x="150" y="35" width="5" height="65" fill="#4f3620"/>' +
      '<ellipse cx="150" cy="30" rx="10" ry="5" fill="#1487a3"/>' +
      '<circle cx="150" cy="70" r="10" fill="#ffe9b3" stroke="#e29500" stroke-width="2"/>'
    );
  }

  /* ---------------- boats ---------------- */
  var BOATS = [
    {
      id: "pontoon8",
      name: "Pontoon 8",
      category: "Pontoon Boat",
      capacity: 8,
      priceMode: "flat",
      priceHalf: 225,
      priceFull: 350,
      deposit: 150,
      inventory: 1,
      features: ["Seats 8", "Bimini shade top", "Bluetooth speaker", "Swim ladder"],
      svg: pontoonSVG(8)
    },
    {
      id: "pontoon10",
      name: "Pontoon 10",
      category: "Pontoon Boat",
      capacity: 10,
      priceMode: "flat",
      priceHalf: 265,
      priceFull: 410,
      deposit: 150,
      inventory: 1,
      features: ["Seats 10", "Bimini shade top", "Bluetooth speaker", "Onboard cooler rack"],
      svg: pontoonSVG(10)
    },
    {
      id: "pontoon12",
      name: "Pontoon 12",
      category: "Pontoon Boat",
      capacity: 12,
      priceMode: "flat",
      priceHalf: 310,
      priceFull: 475,
      deposit: 200,
      inventory: 1,
      features: ["Seats 12", "Double bimini top", "Bluetooth speaker", "Large swim platform"],
      svg: pontoonSVG(12)
    },
    {
      id: "skiboat",
      name: "Wake & Ski Boat",
      category: "Ski Boat",
      capacity: 6,
      priceMode: "flat",
      priceHalf: 295,
      priceFull: 450,
      deposit: 250,
      inventory: 1,
      features: ["Wakeboard tower", "Ski rope & vest included", "Bimini top"],
      svg: skiBoatSVG()
    },
    {
      id: "kayak",
      name: "Single Kayak",
      category: "Kayak",
      capacity: 1,
      priceMode: "perPerson",
      priceHalf: 35,
      priceFull: 55,
      deposit: 0,
      inventory: 6,
      allowQty: true,
      maxQty: 6,
      features: ["Sit-on-top", "Paddle & vest included", "Dry bag on request"],
      svg: kayakSVG()
    },
    {
      id: "paddleboard",
      name: "Paddleboard",
      category: "Paddleboard",
      capacity: 1,
      priceMode: "perPerson",
      priceHalf: 30,
      priceFull: 45,
      deposit: 0,
      inventory: 6,
      allowQty: true,
      maxQty: 6,
      features: ["Adjustable paddle", "Ankle leash included", "Beginner-friendly"],
      svg: paddleboardSVG()
    }
  ];

  function getBoat(id) {
    for (var i = 0; i < BOATS.length; i++) if (BOATS[i].id === id) return BOATS[i];
    return null;
  }

  /* ---------------- add-ons & life jacket sizes ---------------- */
  var ADDONS = [
    { id: "tube", name: "Towable Tube", desc: "2-rider inflatable tube with tow rope", price: 25 },
    { id: "cooler", name: "Cooler with Ice", desc: "48-quart cooler packed with ice", price: 12 },
    { id: "fishing", name: "Fishing Gear Set", desc: "2 rods, tackle box, bait bucket", price: 20 }
  ];
  var LIFE_JACKET_SIZES = [
    { id: "youth", label: "Youth" },
    { id: "adultSM", label: "Adult S/M" },
    { id: "adultLXL", label: "Adult L/XL" }
  ];

  /* ---------------- time slots ---------------- */
  var SLOTS = [
    { id: "half_am", label: "Morning Half-Day", time: "8:00 AM – 12:00 PM", startH: 8, startM: 0, endH: 12, endM: 0, group: "half_am" },
    { id: "half_pm", label: "Afternoon Half-Day", time: "1:00 PM – 5:00 PM", startH: 13, startM: 0, endH: 17, endM: 0, group: "half_pm" },
    { id: "full", label: "Full Day", time: "8:00 AM – 5:00 PM", startH: 8, startM: 0, endH: 17, endM: 0, group: "full" }
  ];
  function getSlot(id) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === id) return SLOTS[i];
    return null;
  }
  function slotsOverlap(a, b) {
    if (a === b) return true;
    if (a === "full" || b === "full") return true;
    return false;
  }
  function priceForSlot(boat, slotId) {
    return slotId === "full" ? boat.priceFull : boat.priceHalf;
  }

  /* ---------------- bookings storage ---------------- */
  function getBookings() {
    return getJSON(lsGet, KEYS.bookings, []);
  }
  function saveBookings(list) {
    setJSON(lsSet, KEYS.bookings, list);
  }
  function unitsUsed(boat, people) {
    return boat.priceMode === "perPerson" ? Math.max(1, people) : 1;
  }
  function availability(boatId, dateStr, slotId, opts) {
    opts = opts || {};
    var boat = getBoat(boatId);
    if (!boat) return 0;
    // A slot that has already started today can't be booked.
    var slot = getSlot(slotId);
    if (slot && dateStr) {
      var start = parseDateStr(dateStr);
      start.setHours(slot.startH, slot.startM, 0, 0);
      if (start.getTime() <= Date.now()) return 0;
    }
    var bookings = opts.bookings || getBookings();
    var used = 0;
    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      if (b.boatId !== boatId || b.date !== dateStr) continue;
      if (opts.excludeCode && b.code === opts.excludeCode) continue;
      if (b.status === "cancelled") continue;
      if (slotsOverlap(b.slot, slotId)) used += unitsUsed(boat, b.people);
    }
    return Math.max(0, boat.inventory - used);
  }
  function dateHasAnyBooking(dateStr, bookings) {
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].date === dateStr && bookings[i].status !== "cancelled") return true;
    }
    return false;
  }

  function generateCode(existing) {
    var chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    var code;
    var tries = 0;
    do {
      var s = "";
      for (var i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
      code = "SBR-" + s;
      tries++;
    } while (existing.some(function (b) { return b.code === code; }) && tries < 50);
    return code;
  }

  /* ---------------- pricing ---------------- */
  var TAX_RATE = 0.06;
  function computePricing(sel) {
    var boat = getBoat(sel.boatId);
    if (!boat) return null;
    var basePrice = priceForSlot(boat, sel.slot);
    var rental = boat.priceMode === "perPerson" ? basePrice * Math.max(1, sel.people) : basePrice;
    var addonLines = (sel.addonIds || []).map(function (id) {
      var a = ADDONS.filter(function (x) { return x.id === id; })[0];
      return a ? { id: a.id, name: a.name, price: a.price } : null;
    }).filter(Boolean);
    var addonsTotal = addonLines.reduce(function (sum, a) { return sum + a.price; }, 0);
    var subtotal = rental + addonsTotal;
    var tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    var deposit = boat.deposit;
    var total = Math.round((subtotal + tax + deposit) * 100) / 100;
    return {
      rental: rental,
      addonLines: addonLines,
      addonsTotal: addonsTotal,
      subtotal: subtotal,
      tax: tax,
      deposit: deposit,
      total: total
    };
  }
  function money(n) {
    return "$" + n.toFixed(2);
  }

  /* ---------------- ICS generation ---------------- */
  function icsDate(dateStr, hour, minute) {
    var d = parseDateStr(dateStr);
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "T" + pad2(hour) + pad2(minute) + "00";
  }
  function buildICS(booking) {
    var boat = getBoat(booking.boatId);
    var slot = getSlot(booking.slot);
    var dtStart = icsDate(booking.date, slot.startH, slot.startM);
    var dtEnd = icsDate(booking.date, slot.endH, slot.endM);
    var now = new Date();
    var stamp = now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) + "T" +
      pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + "Z";
    var summary = "Sunfish Bay Rentals - " + boat.name + " (" + slot.label + ")";
    var desc = "Booking code " + booking.code + ". " + boat.name + ", " + slot.time +
      ". Party of " + booking.people + ". Pay at the dock. This is a demo booking - nothing was actually reserved.";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Valleyside Electronics LLC//Sunfish Bay Rentals Demo//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + booking.code + "@demo.valleyside.dev",
      "DTSTAMP:" + stamp,
      "DTSTART:" + dtStart,
      "DTEND:" + dtEnd,
      "SUMMARY:" + summary,
      "DESCRIPTION:" + desc,
      "LOCATION:Sunfish Bay Rentals Dock\\, Kentucky",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.join("\r\n") + "\r\n";
  }
  function downloadICS(booking) {
    var content = buildICS(booking);
    var blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = booking.code + "-sunfish-bay-rentals.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ---------------- seed data ---------------- */
  function buildSeedBookings() {
    var today = todayAtMidnight();
    var seeds = [
      { offset: 1, boatId: "pontoon10", slot: "full", people: 6, customer: "Jared M." },
      { offset: 2, boatId: "pontoon8", slot: "half_am", people: 4, customer: "Casey R." },
      { offset: 2, boatId: "skiboat", slot: "half_pm", people: 3, customer: "Morgan T." },
      { offset: 4, boatId: "pontoon12", slot: "full", people: 10, customer: "Whitaker family" },
      { offset: 5, boatId: "kayak", slot: "half_am", people: 3, customer: "Ellis group" },
      { offset: 6, boatId: "pontoon10", slot: "half_pm", people: 5, customer: "Nguyen party" },
      { offset: 8, boatId: "skiboat", slot: "full", people: 5, customer: "Baker group" },
      { offset: 9, boatId: "pontoon8", slot: "full", people: 8, customer: "Rowan reunion" },
      { offset: 12, boatId: "paddleboard", slot: "half_pm", people: 2, customer: "Kimble sisters" },
      { offset: 14, boatId: "pontoon10", slot: "half_am", people: 6, customer: "Ferris crew" },
      { offset: -2, boatId: "pontoon8", slot: "full", people: 7, customer: "Ada P.", status: "returned" },
      { offset: -1, boatId: "skiboat", slot: "half_am", people: 4, customer: "Colt B.", status: "returned" },
      { offset: 0, boatId: "kayak", slot: "half_pm", people: 2, customer: "Reyes pair", status: "checked-out" }
    ];
    var list = [];
    seeds.forEach(function (s) {
      var boat = getBoat(s.boatId);
      var d = addDays(today, s.offset);
      var dateStr = fmtDateStr(d);
      var pricing = computePricing({ boatId: s.boatId, slot: s.slot, people: s.people, addonIds: [] });
      list.push({
        code: generateCode(list),
        boatId: s.boatId,
        boatName: boat.name,
        date: dateStr,
        slot: s.slot,
        people: s.people,
        addons: [],
        lifeJackets: {},
        pricing: pricing,
        customer: { name: s.customer, phone: "555-0142", email: "guest@example.com" },
        safetyConfirmed: true,
        status: s.status || "booked",
        createdAt: new Date().toISOString(),
        source: "seed"
      });
    });
    return list;
  }
  function ensureSeedData() {
    var flag = lsGet(KEYS.seedFlag);
    if (flag) return;
    saveBookings(buildSeedBookings());
    lsSet(KEYS.seedFlag, "1");
  }
  function resetDemoData() {
    lsRemove(KEYS.bookings);
    lsRemove(KEYS.seedFlag);
    ssRemove(KEYS.wizard);
    ensureSeedData();
  }

  /* ---------------- wizard sessionStorage ---------------- */
  function getWizardState() {
    return getJSON(ssGet, KEYS.wizard, null);
  }
  function saveWizardState(state) {
    setJSON(ssSet, KEYS.wizard, state);
  }
  function clearWizardState() {
    ssRemove(KEYS.wizard);
  }

  window.SBR = {
    KEYS: KEYS,
    BOATS: BOATS,
    ADDONS: ADDONS,
    LIFE_JACKET_SIZES: LIFE_JACKET_SIZES,
    SLOTS: SLOTS,
    MONTH_NAMES: MONTH_NAMES,
    DOW_NAMES: DOW_NAMES,
    getBoat: getBoat,
    getSlot: getSlot,
    priceForSlot: priceForSlot,
    fmtDateStr: fmtDateStr,
    parseDateStr: parseDateStr,
    todayAtMidnight: todayAtMidnight,
    addDays: addDays,
    isPastDateStr: isPastDateStr,
    getBookings: getBookings,
    saveBookings: saveBookings,
    availability: availability,
    dateHasAnyBooking: dateHasAnyBooking,
    generateCode: generateCode,
    computePricing: computePricing,
    money: money,
    buildICS: buildICS,
    downloadICS: downloadICS,
    ensureSeedData: ensureSeedData,
    resetDemoData: resetDemoData,
    getWizardState: getWizardState,
    saveWizardState: saveWizardState,
    clearWizardState: clearWizardState
  };
})();
