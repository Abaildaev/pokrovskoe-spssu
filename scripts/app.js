/* ==========================================================================
   Покровский СПССУ (с. Семетей) — Interactive App Logic
   ========================================================================== */

(function () {
  "use strict";

  const DATA = window.POKROVSKOE_DATA;

  /* ------------------------------------------------------------------------
     1. Conditional Polyfill Checks (per navbar / tabs / dialog guides)
     ------------------------------------------------------------------------ */
  if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
    import("https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js").catch(() => {});
  }

  /* ------------------------------------------------------------------------
     2. Responsive Navbar with ResizeObserver (per navbar guide)
     ------------------------------------------------------------------------ */
  function initNavbar() {
    const header = document.querySelector(".site-header");
    const inner = document.querySelector(".header-inner");
    const menu = document.getElementById("site-menu");
    if (!header || !inner || !menu) return;

    let lastWidth = header.getBoundingClientRect().width;

    function updateNavLayout() {
      const wasOpen =
        menu.matches(":popover-open") || menu.classList.contains(":popover-open");
      header.classList.add("is-measuring");
      header.classList.add("is-wide");

      const fits = inner.scrollWidth <= inner.clientWidth + 1;

      header.classList.toggle("is-wide", fits);
      if (fits) {
        menu.removeAttribute("popover");
      } else {
        menu.setAttribute("popover", "auto");
        if (wasOpen && typeof menu.showPopover === "function") {
          try {
            menu.showPopover();
          } catch (_) {
            /* ignore if already open */
          }
        }
      }

      requestAnimationFrame(() => {
        header.classList.remove("is-measuring");
      });
    }

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? header.getBoundingClientRect().width;
      const isCurrentlyWide = header.classList.contains("is-wide");
      if (isCurrentlyWide || w > lastWidth) {
        updateNavLayout();
      }
      lastWidth = w;
    });

    ro.observe(header);
    ro.observe(menu);
    updateNavLayout();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateNavLayout);
    }

    // Close popover when a navigation link is clicked in narrow mode
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (!header.classList.contains("is-wide") && typeof menu.hidePopover === "function") {
          try {
            menu.hidePopover();
          } catch (_) {}
        }
      });
    });

    // Update aria-current="page" based on active visible section
    const navLinks = Array.from(menu.querySelectorAll('a[href^="#"]'));
    const sections = navLinks
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      const navObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (!visible.length) return;
          const activeId = "#" + visible[0].target.id;
          navLinks.forEach((a) => {
            if (a.getAttribute("href") === activeId) {
              a.setAttribute("aria-current", "page");
            } else {
              a.removeAttribute("aria-current");
            }
          });
        },
        { rootMargin: "-25% 0px -60% 0px", threshold: [0.1, 0.4] }
      );
      sections.forEach((sec) => navObserver.observe(sec));
    }
  }

  /* ------------------------------------------------------------------------
     3. Accessible Tablists with hidden="until-found" & beforematch (per tabs)
     ------------------------------------------------------------------------ */
  function initTabs() {
    const tabContainers = document.querySelectorAll("[data-tabs]");
    const hasNativeFocusGroup = Object.hasOwn(HTMLElement.prototype, "focusGroup");

    tabContainers.forEach((container) => {
      const tablist = container.querySelector('[role="tablist"], [focusgroup*="tablist"]');
      if (!tablist) return;
      const tabs = Array.from(tablist.querySelectorAll("button"));
      const panels = tabs.map((tab) =>
        container.querySelector(`[role="tabpanel"][aria-labelledby="${tab.id}"]`)
      );

      // Ensure proper ARIA tab roles for browsers without focusgroup support
      if (!hasNativeFocusGroup) {
        tablist.setAttribute("role", "tablist");
        tabs.forEach((tab) => tab.setAttribute("role", "tab"));
      }

      function selectTab(targetTab, { focus = false, scroll = true } = {}) {
        tabs.forEach((tab, idx) => {
          const isSelected = tab === targetTab;
          tab.setAttribute("aria-selected", String(isSelected));
          tab.toggleAttribute("focusgroupstart", isSelected);
          if (!hasNativeFocusGroup) {
            tab.tabIndex = isSelected ? 0 : -1;
          }

          const panel = panels[idx];
          if (panel) {
            if (isSelected) {
              panel.removeAttribute("hidden");
              panel.tabIndex = 0;
            } else {
              panel.setAttribute("hidden", "until-found");
              panel.removeAttribute("tabindex");
            }
          }
        });

        if (scroll) {
          targetTab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
        }
        if (focus) {
          targetTab.focus();
        }
      }

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => selectTab(tab, { focus: false, scroll: true }));

        tab.addEventListener("keydown", (e) => {
          let nextIdx = null;
          if (e.key === "ArrowRight") nextIdx = (index + 1) % tabs.length;
          else if (e.key === "ArrowLeft") nextIdx = (index - 1 + tabs.length) % tabs.length;
          else if (e.key === "Home") nextIdx = 0;
          else if (e.key === "End") nextIdx = tabs.length - 1;

          if (nextIdx !== null) {
            e.preventDefault();
            selectTab(tabs[nextIdx], { focus: true, scroll: true });
          }
        });

        // Support find-in-page revealing hidden="until-found" panels
        const panel = panels[index];
        if (panel) {
          panel.addEventListener("beforematch", () => {
            selectTab(tab, { focus: false, scroll: true });
          });
        }
      });

      const initiallySelected =
        tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
      if (initiallySelected) selectTab(initiallySelected, { focus: false, scroll: false });
    });
  }

  /* ------------------------------------------------------------------------
     4. Interactive Master Plan (Genplan 1:1000)
     ------------------------------------------------------------------------ */
  function initGenplan() {
    const svg = document.getElementById("genplan-svg");
    const inspector = document.getElementById("genplan-inspector");
    const toggleButtons = document.querySelectorAll("[data-layer-toggle]");
    if (!svg || !inspector) return;

    const mapItems = Array.from(svg.querySelectorAll("[data-map-id]"));

    function renderInspector(id) {
      const obj = DATA.mapObjects[id];
      if (!obj) return;

      mapItems.forEach((el) => {
        el.classList.toggle("is-selected", el.getAttribute("data-map-id") === id);
      });

      const rowsHtml = obj.specs
        .map(
          ([k, v]) => `
          <div class="spec-row">
            <dt>${k}</dt>
            <dd>${v}</dd>
          </div>`
        )
        .join("");

      inspector.innerHTML = `
        <div>
          <span class="pill ${obj.badgeClass}">${obj.badge}</span>
        </div>
        <h3>${obj.title}</h3>
        <p style="font-size:0.9rem;color:var(--text-secondary)">${obj.category}</p>
        <div style="padding:0.7rem 0.9rem;border-radius:10px;background:var(--bg-surface-alt);font-weight:700;font-size:0.95rem;" class="tabular">
          Площадь / объём: ${obj.area}
        </div>
        <dl class="spec-dl">${rowsHtml}</dl>
        <p style="font-size:0.9rem;color:var(--text-primary);background:var(--accent-pine-soft);padding:0.85rem;border-radius:10px;">
          ${obj.summary}
        </p>
      `;
    }

    mapItems.forEach((item) => {
      const id = item.getAttribute("data-map-id");
      item.addEventListener("click", () => renderInspector(id));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renderInspector(id);
        if (e.key === " ") e.preventDefault();
      });
      item.addEventListener("keyup", (e) => {
        if (e.key === " ") renderInspector(id);
      });
    });

    toggleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const layerName = btn.getAttribute("data-layer-toggle");
        const isPressed = btn.getAttribute("aria-pressed") === "true";
        const nextPressed = !isPressed;
        btn.setAttribute("aria-pressed", String(nextPressed));

        const layerEl = svg.querySelector(`[data-layer="${layerName}"]`);
        if (layerEl) {
          layerEl.classList.toggle("is-hidden", !nextPressed);
        }
      });
    });

    renderInspector("quarter-male");
  }

  /* ------------------------------------------------------------------------
     5. Interactive Blueprints (House + Main Building Floor 1 & Floor 2)
     ------------------------------------------------------------------------ */
  function initBlueprintGroup(config) {
    const svg = document.getElementById(config.svgId);
    const listWrap = document.getElementById(config.listId);
    const detailBox = document.getElementById(config.detailId);
    if (!svg || !listWrap || !detailBox) return;

    const rooms = config.rooms;
    listWrap.innerHTML = rooms
      .map(
        (r, i) => `
      <button type="button" class="room-btn" data-room-id="${r.id}" aria-pressed="${i === 0}">
        <span><strong>${r.name}</strong></span>
        <span class="pill pill--pine tabular">${r.area}</span>
      </button>`
      )
      .join("");

    const buttons = Array.from(listWrap.querySelectorAll(".room-btn"));
    const svgRooms = Array.from(svg.querySelectorAll("[data-room-id]"));

    function selectRoom(roomId) {
      const room = rooms.find((r) => r.id === roomId) || rooms[0];
      buttons.forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.getAttribute("data-room-id") === room.id));
      });
      svgRooms.forEach((el) => {
        el.classList.toggle("is-active", el.getAttribute("data-room-id") === room.id);
      });
      detailBox.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:0.35rem 0.65rem;margin-block-end:0.45rem;">
          <strong>${room.name}</strong>
          <span class="tabular" style="font-weight:700;color:var(--accent-pine);">${room.area}</span>
        </div>
        <p style="margin-block-end:0.5rem;"><strong>Оснащение:</strong> ${room.equipment}</p>
        <p style="color:var(--text-secondary);"><strong>Логика и безопасность:</strong> ${room.safety}</p>
      `;
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => selectRoom(btn.getAttribute("data-room-id")));
    });

    svgRooms.forEach((el) => {
      const id = el.getAttribute("data-room-id");
      el.addEventListener("click", () => selectRoom(id));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") selectRoom(id);
        if (e.key === " ") e.preventDefault();
      });
      el.addEventListener("keyup", (e) => {
        if (e.key === " ") selectRoom(id);
      });
    });

    selectRoom(rooms[0].id);
  }

  /* ------------------------------------------------------------------------
     6. Staffing & Phasing Simulator
     ------------------------------------------------------------------------ */
  function initSimulator() {
    const phaseBtns = Array.from(document.querySelectorAll("[data-phase-houses]"));
    const slider = document.getElementById("male-houses-slider");
    const sliderValueEl = document.getElementById("male-houses-label");
    const outHouses = document.getElementById("sim-houses");
    const outInHouses = document.getElementById("sim-in-houses");
    const outInCorp = document.getElementById("sim-in-corp");
    const outPedagogues = document.getElementById("sim-pedagogues");
    const outMasters = document.getElementById("sim-masters");
    const outArea = document.getElementById("sim-area");
    const outGenderNote = document.getElementById("sim-gender-note");

    if (!slider || !outHouses) return;

    let totalHouses = 10;

    function recalculate() {
      const maleHouses = Math.min(Number(slider.value), totalHouses);
      const femaleHouses = totalHouses - maleHouses;
      const residentsInHouses = totalHouses * 6;
      const heavyInCorp = 40;
      const waitingOrTransitional = Math.max(0, 100 - heavyInCorp - residentsInHouses);

      const pedagogues = Math.max(1, Math.ceil(residentsInHouses / 30));
      const masters = totalHouses <= 2 ? 1 : totalHouses <= 5 ? 2 : 4;
      const buildArea = totalHouses * 95;

      outHouses.textContent = `${totalHouses} домов`;
      outInHouses.textContent = `${residentsInHouses} чел.`;
      outInCorp.textContent =
        waitingOrTransitional > 0
          ? `${heavyInCorp} + ${waitingOrTransitional} чел.`
          : `${heavyInCorp} чел.`;
      outPedagogues.textContent = `${pedagogues} ст.`;
      outMasters.textContent = `${masters} ст.`;
      outArea.textContent = `${buildArea} м²`;

      sliderValueEl.textContent = `${maleHouses} муж. / ${femaleHouses} жен.`;
      outGenderNote.textContent =
        `Мужские дома: ${maleHouses} (${maleHouses * 6} чел.) · Женские дома: ${femaleHouses} (${femaleHouses * 6} чел.) · ` +
        (waitingOrTransitional > 0
          ? `На этом этапе ${heavyInCorp} человек находятся в постоянном уходе на 2-х этажах А и А¹, а ${waitingOrTransitional} готовятся к переезду на следующем этапе.`
          : `Итог проекта: 40 пациентов в стационарном уходе на 2-х этажах Блоков А и А¹ + 60 самостоятельных жителей в 10 домах.`);
    }

    phaseBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        totalHouses = Number(btn.getAttribute("data-phase-houses"));
        phaseBtns.forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn))
        );
        slider.max = String(totalHouses);
        slider.value = String(Math.floor(totalHouses / 2));
        recalculate();
      });
    });

    slider.addEventListener("input", recalculate);
    recalculate();
  }

  /* ------------------------------------------------------------------------
     7. Render Tables (Staffing + Official Table #2 from Techpassport)
     ------------------------------------------------------------------------ */
  function renderTables() {
    const staffTbody = document.getElementById("staffing-tbody");
    if (staffTbody) {
      staffTbody.innerHTML = DATA.staffingRows
        .map(
          (row) => `
        <tr>
          <th scope="row">${row.role}</th>
          <td data-label="Статус в проекте">${row.status}</td>
          <td data-label="Ориентир ставок" class="tabular">${row.rate}</td>
          <td data-label="Контингент">${row.target}</td>
          <td data-label="Функционал в новой системе">${row.duties}</td>
        </tr>`
        )
        .join("");
    }

    const passportTbody = document.getElementById("passport-tbody");
    if (passportTbody) {
      passportTbody.innerHTML = DATA.passportBuildings
        .map(
          (b) => `
        <tr>
          <th scope="row">${b.litera}</th>
          <td data-label="Наименование">${b.name}</td>
          <td data-label="Конструктив">${b.foundation} / ${b.walls} / ${b.roof}</td>
          <td data-label="Площадь, м²" class="tabular"><strong>${b.area}</strong></td>
          <td data-label="Статус в техпаспорте">
            <span class="pill pill--${b.statusType}">${b.status}</span>
          </td>
          <td data-label="Роль в проекте">${b.role}</td>
        </tr>`
        )
        .join("");
    }
  }

  /* ------------------------------------------------------------------------
     8. Native Lightbox Modal Dialog (per dialog & light-dismiss-a-dialog)
     ------------------------------------------------------------------------ */
  function initLightbox() {
    const dialog = document.getElementById("media-dialog");
    const dialogTitle = document.getElementById("dialog-title");
    const dialogImg = document.getElementById("dialog-img");
    const dialogCaption = document.getElementById("dialog-caption");
    if (!dialog) return;

    document.querySelectorAll("[data-lightbox-src]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        dialogTitle.textContent = trigger.getAttribute("data-lightbox-title") || "Просмотр";
        dialogImg.src = trigger.getAttribute("data-lightbox-src");
        dialogImg.alt = trigger.getAttribute("data-lightbox-title") || "Изображение проекта";
        dialogCaption.textContent = trigger.getAttribute("data-lightbox-caption") || "";
        dialog.showModal();
      });
    });

    // Mandatory fallback for browsers without closedby="any" support (per dialog guide)
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const isOutside = (e) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      dialog.addEventListener("pointerdown", (e) => {
        pressedOutside = isOutside(e);
      });
      dialog.addEventListener("pointerup", (e) => {
        if (pressedOutside && isOutside(e)) dialog.close();
      });
    }

    dialog.addEventListener("close", () => {
      dialog.returnValue = "";
    });
  }

  /* ------------------------------------------------------------------------
     9. Scroll Reveal Fallback (only when view() unsupported & motion allowed)
     ------------------------------------------------------------------------ */
  function initScrollRevealFallback() {
    if (
      !CSS.supports("(animation-timeline: view()) and (animation-range: entry)") &&
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      "IntersectionObserver" in window
    ) {
      const cards = document.querySelectorAll(".reveal-card");
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.animate(
                [
                  { opacity: 0.4, transform: "translateY(14px)" },
                  { opacity: 1, transform: "translateY(0)" }
                ],
                { duration: 380, easing: "ease-out", fill: "forwards" }
              );
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      cards.forEach((c) => io.observe(c));
    }
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    initTabs();
    initGenplan();
    initBlueprintGroup({
      svgId: "house-blueprint-svg",
      listId: "house-room-list",
      detailId: "house-room-detail",
      rooms: DATA.houseRooms
    });
    initBlueprintGroup({
      svgId: "block1-blueprint-svg",
      listId: "block1-room-list",
      detailId: "block1-room-detail",
      rooms: DATA.mainBuildingFloors.block1
    });
    initBlueprintGroup({
      svgId: "block2-blueprint-svg",
      listId: "block2-room-list",
      detailId: "block2-room-detail",
      rooms: DATA.mainBuildingFloors.block2
    });
    initSimulator();
    renderTables();
    initLightbox();
    initScrollRevealFallback();
  });
})();
