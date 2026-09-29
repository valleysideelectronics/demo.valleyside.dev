// Sample data for the fictional "Kettle Ridge Outfitters".
// Every name, SKU, address, phone number (555-01xx) and email (@example.com) is invented.
// Generation is deterministic (seeded PRNG) and relative to the day it runs.

export const TAX_RATE = 0.06;
export const LABOR_RATE = 95;
export const SEED_VERSION = 3;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [sku, name, category, price, cost, stock, reorderPoint, vendor, bin]
const PRODUCTS = [
  ['PFD-A100-RD', 'Type III Adult Vest, Universal — Red', 'Life Jackets & Safety', 34.99, 16.5, 42, 20, 'Kestrel Point Safety', 'A1'],
  ['PFD-A100-BL', 'Type III Adult Vest, Universal — Blue', 'Life Jackets & Safety', 34.99, 16.5, 11, 20, 'Kestrel Point Safety', 'A1'],
  ['PFD-Y220', 'Youth Life Vest, 50–90 lb', 'Life Jackets & Safety', 29.99, 13.2, 18, 12, 'Kestrel Point Safety', 'A2'],
  ['PFD-C140', 'Child Life Vest, 30–50 lb', 'Life Jackets & Safety', 27.99, 12.4, 6, 10, 'Kestrel Point Safety', 'A2'],
  ['PFD-I310', 'Inflatable Belt-Pack PFD, Manual', 'Life Jackets & Safety', 89.0, 47.0, 9, 6, 'Kestrel Point Safety', 'A3'],
  ['SAF-T4-CSH', 'Throwable Cushion, Type IV', 'Life Jackets & Safety', 22.5, 9.8, 25, 10, 'Kestrel Point Safety', 'A3'],
  ['SAF-FX-B1', 'Fire Extinguisher, Marine B-I', 'Life Jackets & Safety', 39.99, 21.0, 14, 8, 'Kestrel Point Safety', 'A4'],
  ['SAF-FLR-4', 'Day/Night Signal Flare Kit (4)', 'Life Jackets & Safety', 44.95, 23.0, 3, 8, 'Kestrel Point Safety', 'A4'],
  ['SAF-AIDK', 'Marine First-Aid Kit, 120 pc', 'Life Jackets & Safety', 32.0, 14.0, 12, 6, 'Kestrel Point Safety', 'A4'],
  ['SAF-HRN', 'Signal Air Horn, 8 oz', 'Life Jackets & Safety', 16.99, 7.1, 20, 10, 'Kestrel Point Safety', 'A5'],

  ['ROD-SP66ML', 'Spinning Rod, 6′6″ Medium-Light', 'Fishing', 59.99, 27.0, 16, 8, 'Hollowpine Tackle Co.', 'F1'],
  ['ROD-CA70MH', 'Casting Rod, 7′0″ Medium-Heavy', 'Fishing', 79.99, 36.0, 10, 6, 'Hollowpine Tackle Co.', 'F1'],
  ['REL-SP2500', 'Spinning Reel, 2500 Size', 'Fishing', 64.99, 30.0, 13, 8, 'Hollowpine Tackle Co.', 'F2'],
  ['REL-BC71', 'Baitcasting Reel, 7.1:1', 'Fishing', 99.99, 48.0, 4, 6, 'Hollowpine Tackle Co.', 'F2'],
  ['LIN-MO10', 'Monofilament Line, 10 lb · 300 yd', 'Fishing', 8.99, 3.1, 48, 24, 'Hollowpine Tackle Co.', 'F3'],
  ['LIN-BR30', 'Braided Line, 30 lb · 150 yd', 'Fishing', 21.99, 9.4, 22, 12, 'Hollowpine Tackle Co.', 'F3'],
  ['LIN-FC12', 'Fluorocarbon Leader, 12 lb · 100 yd', 'Fishing', 14.99, 6.2, 17, 10, 'Hollowpine Tackle Co.', 'F3'],
  ['LUR-CRJ24', 'Crappie Jig Assortment (24)', 'Fishing', 12.99, 4.6, 36, 15, 'Ridgewater Lure Works', 'F4'],
  ['LUR-SPW7', 'Soft Plastic Worms, 7″ (20 pk)', 'Fishing', 6.49, 2.2, 60, 30, 'Ridgewater Lure Works', 'F4'],
  ['LUR-CKSH', 'Crankbait, Shad Pattern, 2″', 'Fishing', 8.49, 3.3, 7, 12, 'Ridgewater Lure Works', 'F4'],
  ['LUR-SPB38', 'Spinnerbait, 3/8 oz, White/Chartreuse', 'Fishing', 7.99, 2.9, 28, 12, 'Ridgewater Lure Works', 'F4'],
  ['TAC-BOX3', 'Tackle Box, 3-Tray', 'Fishing', 24.99, 11.0, 9, 5, 'Hollowpine Tackle Co.', 'F5'],
  ['TAC-NET', 'Landing Net, Rubber Mesh', 'Fishing', 34.99, 15.0, 8, 4, 'Hollowpine Tackle Co.', 'F5'],
  ['TAC-MINB', 'Minnow Bucket, Insulated', 'Fishing', 19.99, 8.0, 11, 6, 'Hollowpine Tackle Co.', 'F5'],
  ['TAC-FK7', 'Fillet Knife, 7″ with Sheath', 'Fishing', 27.5, 11.5, 14, 6, 'Hollowpine Tackle Co.', 'F5'],

  ['BAT-G27DC', 'Marine Battery, Group 27 Deep-Cycle', 'Marine Parts', 169.0, 112.0, 5, 6, 'Brambleton Marine Parts', 'M1'],
  ['BAT-BOX27', 'Battery Box, Group 27, Strap', 'Marine Parts', 18.99, 7.5, 15, 6, 'Brambleton Marine Parts', 'M1'],
  ['PMP-800', 'Bilge Pump, 800 GPH', 'Marine Parts', 42.99, 20.0, 12, 6, 'Brambleton Marine Parts', 'M2'],
  ['PMP-FSW', 'Bilge Float Switch', 'Marine Parts', 24.99, 10.5, 10, 6, 'Brambleton Marine Parts', 'M2'],
  ['LGT-NAV-LED', 'Navigation Light Kit, LED Bow/Stern', 'Marine Parts', 54.99, 26.0, 7, 5, 'Brambleton Marine Parts', 'M3'],
  ['ENG-SPK-M', 'Spark Plug, Marine (single)', 'Marine Parts', 6.99, 2.4, 64, 30, 'Brambleton Marine Parts', 'M4'],
  ['ENG-OIL2S', '2-Stroke Outboard Oil, 1 gal', 'Marine Parts', 29.99, 15.0, 19, 10, 'Brambleton Marine Parts', 'M4'],
  ['ENG-LUB-QT', 'Lower Unit Gear Lube, 1 qt', 'Marine Parts', 17.99, 7.9, 8, 12, 'Brambleton Marine Parts', 'M4'],
  ['ENG-FWS10', 'Fuel Filter / Water Separator, 10 µm', 'Marine Parts', 21.99, 9.2, 13, 8, 'Brambleton Marine Parts', 'M4'],
  ['ENG-PRMB', 'Fuel Line Primer Bulb, 3/8″', 'Marine Parts', 14.49, 5.6, 16, 8, 'Brambleton Marine Parts', 'M4'],
  ['PRP-AL1317', 'Aluminum Prop, 13.25 × 17', 'Marine Parts', 139.0, 82.0, 3, 3, 'Brambleton Marine Parts', 'M5'],

  ['TRM-PRP3', 'Trolling Motor Prop, 3-Blade', 'Trolling Motor', 36.99, 16.0, 6, 4, 'Brambleton Marine Parts', 'T1'],
  ['TRM-PLG', 'Trolling Motor Plug & Receptacle Set', 'Trolling Motor', 32.99, 14.0, 2, 5, 'Brambleton Marine Parts', 'T1'],
  ['TRM-CB60', 'Circuit Breaker, 60 A Manual Reset', 'Trolling Motor', 27.99, 11.8, 9, 5, 'Brambleton Marine Parts', 'T1'],

  ['DCK-LN38', 'Dock Line, 3/8″ × 20′ Braided', 'Dock & Anchor', 16.99, 6.8, 30, 12, 'Foxfire Bay Distributors', 'D1'],
  ['DCK-FND65', 'Boat Fender, 6.5″ × 23″', 'Dock & Anchor', 24.99, 10.9, 14, 8, 'Foxfire Bay Distributors', 'D1'],
  ['DCK-HOOK', 'Telescoping Boat Hook, 4–8′', 'Dock & Anchor', 29.99, 12.5, 10, 5, 'Foxfire Bay Distributors', 'D2'],
  ['ANC-FL14', 'Fluke Anchor, 14 lb Galvanized', 'Dock & Anchor', 64.99, 31.0, 6, 4, 'Foxfire Bay Distributors', 'D2'],
  ['ANC-RP100', 'Anchor Rope, 3/8″ × 100′', 'Dock & Anchor', 26.99, 11.0, 11, 6, 'Foxfire Bay Distributors', 'D2'],

  ['TRL-BRG1', 'Trailer Wheel Bearing Kit, 1″', 'Trailer', 19.99, 8.1, 12, 8, 'Foxfire Bay Distributors', 'R1'],
  ['TRL-LGTK', 'Trailer Light Kit, Submersible LED', 'Trailer', 49.99, 23.0, 4, 5, 'Foxfire Bay Distributors', 'R1'],
  ['TRL-WS20', 'Winch Strap with Hook, 20′', 'Trailer', 21.99, 8.9, 13, 6, 'Foxfire Bay Distributors', 'R2'],
  ['TRL-DPLG', 'Garboard Drain Plug, 1″', 'Trailer', 5.99, 1.8, 40, 20, 'Foxfire Bay Distributors', 'R2'],
];

// [name, type, city]
const CUSTOMERS = [
  ['Dale Whitcomb', 'Retail', 'Kettle Ridge'],
  ['Rhonda Pickering', 'Retail', 'Harbor Bend'],
  ['Marcus Tillery', 'Retail', 'Cedar Gap'],
  ['Janelle Ostrander', 'Retail', 'Kettle Ridge'],
  ['Wes Harlowe', 'Retail', 'Pike Hollow'],
  ['Brenda Kinnaird', 'Retail', 'Harbor Bend'],
  ['Toby Ashworth', 'Retail', 'Wolf Run'],
  ['Carla Venable', 'Retail', 'Cedar Gap'],
  ['Glenn Duvall', 'Retail', 'Kettle Ridge'],
  ['Priya Ramanathan', 'Retail', 'Harbor Bend'],
  ['Luis Carvajal', 'Retail', 'Pike Hollow'],
  ['Tammy Rucker', 'Retail', 'Wolf Run'],
  ['Ethan Brisco', 'Retail', 'Kettle Ridge'],
  ['Nora Faulkner', 'Retail', 'Cedar Gap'],
  ['Curtis Mabry', 'Retail', 'Harbor Bend'],
  ['Shelby Dunaway', 'Retail', 'Pike Hollow'],
  ['Hank Lovell', 'Retail', 'Wolf Run'],
  ['Megan Stroud', 'Retail', 'Kettle Ridge'],
  ['Darnell Pruitt', 'Retail', 'Harbor Bend'],
  ['Ivy Castellanos', 'Retail', 'Cedar Gap'],
  ['Wrenfield Cove Marina', 'Marina', 'Harbor Bend'],
  ['Tanager Bay Boat Rentals', 'Marina', 'Kettle Ridge'],
  ['Hollis Point Guide Service', 'Guide', 'Pike Hollow'],
  ['Pike Hollow Bait & Grill', 'Business', 'Pike Hollow'],
  ['Sycamore Landing Campground', 'Business', 'Wolf Run'],
];

const STREETS = ['Harbor Bend Rd', 'Old Ferry Ln', 'Cedar Gap Pike', 'Sumac Hollow Rd', 'Lakeview Terrace', 'Bluff Point Dr', 'Kettle Ridge Rd', 'Mill Branch Way', 'Wolf Run Trl', 'Heron Cove Ct'];

const JOBS = [
  // [customerIdx, unit, problem, status, tech, daysAgoIn, promiseInDays, notes]
  [0, '16′ aluminum jon boat · 25 hp tiller outboard', 'Surges at idle, hard to start cold', 'in_progress', 'Ray T.', 3, 1, 'Carb bowl had varnish. Rebuild kit on hand.'],
  [4, '55 lb-thrust bow-mount trolling motor', 'No power when switched on', 'checked_in', 'Unassigned', 0, 3, 'Customer says breaker trips under load.'],
  [21, 'Rental pontoon #4 · 60 hp outboard', 'Annual service + lower unit oil change', 'waiting_parts', 'Sam K.', 5, 2, 'Waiting on gear lube restock (ENG-LUB-QT).'],
  [9, '14′ fishing kayak w/ transom trolling motor', 'Prop fouled, shaft wobble', 'ready', 'Sam K.', 4, 0, 'Replaced prop and pin. Test-run OK.'],
  [22, '18′ bass boat · 150 hp outboard', 'Nav lights intermittent, bilge pump not auto-cycling', 'in_progress', 'Ray T.', 2, 1, 'Float switch bad; nav light corrosion at plug.'],
  [12, '2-stroke 9.9 hp kicker motor', 'Winterization (early) + spark plugs', 'checked_in', 'Unassigned', 1, 4, ''],
  [20, 'Marina courtesy skiff · 20 hp outboard', 'Won’t tilt, water in fuel', 'waiting_parts', 'Ray T.', 6, 3, 'Fuel/water separator ordered.'],
  [16, 'Utility trailer (single axle)', 'Wheel bearing noise, lights out', 'ready', 'Sam K.', 3, 0, 'Bearings repacked, new light kit installed.'],
];

export const SERVICE_PRESETS = [
  { desc: 'Diagnostic inspection', hours: 1 },
  { desc: 'Carburetor clean & rebuild', hours: 2.5 },
  { desc: 'Lower unit service (drain, inspect, refill)', hours: 1 },
  { desc: 'Trolling motor electrical troubleshoot', hours: 1.5 },
  { desc: 'Winterization, outboard', hours: 1.5 },
  { desc: 'Trailer bearing repack (per axle)', hours: 1 },
  { desc: 'Water test / sea trial', hours: 0.5 },
];

const TECHS = ['Ray T.', 'Sam K.', 'Unassigned'];
export { TECHS };

function pad(n) { return String(n).padStart(2, '0'); }
export function dayKey(d) { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; }

export function makeSeed(now = new Date()) {
  const rand = mulberry32(20260928);
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const at = (daysAgo, hour, min) => {
    const d = new Date(startOfToday); d.setDate(d.getDate() - daysAgo); d.setHours(hour, min, 0, 0);
    return d;
  };

  const products = PRODUCTS.map((p, i) => ({
    id: 'p' + (i + 1), sku: p[0], name: p[1], category: p[2], price: p[3], cost: p[4],
    stock: p[5], reorder: p[6], vendor: p[7], bin: p[8],
  }));

  const customers = CUSTOMERS.map((c, i) => {
    const [name, type, city] = c;
    const slug = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z ]/g, '').trim().split(/\s+/);
    const email = type === 'Retail' ? `${slug[0]}.${slug[slug.length - 1]}@example.com` : `office.${slug.slice(0, 2).join('')}@example.com`;
    return {
      id: 'c' + (i + 1), name, type, email,
      phone: `(606) 555-01${pad(i + 1)}`,
      address: `${ri(100, 9800)} ${pick(STREETS)}`, city: `${city}, KY`,
      since: at(ri(60, 1400), 12, 0).toISOString(),
      terms: type === 'Retail' ? 'Pay at sale' : 'Net 30',
      notes: type === 'Marina' ? 'Fleet account. PO required on orders over $500.' : type === 'Guide' ? 'Prefers pickup before 7 a.m.' : '',
    };
  });

  // Weighted customer pick: businesses order more often.
  const weighted = [];
  customers.forEach((c) => { const w = c.type === 'Retail' ? 2 : 5; for (let k = 0; k < w; k++) weighted.push(c); });

  const orders = [];
  let orderNo = 10412;
  const minutesToday = Math.max(20, Math.floor((now - startOfToday) / 60000));
  // Day plan: 60 orders across 30 days (index 0 = today)
  const perDay = [];
  for (let d = 0; d < 30; d++) perDay.push(d === 0 ? 3 : 1 + (rand() < 0.5 ? 1 : 0) + (d % 7 === 1 || d % 7 === 2 ? 1 : 0));
  let total = perDay.reduce((a, b) => a + b, 0);
  while (total > 60) { const d = ri(4, 29); if (perDay[d] > 1) { perDay[d]--; total--; } }
  while (total < 60) { const d = ri(1, 29); perDay[d]++; total++; }

  for (let d = 29; d >= 0; d--) {
    const times = [];
    for (let k = 0; k < perDay[d]; k++) {
      let dt;
      if (d === 0) { dt = new Date(now.getTime() - ri(4, Math.min(minutesToday - 1, 420)) * 60000); }
      else dt = at(d, ri(7, 18), ri(0, 59));
      times.push(dt);
    }
    times.sort((a, b) => a - b);
    for (const dt of times) {
      const cust = pick(weighted);
      const isBiz = cust.type !== 'Retail';
      const nLines = ri(1, isBiz ? 5 : 3);
      const used = new Set();
      const items = [];
      for (let k = 0; k < nLines; k++) {
        let p; let guard = 0;
        do { p = pick(products); guard++; } while (used.has(p.id) && guard < 20);
        used.add(p.id);
        const qty = isBiz ? ri(1, p.price < 20 ? 10 : 4) : ri(1, p.price < 20 ? 3 : 1);
        items.push({ productId: p.id, sku: p.sku, name: p.name, qty, price: p.price });
      }
      const channel = pick(['In store', 'In store', 'Online', 'Phone']);
      const fulfillment = channel === 'In store' ? 'pickup' : (rand() < 0.55 ? 'ship' : 'pickup');
      let status;
      if (d === 0) status = 'new';
      else if (d === 1) status = pick(['new', 'packed']);
      else if (d <= 3) status = pick(['packed', fulfillment === 'ship' ? 'shipped' : 'picked_up']);
      else status = fulfillment === 'ship' ? 'shipped' : 'picked_up';
      if (channel === 'In store' && d > 0) status = 'picked_up';
      let payment = isBiz ? (d > 20 ? 'paid' : pick(['on_account', 'on_account', 'paid'])) : 'paid';
      if (!isBiz && channel === 'Phone' && d <= 2) payment = 'unpaid';
      const shipping = fulfillment === 'ship' ? (items.reduce((s, i) => s + i.qty * i.price, 0) > 99 ? 0 : 9.95) : 0;
      orders.push({
        id: 'o' + orderNo, number: orderNo, customerId: cust.id, date: dt.toISOString(), items,
        status, payment, channel, fulfillment, shipping,
        tracking: status === 'shipped' ? `KR${ri(100000, 999999)}SAMPLE` : '',
        note: '',
      });
      orderNo++;
    }
  }

  const jobs = JOBS.map((j, i) => ({
    id: 'j' + (i + 1), number: 1041 + i, customerId: customers[j[0]].id, unit: j[1], problem: j[2],
    status: j[3], tech: j[4], checkedIn: at(j[5], 9, 15 + i * 3).toISOString(),
    promised: at(-j[6], 16, 0).toISOString(), notes: j[7], quoteId: null,
  }));

  const P = (sku) => products.find((p) => p.sku === sku);
  const partLine = (sku, qty) => { const p = P(sku); return { type: 'part', productId: p.id, desc: `${p.name} (${p.sku})`, qty, rate: p.price }; };
  const laborLine = (desc, hours) => ({ type: 'labor', desc, qty: hours, rate: LABOR_RATE });

  const quotes = [
    {
      id: 'q1', number: 2049, customerId: jobs[7].customerId, jobId: 'j8', date: at(3, 10, 5).toISOString(),
      title: 'Trailer bearings and lighting', status: 'invoiced', invoiceId: 'i1',
      lines: [laborLine('Trailer bearing repack (per axle)', 1), laborLine('Trailer wiring repair & light install', 1), partLine('TRL-BRG1', 2), partLine('TRL-LGTK', 1)],
      notes: 'Includes disposal of old grease.',
    },
    {
      id: 'q2', number: 2050, customerId: jobs[0].customerId, jobId: 'j1', date: at(3, 11, 40).toISOString(),
      title: 'Carburetor rebuild, 25 hp tiller', status: 'accepted', invoiceId: null,
      lines: [laborLine('Diagnostic inspection', 1), laborLine('Carburetor clean & rebuild', 2.5), partLine('ENG-SPK-M', 2), partLine('ENG-FWS10', 1)],
      notes: 'Customer approved by phone.',
    },
    {
      id: 'q3', number: 2051, customerId: jobs[4].customerId, jobId: 'j5', date: at(1, 15, 20).toISOString(),
      title: 'Bilge float switch + nav light repair', status: 'sent', invoiceId: null,
      lines: [laborLine('Electrical troubleshoot', 1), laborLine('Replace float switch, rewire nav plug', 1.5), partLine('PMP-FSW', 1), partLine('LGT-NAV-LED', 1)],
      notes: '',
    },
    {
      id: 'q4', number: 2052, customerId: jobs[1].customerId, jobId: 'j2', date: at(0, 9, 0).toISOString(),
      title: 'Trolling motor — no power', status: 'draft', invoiceId: null,
      lines: [laborLine('Trolling motor electrical troubleshoot', 1.5), partLine('TRM-PLG', 1), partLine('TRM-CB60', 1)],
      notes: 'Price assumes motor head is not damaged.',
    },
  ];
  jobs[7].quoteId = 'q1'; jobs[0].quoteId = 'q2'; jobs[4].quoteId = 'q3'; jobs[1].quoteId = 'q4';

  const invoices = [
    {
      id: 'i1', number: 3107, quoteId: 'q1', customerId: quotes[0].customerId, date: at(0, 8, 30).toISOString(),
      due: at(-14, 17, 0).toISOString(), lines: JSON.parse(JSON.stringify(quotes[0].lines)), status: 'unpaid',
      title: quotes[0].title, notes: quotes[0].notes,
    },
  ];

  // Activity feed from recent events
  const activity = [];
  const recent = orders.slice(-8);
  recent.forEach((o) => activity.push({ time: o.date, kind: 'order', text: `Order #${o.number} placed (${o.channel.toLowerCase()})`, href: `#/orders/${o.id}` }));
  activity.push({ time: at(0, 8, 30).toISOString(), kind: 'invoice', text: 'Invoice INV-3107 created from quote Q-2049', href: '#/invoices/i1' });
  activity.push({ time: at(1, 15, 20).toISOString(), kind: 'quote', text: 'Quote Q-2051 sent to customer', href: '#/quotes/q3' });
  activity.push({ time: at(0, 9, 5).toISOString(), kind: 'job', text: 'Job #1042 checked in: trolling motor, no power', href: '#/shop' });
  activity.push({ time: at(1, 13, 10).toISOString(), kind: 'stock', text: 'Low stock: Signal Flare Kit (3 left)', href: '#/inventory?filter=low' });
  activity.sort((a, b) => new Date(b.time) - new Date(a.time));

  return {
    version: SEED_VERSION,
    seededOn: dayKey(now),
    products, customers, orders, jobs, quotes, invoices, activity,
    counters: { order: orderNo, quote: 2053, invoice: 3108, job: 1049, product: products.length + 1, customer: customers.length + 1 },
  };
}
