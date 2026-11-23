let allProjects = [];
let activeCategory = "All";

fetch("projects.json")
  .then(res => res.json())
  .then(data => {
    allProjects = data;
    // renderFilters();
    renderProjects();
  });

/* Updates come from a Google Sheet (columns: Date, Text, Link), which is
   shared as "Anyone with the link can view". The gviz endpoint is
   used (rather than /export) because it sends CORS headers.
   In the Text column, <like this> becomes a link and *like this* becomes
   italic. A row with several <links> lists their URLs in its Link cell
   in the same order, separated by spaces. */
const UPDATES_SHEET_ID = "1ymsjTi-mLdd6X3eZR2odizhe8rLh-V-wGN-Z99vxVqg";
const UPDATES_SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${UPDATES_SHEET_ID}/gviz/tq?tqx=out:csv&headers=1`;

fetch(UPDATES_SHEET_URL)
  .then(res => {
    if (!res.ok) throw new Error(`Updates sheet: HTTP ${res.status}`);
    return res.text();
  })
  .then(csv => renderUpdates(parseUpdatesSheet(csv)))
  .catch(err => console.error(err));

function parseUpdatesSheet(csv) {
  const [header, ...rows] = parseCsv(csv);
  const col = name => header.findIndex(h => h.trim().toLowerCase() === name);
  const dateCol = col("date");
  const textCol = col("text");
  const linkCol = col("link");

  return rows
    .filter(r => (r[textCol] || "").trim())
    .map(r => ({
      date: (r[dateCol] || "").trim(),
      html: updateTextToHtml(r[textCol], r[linkCol] || ""),
    }));
}

function updateTextToHtml(text, links) {
  const urls = links.trim().split(/\s+/).filter(Boolean);
  let next = 0;
  return escapeHtml(text.trim())
    .replace(/&lt;(.+?)&gt;/g, (match, label) => {
      const url = urls[next++];
      return url
        ? `<a href="${escapeHtml(url)}" target="_blank">${label}</a>`
        : label;
    })
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Minimal CSV parser: handles quoted fields with commas, "" and newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function renderUpdates(updates) {
  const list = document.getElementById("updates");
  list.innerHTML = "";

  updates.forEach(u => {
    const div = document.createElement("div");
    div.className = "update";
    div.innerHTML = `
      <div class="update-date">${u.date}</div>
      <p>${u.html}</p>
    `;
    list.appendChild(div);
  });
}

/*
function renderFilters() {
  const filters = document.getElementById("filters");
  const categorySet = new Set();

  allProjects.forEach(p =>
    p.category.forEach(c => categorySet.add(c))
  );

  const sortedCategories = ["All", ...Array.from(categorySet).sort()];

  filters.innerHTML = "";
  sortedCategories.forEach(cat => {
    const span = document.createElement("span");
    span.textContent = cat;
    if (cat === activeCategory) span.classList.add("active");
    span.onclick = () => {
      activeCategory = cat;
      renderFilters();
      renderProjects();
    };
    filters.appendChild(span);
  });
}
*/

function renderProjects() {
  const grid = document.getElementById("projects");
  grid.innerHTML = "";

  const filtered = activeCategory === "All"
    ? allProjects
    : allProjects.filter(p => p.category.includes(activeCategory));

  filtered.forEach(p => {
    const div = document.createElement("div");
    div.className = p.wide ? "project project-wide" : "project";
    const cover = p.wide && p.wideCover ? p.wideCover : p.cover;
    // Spinning atlas carousel (three.js) — disabled, reverted to the plain
    // static cover image. Code kept intact; uncomment to re-enable.
    // const media = p.wide && p.atlasPages
    //   ? `<div class="atlas-scroll" data-pages='${JSON.stringify(p.atlasPages)}'>
    //        <img class="atlas-scroll-poster" src="${cover}" alt="${p.title}">
    //      </div>`
    //   : `<img src="${cover}" alt="${p.title}">`;
    const media = `<img src="${cover}" alt="${p.title}">`;
    div.innerHTML = `
      <div class="project-media">
        ${media}
        <div class="project-hover-image"></div>
      </div>
      <div class="project-meta">
        <div>${p.title}</div>
        <div class="subtitle">${p.category.join(", ")}</div>
      </div>
      <div class="project-hover-tile"></div>
    `;
    div.onclick = () => {
      if (p.open_link) {
        window.open(p.link, "_blank");
      } else {
        window.location.href = `project.html?id=${p.id}`;
      }
    };
    grid.appendChild(div);
  });
}

/* Mobile only: the grid starts collapsed to just the atlas tile (see
   style.css); this toggles the rest. The button's own position in the DOM
   never changes — it just ends up below the rest of the grid once expanded,
   since those tiles reflow in above it. No-op on desktop, where the button
   stays hidden and never receives a click. */
function setupSeeMore(buttonId, listId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.onclick = () => {
    const expanded = document.getElementById(listId).classList.toggle("expanded");
    btn.textContent = expanded ? "See less" : "See more";
  };
}

setupSeeMore("seeMoreBtn", "projects");
// Same idea for the updates column: only the first 3 show until expanded.
setupSeeMore("updatesSeeMoreBtn", "updates");
