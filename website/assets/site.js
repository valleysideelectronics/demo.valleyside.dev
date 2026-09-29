/* Bluestone Cove Marine demo — small progressive enhancements only.
   The site works without this file. Nothing here makes network requests. */
(function () {
  "use strict";

  /* Mobile menu: the checkbox toggle works without JS; this adds Escape-to-close
     and closes the menu after following an in-page link. */
  var toggle = document.getElementById("nav-toggle");
  if (toggle) {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.checked) {
        toggle.checked = false;
        toggle.focus();
      }
    });
    document.querySelectorAll(".site-nav a").forEach(function (a) {
      a.addEventListener("click", function () { toggle.checked = false; });
    });
  }

  /* Seasonal countdown ("34 days left") */
  document.querySelectorAll("[data-countdown]").forEach(function (el) {
    var parts = el.getAttribute("data-countdown").split("-");
    var target = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var days = Math.round((target - today) / 86400000);
    if (days > 1) el.textContent = "Only " + days + " days left to book.";
    else if (days === 1) el.textContent = "Last day to book tomorrow.";
    else if (days === 0) el.textContent = "Today is the last day to book.";
  });

  /* Gallery filters (hidden without JS, where every project simply shows) */
  var filterBar = document.querySelector("[data-filters]");
  if (filterBar) {
    var projects = document.querySelectorAll("[data-cat]");
    var status = document.getElementById("filter-status");
    filterBar.hidden = false;
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      var f = btn.getAttribute("data-filter");
      filterBar.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      var shown = 0;
      projects.forEach(function (p) {
        var match = f === "all" || p.getAttribute("data-cat").split(" ").indexOf(f) !== -1;
        p.hidden = !match;
        if (match) shown++;
      });
      if (status) status.textContent = "Showing " + shown + " project" + (shown === 1 ? "" : "s") + ".";
    });
  }

  /* Quote form: friendly inline validation + on-page demo confirmation.
     The form uses method="dialog" outside a <dialog>, so even without JS
     the browser validates it and then sends nothing anywhere. */
  var form = document.getElementById("quote-form");
  if (!form) return;

  var success = document.getElementById("quote-success");
  var summaryBox = document.getElementById("form-errors");
  var attempted = false;
  form.noValidate = true;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var d = new Date();
  var todayStr = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  var dateInput = form.elements.namedItem("date");
  if (dateInput) dateInput.min = todayStr;

  // Pre-select a service from ?service=... (links on the Services page use this)
  try {
    var wanted = new URLSearchParams(window.location.search).get("service");
    var select = form.elements.namedItem("service");
    if (wanted && select) {
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === wanted) { select.selectedIndex = i; break; }
      }
    }
  } catch (err) { /* older browsers: ignore */ }

  var fields = ["name", "phone", "email", "make", "model", "boatlength", "service", "date", "message"]
    .map(function (n) { return form.elements.namedItem(n); })
    .filter(Boolean);

  function labelText(el) {
    var l = form.querySelector('label[for="' + el.id + '"]');
    return l ? l.firstChild.textContent.trim() : el.name;
  }

  function messageFor(el) {
    var v = el.validity;
    var val = el.value.trim();
    if (el.name === "phone" && val) {
      var digits = val.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) return "Please enter a 10-digit phone number, like 270-555-0142.";
    }
    if (el.name === "name" && el.required && val.length === 0) return "Please tell us your name.";
    if (v.valueMissing) {
      if (el.name === "phone") return "Please add a phone number so we can call you back.";
      if (el.name === "email") return "Please add your email address.";
      if (el.name === "service") return "Please choose the service you need.";
      return labelText(el) + " is required.";
    }
    if (v.typeMismatch && el.type === "email") return "That email doesn't look quite right. Try name@example.com.";
    if (v.tooShort) return "Please enter at least " + el.minLength + " characters.";
    if (v.tooLong) return "Please keep this under " + el.maxLength + " characters.";
    if (v.rangeUnderflow || v.rangeOverflow) {
      if (el.name === "boatlength") return "Boat length should be between " + el.min + " and " + el.max + " feet.";
      if (el.name === "date") return "Please pick today or a later date.";
    }
    if (v.patternMismatch && el.name === "phone") return "Please enter a 10-digit phone number, like 270-555-0142.";
    if (v.badInput) return "Please enter a valid value.";
    if (!v.valid) return "Please check this field.";
    return "";
  }

  function check(el) {
    var msg = messageFor(el);
    var err = document.getElementById(el.id + "-error");
    if (err) err.textContent = msg;
    if (msg) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
    return msg;
  }

  fields.forEach(function (el) {
    el.addEventListener("blur", function () {
      if (attempted || el.value.trim() !== "") check(el);
    });
    el.addEventListener("input", function () {
      if (el.getAttribute("aria-invalid") === "true") check(el);
    });
    el.addEventListener("change", function () {
      if (attempted) check(el);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    attempted = true;
    var problems = [];
    fields.forEach(function (el) {
      var msg = check(el);
      if (msg) problems.push({ el: el, msg: msg });
    });

    if (problems.length) {
      var list = summaryBox.querySelector("ul");
      list.innerHTML = "";
      problems.forEach(function (p) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + p.el.id;
        a.textContent = p.msg;
        a.addEventListener("click", function (ev) { ev.preventDefault(); p.el.focus(); });
        li.appendChild(a);
        list.appendChild(li);
      });
      summaryBox.querySelector("p").textContent =
        problems.length === 1 ? "Please fix 1 thing before sending:" : "Please fix " + problems.length + " things before sending:";
      summaryBox.hidden = false;
      summaryBox.focus();
      return;
    }

    summaryBox.hidden = true;
    var sel = form.elements.namedItem("service");
    var boat = [form.elements.namedItem("make").value, form.elements.namedItem("model").value].map(function (s) { return s.trim(); }).filter(Boolean).join(" ");
    var len = form.elements.namedItem("boatlength").value.trim();
    if (len) boat = (boat ? boat + ", " : "") + len + " ft";
    var dateVal = dateInput && dateInput.value;
    var nice = "";
    if (dateVal) {
      var p = dateVal.split("-");
      nice = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }
    var first = form.elements.namedItem("name").value.trim().split(/\s+/)[0];

    success.querySelector("[data-first]").textContent = first;
    var out = {
      service: sel.options[sel.selectedIndex].text,
      boat: boat || "Not provided",
      date: nice || "Flexible",
      phone: form.elements.namedItem("phone").value.trim(),
      email: form.elements.namedItem("email").value.trim()
    };
    Object.keys(out).forEach(function (k) {
      var dd = success.querySelector('[data-out="' + k + '"]');
      if (dd) dd.textContent = out[k];
    });

    form.hidden = true;
    success.hidden = false;
    success.focus();
    success.scrollIntoView({ block: "start" });
  });

  var again = document.getElementById("quote-again");
  if (again) {
    again.addEventListener("click", function () {
      form.reset();
      attempted = false;
      fields.forEach(function (el) {
        el.removeAttribute("aria-invalid");
        var err = document.getElementById(el.id + "-error");
        if (err) err.textContent = "";
      });
      success.hidden = true;
      form.hidden = false;
      form.elements.namedItem("name").focus();
    });
  }
})();
