async function init() {
  const fragment = document.createDocumentFragment();
  const identities = await browser.contextualIdentities.query({});

  // Add Default Container option first
  const defaultTr = document.createElement("tr");
  defaultTr.classList.add("menu-item", "hover-highlight");
  defaultTr.setAttribute("data-cookie-store-id", "firefox-default");
  const defaultTd = document.createElement("td");
  defaultTd.innerHTML = Utils.escaped`
      <div class="menu-icon">
        <div class="usercontext-icon"
          data-identity-icon="fingerprint"
          data-identity-color="grey">
        </div>
      </div>
      <span class="menu-text">${browser.i18n.getMessage("defaultContainerLabel")}</span>
      <img alt="" class="page-action-flag flag-img" src="/img/flags/.png"/>
      `;

  defaultTr.appendChild(defaultTd);
  fragment.appendChild(defaultTr);

  Utils.addEnterHandler(defaultTr, async () => {
    const defaultIdentity = Utils.createDefaultContainerIdentity();
    Utils.alwaysOpenInContainer(defaultIdentity);
    window.close();
  });

  for (const identity of identities) {
    const tr = document.createElement("tr");
    tr.classList.add("menu-item", "hover-highlight");
    tr.setAttribute("data-cookie-store-id", identity.cookieStoreId);
    const td = document.createElement("td");
    td.innerHTML = Utils.escaped`
        <div class="menu-icon">
          <div class="usercontext-icon"
            data-identity-icon="${identity.icon}"
            data-identity-color="${identity.color}">
          </div>
        </div>
        <span class="menu-text">${identity.name}</span>
        <img alt="" class="page-action-flag flag-img" src="/img/flags/.png"/>
        `;

    tr.appendChild(td);
    fragment.appendChild(tr);

    Utils.addEnterHandler(tr, async () => {
      Utils.alwaysOpenInContainer(identity);
      window.close();
    });
  }

  const list = document.querySelector("#picker-identities-list");
  list.innerHTML = "";
  list.appendChild(fragment);

  MozillaVPN.handleContainerList(identities);

  // Set the theme
  Utils.applyTheme();
}

init();
