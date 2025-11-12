/*global getBogusProxy */

const DEFAULT_FAVICON = "/img/blank-favicon.svg";

// eslint-disable-next-line
const CONTAINER_ORDER_STORAGE_KEY = "container-order";

// Default container constants
const DEFAULT_CONTAINER_USER_CONTEXT_ID = "0";
const DEFAULT_CONTAINER_COOKIE_STORE_ID = "firefox-default";

// TODO use export here instead of globals
const Utils = {

  createFavIconElement(url) {
    const imageElement = document.createElement("img");
    imageElement.classList.add("icon", "offpage", "menu-icon");
    imageElement.src = url;
    const loadListener = (e) => {
      e.target.classList.remove("offpage");
      e.target.removeEventListener("load", loadListener);
      e.target.removeEventListener("error", errorListener);
    };
    const errorListener = (e) => {
      e.target.src = DEFAULT_FAVICON;
    };
    imageElement.addEventListener("error", errorListener);
    imageElement.addEventListener("load", loadListener);
    return imageElement;
  },

  // See comment in PR #313 - so far the (hacky) method being used to block proxies is to produce a sufficiently long random address
  getBogusProxy() {
    const bogusFailover = 1;
    const bogusType = "socks4";
    const bogusPort = 9999;
    const bogusUsername = "foo";
    if(typeof window.Utils.pregeneratedString !== "undefined")
    {
      return {type:bogusType, host:`w.${window.Utils.pregeneratedString}.coo`, port:bogusPort, username:bogusUsername, failoverTimeout:bogusFailover};
    }
    else
    {
      // Initialize Utils.pregeneratedString
      window.Utils.pregeneratedString = "";

      // We generate a cryptographically random string (of length specified in bogusLength), but we only do so once - thus negating any time delay caused
      const bogusLength = 8;
      const array = new Uint8Array(bogusLength);
      window.crypto.getRandomValues(array);
      for(let i = 0; i < bogusLength; i++)
      {
        const s = array[i].toString(16);
        if(s.length === 1)
          window.Utils.pregeneratedString += `0${s}`;
        else
          window.Utils.pregeneratedString += s;
      }

      // The only issue with this approach is that if (for some unknown reason) pregeneratedString is not saved, it will result in an infinite loop - but better than a privacy leak!
      return getBogusProxy();
    }
  },

  /**
 * Escapes any occurances of &, ", <, > or / with XML entities.
 *
 * @param {string} str
 *        The string to escape.
 * @return {string} The escaped string.
 */
  escapeXML(str) {
    const replacements = { "&": "&amp;", "\"": "&quot;", "'": "&apos;", "<": "&lt;", ">": "&gt;", "/": "&#x2F;" };
    return String(str).replace(/[&"'<>/]/g, m => replacements[m]);
  },

  /**
 * A tagged template function which escapes any XML metacharacters in
 * interpolated values.
 *
 * @param {Array<string>} strings
 *        An array of literal strings extracted from the templates.
 * @param {Array} values
 *        An array of interpolated values extracted from the template.
 * @returns {string}
 *        The result of the escaped values interpolated with the literal
 *        strings.
 */
  escaped(strings, ...values) {
    const result = [];

    for (const [i, string] of strings.entries()) {
      result.push(string);
      if (i < values.length)
        result.push(this.escapeXML(values[i]));
    }

    return result.join("");
  },

  /**
   * @returns {Promise<Tab|false>}
   */
  async currentTab() {
    const activeTabs = await browser.tabs.query({ active: true, windowId: browser.windows.WINDOW_ID_CURRENT });
    if (activeTabs.length > 0) {
      return activeTabs[0];
    }
    return false;
  },

  addEnterHandler(element, handler) {
    element.addEventListener("click", (e) => {
      handler(e);
    });
    element.addEventListener("keydown", (e) => {
      if (e.keyCode === 13) {
        e.preventDefault();
        handler(e);
      }
    });
  },

  addEnterOnlyHandler(element, handler) {
    element.addEventListener("keydown", (e) => {
      if (e.keyCode === 13) {
        e.preventDefault();
        handler(e);
      }
    });
  },

  /**
   * Checks if the given identifier represents the default container.
   * Accepts either a userContextId ("0" or 0) or a cookieStoreId ("firefox-default").
   * This dual-mode function exists because the default container is represented differently
   * in different contexts throughout the codebase.
   * 
   * @param {string|number} id - Either userContextId ("0"/0) or cookieStoreId ("firefox-default")
   * @returns {boolean} True if this represents the default container
   */
  isDefaultContainer(id) {
    return id === DEFAULT_CONTAINER_USER_CONTEXT_ID ||
           id === 0 ||
           id === DEFAULT_CONTAINER_COOKIE_STORE_ID;
  },

  /**
   * Converts a userContextId to a cookieStoreId.
   * @param {string|number} userContextId - The user context ID
   * @returns {string} The cookie store ID
   */
  cookieStoreId(userContextId) {
    if (this.isDefaultContainer(userContextId)) {
      return DEFAULT_CONTAINER_COOKIE_STORE_ID;
    }
    return `firefox-container-${userContextId}`;
  },

  /**
   * Extracts the userContextId from a cookieStoreId.
   * @param {string} cookieStoreId - The cookie store ID (e.g., "firefox-default", "firefox-container-1")
   * @returns {string|number|false} "0" for default container, number for regular containers, false if invalid
   */
  userContextId(cookieStoreId = "") {
    // Handle default container
    if (this.isDefaultContainer(cookieStoreId)) {
      return DEFAULT_CONTAINER_USER_CONTEXT_ID;
    }
    const userContextId = cookieStoreId.replace("firefox-container-", "");
    return (userContextId !== cookieStoreId) ? Number(userContextId) : false;
  },

  setOrRemoveAssignment(tabId, url, userContextId, value) {
    return browser.runtime.sendMessage({
      method: "setOrRemoveAssignment",
      tabId,
      url,
      userContextId,
      value
    });
  },

  resetCookiesForSite(pageUrl, cookieStoreId) {
    return browser.runtime.sendMessage({ 
      method: "resetCookiesForSite",
      pageUrl,
      cookieStoreId,
    });
  },

  /**
   * @param {string} url
   * @param {string} currentUserContextId
   * @param {string} newUserContextId
   * @param {number} tabIndex
   * @param {boolean} active
   * @param {number} [groupId]
   * @returns {Promise<any>}
   */
  async reloadInContainer(url, currentUserContextId, newUserContextId, tabIndex, active, groupId = undefined) {
    return await browser.runtime.sendMessage({
      method: "reloadInContainer",
      url,
      currentUserContextId,
      newUserContextId,
      tabIndex,
      active,
      groupId
    });
  },

  async alwaysOpenInContainer(identity) {
    const currentTab = await this.currentTab();
    const assignedUserContextId = this.userContextId(identity.cookieStoreId);
    if (currentTab.cookieStoreId !== identity.cookieStoreId) {
      return await browser.runtime.sendMessage({
        method: "assignAndReloadInContainer",
        url: currentTab.url,
        currentUserContextId: false,
        newUserContextId: assignedUserContextId,
        tabIndex: currentTab.index +1,
        active: currentTab.active,
        groupId: currentTab.groupId
      });
    }
    await Utils.setOrRemoveAssignment(
      currentTab.id,
      currentTab.url,
      assignedUserContextId,
      false
    );
  },

  /**
   * Creates a pseudo-identity object for the default container.
   * This mimics the structure of contextualIdentities but represents the containerless state.
   * @returns {Object} An identity-like object for the default container
   */
  createDefaultContainerIdentity() {
    return {
      cookieStoreId: DEFAULT_CONTAINER_COOKIE_STORE_ID,
      name: browser.i18n.getMessage("defaultContainerLabel"),
      userContextId: DEFAULT_CONTAINER_USER_CONTEXT_ID,
      icon: "fingerprint",
      color: "grey"
    };
  },
  /* Theme helper
   *
   * First, we look if there's a theme already set in the local storage. If
   * there isn't one, we set the theme based on `prefers-color-scheme`.
   * */
  getTheme(currentTheme, window) {
    if (typeof currentTheme !== "undefined" && currentTheme !== "auto") {
      return currentTheme;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  },
  async applyTheme() {
    const { currentTheme } = await browser.storage.local.get("currentTheme");
    const popup = document.getElementsByTagName("html")[0];
    const theme = Utils.getTheme(currentTheme, window);
    popup.setAttribute("data-theme", theme);
  }
};

window.Utils = Utils;
