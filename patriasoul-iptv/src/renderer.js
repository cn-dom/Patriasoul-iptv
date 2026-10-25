const $ = (id) => document.getElementById(id);
const state = {
  items: [],
  view: "all",
  category: "",
  activeId: "",
  hls: null,
  sourceName: "",
  favorites: new Set(JSON.parse(localStorage.getItem("patriasoul-iptv-favorites") || "[]"))
};

const dialog = $("playlistDialog");
const video = $("videoPlayer");
const grid = $("mediaGrid");
const categoryList = $("categoryList");
const search = $("searchInput");

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
  });
}

function parseAttributes(line) {
  const attrs = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let match;
  while ((match = re.exec(line))) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

function parseM3U(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const items = [];
  let pending = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const attrs = parseAttributes(line);
      const name = comma >= 0 ? line.slice(comma + 1).trim() : (attrs["tvg-name"] || "Nepoznat naslov");
      pending = {
        name: name || attrs["tvg-name"] || "Nepoznat naslov",
        group: attrs["group-title"] || attrs["category"] || "Ostalo",
        logo: attrs["tvg-logo"] || "",
        tvgId: attrs["tvg-id"] || "",
        attrs: attrs
      };
    } else if (!line.startsWith("#") && pending) {
      if (/^(https?:\/\/|file:\/\/)/i.test(line)) {
        items.push({id: items.length + "-" + hashCode(line), name: pending.name, group: pending.group, logo: pending.logo, tvgId: pending.tvgId, attrs: pending.attrs, url: line});
      }
      pending = null;
    } else if (!line.startsWith("#") && /^(https?:\/\/|file:\/\/)/i.test(line)) {
      items.push({id: items.length + "-" + hashCode(line), name: line.split("/").pop() || "Stream", group: "Ostalo", logo: "", url: line, attrs: {}});
    }
  }
  return items;
}

function showNotice(message, type) {
  const notice = $("notice");
  notice.textContent = message;
  notice.className = "notice " + (type || "");
  notice.hidden = !message;
}

function saveFavorites() {
  localStorage.setItem("patriasoul-iptv-favorites", JSON.stringify(Array.from(state.favorites)));
  $("favoriteCount").textContent = state.favorites.size;
  renderGrid();
}

function setLoadedStatus(count) {
  const status = $("playlistStatus");
  status.classList.add("ready");
  status.innerHTML = "<i></i> " + escapeHtml(state.sourceName) + " · " + count.toLocaleString("hr-HR") + " zapisa";
  $("allCount").textContent = count.toLocaleString("hr-HR");
}

function loadPlaylistText(text, sourceName) {
  const parsed = parseM3U(text);
  if (!parsed.length) {
    showNotice("U ovoj datoteci nisu pronađeni prepoznatljivi M3U zapisi s URL-ovima. Provjeri je li odabrana ispravna M3U/M3U8 lista.", "error");
    return false;
  }
  state.items = parsed;
  state.sourceName = sourceName;
  state.view = "all";
  state.category = "";
  state.activeId = "";
  stopPlayback();
  $("currentTitle").textContent = "Odaberi kanal ili naslov";
  $("currentMeta").textContent = parsed.length.toLocaleString("hr-HR") + " zapisa učitano iz " + sourceName;
  $("playerFrame").classList.remove("playing");
  $("playerPlaceholder").hidden = false;
  $("nowPlaying").hidden = true;
  setLoadedStatus(parsed.length);
  renderCategories();
  renderGrid();
  showNotice("Učitano " + parsed.length.toLocaleString("hr-HR") + " zapisa. Odaberi naslov za reprodukciju.", "success");
  dialog.close();
  return true;
}

function stopPlayback() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function startPlayback(item) {
  if (!item || !item.url) return;
  state.activeId = item.id;
  stopPlayback();
  $("playerFrame").classList.add("playing");
  $("playerPlaceholder").hidden = true;
  $("nowPlaying").hidden = false;
  $("nowPlayingTitle").textContent = item.name;
  $("currentTitle").textContent = item.name;
  $("currentMeta").textContent = [item.group, item.tvgId].filter(Boolean).join(" · ") || "Stream iz tvoje playliste";
  updateCurrentFavoriteButton();
  renderGrid();

  const isHls = /\.m3u8(?:$|[?#])/i.test(item.url);
  if (isHls && window.Hls && window.Hls.isSupported()) {
    state.hls = new window.Hls({enableWorker: true, lowLatencyMode: false});
    state.hls.loadSource(item.url);
    state.hls.attachMedia(video);
    state.hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
      video.play().catch(function() { showNotice("Stream je učitan. Klikni ▶ na playeru ako se reprodukcija nije pokrenula automatski."); });
    });
    state.hls.on(window.Hls.Events.ERROR, function(_event, data) {
      if (data.fatal) showNotice("Stream se ne može reproducirati ili je trenutačno nedostupan. Pokušaj drugi naslov ili provjeri izvor.", "error");
    });
  } else {
    video.src = item.url;
    video.play().catch(function() {
      showNotice("Preglednik nije mogao pokrenuti ovaj stream. Izvor možda nije dostupan ili format nije podržan. Pokušaj drugi naslov.", "error");
    });
  }
}

function updateCurrentFavoriteButton() {
  const button = $("currentFavoriteBtn");
  const active = state.favorites.has(state.activeId);
  button.textContent = active ? "★" : "☆";
  button.classList.toggle("selected", active);
  button.title = active ? "Ukloni iz omiljenih" : "Dodaj u omiljene";
}

function toggleFavorite(id) {
  if (!id) return;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavorites();
  updateCurrentFavoriteButton();
}

function renderCategories() {
  const counts = new Map();
  for (const item of state.items) counts.set(item.group || "Ostalo", (counts.get(item.group || "Ostalo") || 0) + 1);
  const categories = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "hr"));
  categoryList.innerHTML = categories.length
    ? categories.map(function(entry) {
        return '<button class="category-button ' + (state.category === entry[0] ? "active" : "") + '" data-category="' + escapeHtml(entry[0]) + '"><span>▸</span><span>' + escapeHtml(entry[0]) + '</span><span class="category-count">' + entry[1].toLocaleString("hr-HR") + '</span></button>';
      }).join("")
    : '<p class="empty-note">Učitaj M3U listu za prikaz kategorija.</p>';
  categoryList.querySelectorAll("[data-category]").forEach(function(button) {
    button.addEventListener("click", function() {
      state.category = state.category === button.dataset.category ? "" : button.dataset.category;
      state.view = "all";
      document.querySelectorAll(".nav-item").forEach(function(el) { el.classList.toggle("active", el.dataset.view === "all"); });
      renderCategories();
      renderGrid();
    });
  });
}

function visibleItems() {
  const query = search.value.trim().toLocaleLowerCase("hr");
  return state.items.filter(function(item) {
    if (state.view === "favorites" && !state.favorites.has(item.id)) return false;
    if (state.category && item.group !== state.category) return false;
    if (query && !(item.name + " " + item.group + " " + item.tvgId).toLocaleLowerCase("hr").includes(query)) return false;
    return true;
  });
}

function renderGrid() {
  const items = visibleItems();
  $("favoriteCount").textContent = state.favorites.size;
  $("listHeading").textContent = state.view === "favorites" ? "Omiljeno" : (state.category || "Svi kanali i naslovi");
  $("listDescription").textContent = state.items.length
    ? items.length.toLocaleString("hr-HR") + " prikazanih od " + state.items.length.toLocaleString("hr-HR") + " zapisa"
    : "Uvezi M3U/M3U8 playlistu za početak.";

  if (!items.length) {
    grid.innerHTML = '<div class="welcome-card"><div class="welcome-icon">' + (state.items.length ? "⌕" : "＋") + '</div><h3>' + (state.items.length ? "Nema rezultata" : "Dodaj svoju playlistu") + '</h3><p>' + (state.items.length ? "Pokušaj promijeniti pojam pretraživanja ili odabranu kategoriju." : "Podržane su lokalne .m3u/.m3u8 datoteke i playlist URL-ovi.") + '</p>' + (state.items.length ? "" : '<button class="button button-secondary" id="gridOpenBtn">Odaberi playlistu</button>') + '</div>';
    const button = $("gridOpenBtn");
    if (button) button.addEventListener("click", openDialog);
    return;
  }

  const displayItems = items.slice(0, 900);
  grid.innerHTML = displayItems.map(function(item) {
    const favorite = state.favorites.has(item.id);
    const active = state.activeId === item.id;
    const initial = (item.name.trim()[0] || "▶").toLocaleUpperCase("hr");
    const logo = item.logo ? '<img src="' + escapeHtml(item.logo) + '" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:8px" onerror="this.remove()">' : escapeHtml(initial);
    return '<article class="media-card ' + (active ? "active" : "") + '" data-id="' + item.id + '" title="' + escapeHtml(item.name) + '">' +
      '<div class="media-icon">' + logo + '</div>' +
      '<div class="media-copy"><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.group || "Ostalo") + '</small></div>' +
      '<button class="card-star ' + (favorite ? "on" : "") + '" data-fav="' + item.id + '" aria-label="' + (favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene") + '" title="Omiljeno">' + (favorite ? "★" : "☆") + '</button></article>';
  }).join("");

  grid.querySelectorAll(".media-card").forEach(function(card) {
    card.addEventListener("click", function(event) {
      if (event.target.closest("[data-fav]")) return;
      const item = state.items.find(function(entry) { return entry.id === card.dataset.id; });
      startPlayback(item);
    });
  });
  grid.querySelectorAll("[data-fav]").forEach(function(button) {
    button.addEventListener("click", function(event) {
      event.stopPropagation();
      toggleFavorite(button.dataset.fav);
    });
  });

  if (items.length > displayItems.length) {
    const more = document.createElement("p");
    more.className = "empty-note";
    more.style.gridColumn = "1 / -1";
    more.textContent = "Prikazano je prvih " + displayItems.length + " rezultata. Upotrijebi pretraživanje za pronalazak ostalih " + (items.length - displayItems.length) + ".";
    grid.appendChild(more);
  }
}

function openDialog() {
  $("dialogError").hidden = true;
  $("playlistUrl").value = "";
  $("playlistFile").value = "";
  $("fileName").textContent = ".m3u ili .m3u8 · lokalna datoteka";
  dialog.showModal();
}

function setDialogError(message) {
  $("dialogError").textContent = message;
  $("dialogError").hidden = false;
}

$("openPlaylistBtn").addEventListener("click", openDialog);
$("emptyOpenBtn").addEventListener("click", openDialog);
$("welcomeOpenBtn").addEventListener("click", openDialog);
$("playlistFile").addEventListener("change", function() {
  const file = $("playlistFile").files[0];
  $("fileName").textContent = file ? file.name : ".m3u ili .m3u8 · lokalna datoteka";
});
$("loadFileBtn").addEventListener("click", async function() {
  const file = $("playlistFile").files[0];
  if (!file) return setDialogError("Najprije odaberi M3U ili M3U8 datoteku.");
  try { loadPlaylistText(await file.text(), file.name); }
  catch (_error) { setDialogError("Datoteku nije bilo moguće pročitati. Pokušaj ponovno."); }
});
$("loadUrlBtn").addEventListener("click", async function() {
  const url = $("playlistUrl").value.trim();
  if (!url) return setDialogError("Zalijepi URL playliste.");
  if (!/^https?:\/\//i.test(url)) return setDialogError("URL mora počinjati s http:// ili https://.");
  $("loadUrlBtn").disabled = true;
  $("loadUrlBtn").textContent = "Učitavanje…";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const text = await response.text();
    if (!loadPlaylistText(text, url)) return;
  } catch (error) {
    setDialogError("Nije moguće preuzeti playlistu (" + error.message + "). Izvor možda blokira zahtjeve iz aplikacije. Pokušaj preuzeti datoteku i učitati je lokalno.");
  } finally {
    $("loadUrlBtn").disabled = false;
    $("loadUrlBtn").textContent = "Učitaj URL";
  }
});
function playAdjacent(direction) {
  if (!state.items.length) {
    showNotice("Najprije učitaj playlistu.", "error");
    return;
  }
  const currentIndex = state.items.findIndex(function(item) { return item.id === state.activeId; });
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : state.items.length - 1)
    : (currentIndex + direction + state.items.length) % state.items.length;
  startPlayback(state.items[nextIndex]);
}

$("previousBtn").addEventListener("click", function() { playAdjacent(-1); });
$("nextBtn").addEventListener("click", function() { playAdjacent(1); });
$("currentFavoriteBtn").addEventListener("click", function() { toggleFavorite(state.activeId); });
document.addEventListener("keydown", function(event) {
  if (event.altKey && event.key === "ArrowLeft") {
    event.preventDefault();
    playAdjacent(-1);
  } else if (event.altKey && event.key === "ArrowRight") {
    event.preventDefault();
    playAdjacent(1);
  }
});
search.addEventListener("input", renderGrid);
document.querySelectorAll(".nav-item").forEach(function(button) {
  button.addEventListener("click", function() {
    state.view = button.dataset.view;
    state.category = "";
    document.querySelectorAll(".nav-item").forEach(function(el) { el.classList.toggle("active", el === button); });
    renderCategories();
    renderGrid();
  });
});
video.addEventListener("error", function() {
  if (state.activeId) showNotice("Reprodukcija nije uspjela. Stream može biti ugašen, geografski ograničen ili u nepodržanom formatu.", "error");
});
video.addEventListener("playing", function() { showNotice("", ""); });
video.addEventListener("ended", function() {
  $("playerFrame").classList.remove("playing");
  $("playerPlaceholder").hidden = false;
  $("nowPlaying").hidden = true;
});

$("favoriteCount").textContent = state.favorites.size;
renderCategories();
renderGrid();
