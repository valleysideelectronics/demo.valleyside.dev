/*
 * Demo mode: a believable, entirely fictional roster for showing the console.
 *
 * Opened with ?demo in the address. It runs on its own storage (nothing mixes
 * with a real roster) and a signing key made fresh in memory each visit, so
 * every button works in a pitch without anyone typing a passphrase. The
 * console marks demo mode on every screen.
 *
 * Names are generated from common first and last names; phone numbers use the
 * 555-01xx range reserved for fiction; emails use example.com. No real person
 * or real membership is represented.
 */
import * as C from "./console-core.js";

// Small deterministic PRNG so the demo looks the same every time it loads.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const FIRST = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
  "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Chris",
  "Lisa", "Daniel", "Nancy", "Matthew", "Betty", "Anthony", "Sandra", "Mark", "Ashley", "Steven", "Emily", "Paul",
  "Donna", "Andrew", "Michelle", "Josh", "Carol", "Kevin", "Amanda", "Brian", "Melissa", "Wes", "Tammy", "Dale", "Rhonda"];
const LAST = ["Adams", "Baker", "Bryant", "Burton", "Campbell", "Collins", "Cooper", "Dalton", "Denney", "Doss",
  "Ellis", "Flynn", "Gibson", "Hale", "Harper", "Hayes", "Hensley", "Jasper", "Keith", "Lawson", "Lee", "Marcum",
  "Meece", "Mills", "Neal", "Owens", "Parker", "Pierce", "Price", "Randall", "Reed", "Roberts", "Russell", "Sears",
  "Shelton", "Sloan", "Tarter", "Turner", "Vaughn", "Walker", "Warren", "Weddle", "Whitis", "Wilson", "York"];
const BOATS = ["Bennington 22 SSBX", "Sea Ray SPX 210", "Tracker Pro Team 175", "Bayliner VR5", "Crest Classic 220",
  "Lund 1875 Crossover", "Chaparral 21 SSi", "Yamaha AR195", "Malibu Wakesetter", "MasterCraft XT22",
  "Avalon LSZ 2385", "Sun Tracker Party Barge", "Ranger Z520", "Nautique G23", "Starcraft EX 22", "Sea-Doo GTX",
  "Cobalt R5", "Tahoe T21", "Godfrey Sweetwater", "Manitou Oasis", "Harris Cruiser 230", "Regal LS4"];
// Fictional businesses only: this copy of the demo is public on demo.valleyside.dev.
const BUSINESS = ["Blue Heron Charters", "Bluestone Cove Marine", "Redbud Party Barges", "Hollow Point Guide Co.",
  "Sunfish Bay Rentals", "Stillwater Fish Guides", "Quarry Bend Boat Detail", "Otter Run Pontoons", "Lantern Bay Tours",
  "Shady Cove Watersports", "Kettle Ridge Outfitters", "Tall Pine Houseboats"];
let businessIdx = 0;

function reg(r) {
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ";
  return `KY ${1000 + Math.floor(r() * 9000)} ${L[Math.floor(r() * L.length)]}${L[Math.floor(r() * L.length)]}`;
}

/**
 * Builds the demo roster, signs every card that should be signed, and writes
 * an activity history that matches, so the charts and timelines are real
 * results of real actions, not drawings.
 */
export async function buildDemo(today) {
  const r = rng(20260924);
  businessIdx = 0;
  const keys = await C.generateKeyPair();
  const signingKey = await C.importPrivate(keys.privatePkcs8);
  const issuer = {
    iss: "coveline-demo", kid: "demo-console", name: "Cove Line Towing", phone: "800-555-0134",
    publicSpki: C.b64(keys.publicSpki), sealed: null, demo: true,
    webBase: "https://example.github.io/card/?demo", revocationUrl: "https://example.github.io/card/revoked.txt",
    message: "",
  };
  const season = C.seasonFor(today);
  const year = season.year;
  const members = [];
  const activity = [];
  const usedNames = new Set();
  const N = 64;

  for (let i = 0; i < N; i++) {
    let name;
    do { name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`; } while (usedNames.has(name));
    usedNames.add(name);
    const roll = r();
    const tier = roll < 0.58 ? "GOLD" : roll < 0.9 ? "ULTIMATE" : "COMMERCIAL";
    const boatCount = tier === "GOLD" ? 1 : tier === "ULTIMATE" ? 1 + Math.floor(r() * 4) : 1 + Math.floor(r() * 3);
    const boats = Array.from({ length: boatCount }, () => ({ name: BOATS[Math.floor(r() * BOATS.length)], reg: reg(r) }));
    const displayName = tier === "COMMERCIAL" ? BUSINESS[businessIdx++ % BUSINESS.length] : name;

    // A handful are on mid-season plans that run out soon: the renewals list.
    // Sign-ups follow the season: a rush when it opens, a second wave before
    // Memorial Day and July 4th, a trickle after.
    const w = r();
    const joinDay = w < 0.42 ? Math.floor(r() * 10) : w < 0.62 ? 55 + Math.floor(r() * 35)
      : w < 0.8 ? 100 + Math.floor(r() * 30) : 130 + Math.floor(r() * 70);
    const issuedD = addDays(season.start, joinDay);
    const shortPlan = r() < 0.14;
    const expires = shortPlan ? addDays(today, 3 + Math.floor(r() * 26)) : season.end;
    const num = `MA-${year}-${String(101 + i).padStart(4, "0")}`;
    const m = {
      id: `demo-${i}`, num, name: displayName, tier, boats, issued: issuedD, expires,
      phone: `606-555-01${String(i % 100).padStart(2, "0")}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    };

    const fate = r();
    if (fate < 0.95 || i < 6) {
      m.token = await C.issueCard(issuer, signingKey, m, issuedD);
      m.signedPayload = JSON.stringify(C.cardPayload(issuer, m));
      const issuedAt = atTime(issuedD, 9 + Math.floor(r() * 8), Math.floor(r() * 60));
      m.issuedAt = issuedAt.toISOString();
      activity.push(C.activityEntry("issued", m, `${tier} card signed`, issuedAt));
      if (r() < 0.93) {
        const sentAt = new Date(issuedAt.getTime() + (5 + r() * 90) * 60000);
        m.sentAt = sentAt.toISOString();
        activity.push(C.activityEntry(r() < 0.7 ? "texted" : "emailed", m, "Card link sent", sentAt));
      }
    }
    members.push(m);
  }

  // A few realistic loose ends: two canceled (one unpublished), one edited
  // since issue, two new sign-ups waiting for a card.
  const issued = members.filter((m) => m.token);
  for (const [idx, published] of [[7, true], [23, false]]) {
    const m = issued[idx];
    m.canceled = true;
    const at = atTime(addDays(today, -(published ? 12 : 1)), 14, 5);
    m.canceledAt = at.toISOString();
    activity.push(C.activityEntry("canceled", m, published ? "Boat sold; membership refunded" : "Payment reversed", at));
  }
  const edited = issued[31];
  edited.phone = "606-555-0199";
  activity.push(C.activityEntry("edited", edited, "Phone number changed", atTime(addDays(today, -2), 11, 20)));
  members.filter((x) => !x.token && !x.canceled).forEach((m, k) => {
    activity.push(C.activityEntry("added", m, "Signed up through the website form", atTime(addDays(today, -(k + 1)), 16, 40)));
  });

  activity.sort((a, b) => a.at.localeCompare(b.at));
  const published = members.filter((m) => m.canceled && m.canceledAt < atTime(addDays(today, -5), 0, 0).toISOString()).map((m) => m.num);
  const rev = { publishedAt: atTime(addDays(today, -11), 9, 30).toISOString(), numbers: published };

  return { issuer, members, activity, rev, signingKey };
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function atTime(iso, h, m) {
  return new Date(`${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`);
}
