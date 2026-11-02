let allProjects = [];
let activeCategory = "All";

fetch("projects.json")
  .then(res => res.json())
  .then(data => {
    allProjects = data;
    // renderFilters();
    renderProjects();
  });

fetch("updates.json")
  .then(res => res.json())
  .then(renderUpdates);

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
