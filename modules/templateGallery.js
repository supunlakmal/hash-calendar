const TEMPLATE_GALLERY_JSON_URL = new URL("./template-gallery-links.json", import.meta.url);

function normalizeTemplateGalleryLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      description: String(item.description || "").trim(),
      path: String(item.path || "").trim().replace(/^\/+/, ""),
    }))
    .filter((item) => item.id && item.title && item.description && item.path);
}

function isTemplatePathDateSegment(yearText, monthText, dayText) {
  if (!/^\d{4}$/.test(yearText) || !/^\d{1,2}$/.test(monthText) || !/^\d{1,2}$/.test(dayText)) {
    return false;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getTemplateBasePath(pathname) {
  const safePath = String(pathname || "/");
  const segments = safePath.split("/").filter(Boolean);
  let dateStart = -1;
  for (let i = 0; i <= segments.length - 3; i += 1) {
    if (isTemplatePathDateSegment(segments[i], segments[i + 1], segments[i + 2])) {
      dateStart = i;
      break;
    }
  }
  if (dateStart === -1) {
    if (safePath.endsWith(".html")) {
      const slashIndex = safePath.lastIndexOf("/");
      return slashIndex >= 0 ? safePath.slice(0, slashIndex + 1) || "/" : "/";
    }
    return safePath || "/";
  }
  const baseSegments = segments.slice(0, dateStart);
  return `/${baseSegments.join("/")}${baseSegments.length ? "/" : ""}`;
}

function getTemplateHref(path) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  if (!cleanPath) return window.location.pathname || "/";
  const basePath = getTemplateBasePath(window.location.pathname || "/");
  if (basePath.endsWith("/")) {
    return `${basePath}${cleanPath}`;
  }
  return `${basePath}/${cleanPath}`;
}

export function createTemplateGalleryController({ ui, hiddenClass = "hidden", t } = {}) {
  let templateGalleryLinks = [];
  const translate = typeof t === "function" ? t : (key) => key;

  function render() {
    if (!ui || !ui.templateLinks) return;
    ui.templateLinks.innerHTML = "";
    templateGalleryLinks.forEach((template) => {
      const card = document.createElement("article");
      card.className = "template-card";

      const title = document.createElement("h4");
      title.className = "template-card-title";
      title.textContent = template.title;

      const description = document.createElement("p");
      description.className = "template-card-description";
      description.textContent = template.description;

      const link = document.createElement("a");
      link.className = "template-card-link";
      link.href = getTemplateHref(template.path);
      link.dataset.templateId = template.id;
      link.textContent = translate("template.useTemplate");

      card.append(title, description, link);
      ui.templateLinks.appendChild(card);
    });
  }

  async function loadLinks() {
    try {
      const response = await fetch(TEMPLATE_GALLERY_JSON_URL, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Template gallery JSON load failed: ${response.status}`);
      }
      const payload = await response.json();
      templateGalleryLinks = normalizeTemplateGalleryLinks(payload);
    } catch (error) {
      templateGalleryLinks = [];
      console.error("Template gallery links could not be loaded.", error);
    }
  }

  function openModal() {
    if (!ui || !ui.templateModal) return;
    render();
    ui.templateModal.classList.remove(hiddenClass);
  }

  function closeModal() {
    if (!ui || !ui.templateModal) return;
    ui.templateModal.classList.add(hiddenClass);
  }

  function handleLinkClick(event) {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest(".template-card-link");
    if (!link) return;
    const confirmed = window.confirm(translate("confirm.openTemplate"));
    if (!confirmed) {
      event.preventDefault();
      return;
    }
    closeModal();
  }

  return {
    render,
    loadLinks,
    openModal,
    closeModal,
    handleLinkClick,
  };
}
