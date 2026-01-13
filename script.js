let allProjects = [];
let activeCategory = "All";

fetch("projects.json")
  .then(res => res.json())
  .then(data => {
    allProjects = data;
    renderFilters();
    renderProjects();
  });

function renderFilters() {
  const filters = document.getElementById("filters");
  const categories = new Set(["All"]);

  allProjects.forEach(p =>
    p.category.forEach(c => categories.add(c))
  );

  filters.innerHTML = "";
  categories.forEach(cat => {
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

function renderProjects() {
  const grid = document.getElementById("projects");
  grid.innerHTML = "";

  const filtered = activeCategory === "All"
    ? allProjects
    : allProjects.filter(p => p.category.includes(activeCategory));

  filtered.forEach(p => {
    const div = document.createElement("div");
    div.className = "project";
    div.innerHTML = `
      <img src="${p.cover}" alt="${p.title}">
      <div class="project-meta">
        <div>${p.title}</div>
        <div class="subtitle">${p.category.join(", ")}</div>
      </div>
    `;
    div.onclick = () => {
      window.location.href = `project.html?id=${p.id}`;
    };
    grid.appendChild(div);
  });
}

/* Mobile menu toggle */
document.querySelector(".hamburger").onclick = () => {
  const sidebar = document.querySelector(".sidebar");
  sidebar.style.display =
    sidebar.style.display === "flex" ? "none" : "flex";
};