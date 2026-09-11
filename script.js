let allProjects = [];
let activeCategory = "All";

fetch("projects.json")
  .then(res => res.json())
  .then(data => {
    allProjects = data;
    // renderFilters();
    renderProjects();
  });

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
    const media = p.wide && p.atlasPages
      ? `<div class="atlas-scroll" data-pages='${JSON.stringify(p.atlasPages)}'>
           <img class="atlas-scroll-poster" src="${cover}" alt="${p.title}">
         </div>`
      : `<img src="${cover}" alt="${p.title}">`;
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

/* Mobile menu toggle */
document.querySelector(".hamburger").onclick = () => {
  const sidebars = document.querySelectorAll(".sidebar");
  const show = sidebars[0].style.display !== "flex";
  sidebars.forEach(sidebar => {
    sidebar.style.display = show ? "flex" : "none";
  });
};