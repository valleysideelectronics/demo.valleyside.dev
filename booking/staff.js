/* Sunfish Bay Rentals — staff schedule view. Plain JS. */
(function () {
  "use strict";
  var SBR = window.SBR;

  var state = {
    date: SBR.todayAtMidnight(),
    week: false
  };

  var els = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function slotLabel(id) {
    var s = SBR.getSlot(id);
    return s ? s.label + " (" + s.time + ")" : id;
  }

  function statusLabel(status) {
    return { booked: "Booked", "checked-out": "Checked out", returned: "Returned" }[status] || status;
  }

  function startOfWeek(d) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
  }

  function bookingsForDate(dateStr, bookings) {
    return bookings.filter(function (b) { return b.date === dateStr; }).sort(function (a, b) {
      var sa = SBR.getSlot(a.slot), sb = SBR.getSlot(b.slot);
      return (sa ? sa.startH * 60 + sa.startM : 0) - (sb ? sb.startH * 60 + sb.startM : 0);
    });
  }

  function renderTable(dateStr, bookings) {
    var rows = bookingsForDate(dateStr, bookings);
    if (rows.length === 0) {
      return '<p class="staff-empty">No bookings on ' + esc(dateStr) + ".</p>";
    }
    var body = rows.map(function (b) {
      var actions = "";
      if (b.status === "booked") {
        actions += '<button type="button" data-action="checked-out" data-code="' + esc(b.code) + '">Check out</button>';
      } else if (b.status === "checked-out") {
        actions += '<button type="button" data-action="returned" data-code="' + esc(b.code) + '">Mark returned</button>';
        actions += '<button type="button" data-action="booked" data-code="' + esc(b.code) + '">Undo</button>';
      } else if (b.status === "returned") {
        actions += '<button type="button" data-action="checked-out" data-code="' + esc(b.code) + '">Undo</button>';
      }
      return "<tr>" +
        "<td>" + esc(slotLabel(b.slot)) + "</td>" +
        "<td>" + esc(b.boatName) + "</td>" +
        "<td>" + esc(b.customer.name) + "<br><small>" + esc(b.customer.phone) + "</small></td>" +
        "<td>" + b.people + "</td>" +
        "<td>" + esc(b.code) + "</td>" +
        '<td><span class="status-pill ' + esc(b.status) + '">' + esc(statusLabel(b.status)) + "</span></td>" +
        '<td class="staff-actions">' + actions + "</td>" +
        "</tr>";
    }).join("");
    return '<div class="staff-table-wrap"><table class="staff-table">' +
      "<thead><tr><th>Time</th><th>Boat</th><th>Customer</th><th>Party</th><th>Code</th><th>Status</th><th>Actions</th></tr></thead>" +
      "<tbody>" + body + "</tbody></table></div>";
  }

  function render() {
    var bookings = SBR.getBookings();
    els.dateInput.value = SBR.fmtDateStr(state.date);

    if (!state.week) {
      var dateStr = SBR.fmtDateStr(state.date);
      var heading = "<h2>" + esc(SBR.DOW_NAMES[state.date.getDay()]) + " " + esc(dateStr) + "</h2>";
      els.root.innerHTML = heading + renderTable(dateStr, bookings);
    } else {
      var weekStart = startOfWeek(state.date);
      var html = "";
      for (var i = 0; i < 7; i++) {
        var d = SBR.addDays(weekStart, i);
        var ds = SBR.fmtDateStr(d);
        html += "<h2>" + esc(SBR.DOW_NAMES[d.getDay()]) + " " + esc(ds) + "</h2>" + renderTable(ds, bookings);
      }
      els.root.innerHTML = html;
    }

    Array.prototype.forEach.call(els.root.querySelectorAll("[data-action]"), function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-code");
        var newStatus = btn.getAttribute("data-action");
        var list = SBR.getBookings();
        var found = list.filter(function (b) { return b.code === code; })[0];
        if (found) {
          found.status = newStatus;
          SBR.saveBookings(list);
          render();
        }
      });
    });
  }

  function init() {
    els.root = document.getElementById("scheduleRoot");
    els.dateInput = document.getElementById("dateInput");

    SBR.ensureSeedData();

    document.getElementById("prevBtn").addEventListener("click", function () {
      state.date = SBR.addDays(state.date, state.week ? -7 : -1);
      render();
    });
    document.getElementById("nextBtn").addEventListener("click", function () {
      state.date = SBR.addDays(state.date, state.week ? 7 : 1);
      render();
    });
    document.getElementById("todayBtn").addEventListener("click", function () {
      state.date = SBR.todayAtMidnight();
      render();
    });
    els.dateInput.addEventListener("change", function () {
      if (els.dateInput.value) {
        state.date = SBR.parseDateStr(els.dateInput.value);
        render();
      }
    });
    document.getElementById("weekToggle").addEventListener("change", function (ev) {
      state.week = ev.target.checked;
      render();
    });
    document.getElementById("resetBtn").addEventListener("click", function () {
      if (window.confirm("Reset all demo bookings back to the seeded schedule? This clears anything made in this browser.")) {
        SBR.resetDemoData();
        state.date = SBR.todayAtMidnight();
        render();
      }
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
