const {initializeWithTab, expect} = require("../common");

describe("Assignment Reopen Feature", function () {
  const url = "http://example.com";

  beforeEach(async function () {
    this.webExt = await initializeWithTab({
      cookieStoreId: "firefox-default",
      url
    });
  });

  afterEach(function () {
    this.webExt.destroy();
  });

  describe("set to 'Always open in' firefox-container-4", function () {
    beforeEach(async function () {
      // popup click to set assignment for activeTab.url
      await this.webExt.popup.helper.clickElementById("always-open-in");
      // Click container-4 which is the 5th item (index 4, nth-child 5)
      await this.webExt.popup.helper.clickElementByQuerySelectorAll("#picker-identities-list > .menu-item:nth-child(5)");
    });

    it("should open the page in the assigned container", async function () {
      // should have created a new tab with the confirm page
      this.webExt.background.browser.tabs.create.should.have.been.calledWithMatch({
        active: true,
        cookieStoreId: "firefox-container-4",
        index: 1,
        openerTabId: null,
        url: "http://example.com"
      });
    });

  });

});

describe("Assignment Comfirm Page Feature", function () {
  const url = "http://example.com";

  beforeEach(async function () {
    this.webExt = await initializeWithTab({
      cookieStoreId: "firefox-container-4",
      url
    });
  });

  afterEach(function () {
    this.webExt.destroy();
  });

  describe("open new Tab with the assigned URL in the default container", function () {
    let newTab;
    beforeEach(async function () {
      await this.webExt.popup.helper.clickElementById("always-open-in");
      // Click container-4 which is the 5th item (index 4, nth-child 5)
      await this.webExt.popup.helper.clickElementByQuerySelectorAll("#picker-identities-list > .menu-item:nth-child(5)");

      // new Tab opening activeTab.url in default container
      newTab = await this.webExt.background.browser.tabs._create({
        cookieStoreId: "firefox-default",
        url
      }, {
        options: {
          webRequestError: true // because request is canceled due to reopening
        }
      });
    });

    it("should open the confirm page", async function () {
      // should have created a new tab with the confirm page
      this.webExt.background.browser.tabs.create.should.have.been.calledWithMatch({
        url: "moz-extension://fake/confirm-page.html?" +
               `url=${encodeURIComponent(url)}` +
               `&cookieStoreId=${this.webExt.tab.cookieStoreId}` +
               "&currentCookieStoreId=firefox-default",
        cookieStoreId: "firefox-default",
        openerTabId: null,
        index: 2,
        active: true
      });
    });

    it("should remove the new Tab that got opened in the default container", function () {
      this.webExt.background.browser.tabs.remove.should.have.been.calledWith(newTab.id);
    });
  });
});

describe("Default Container Assignment Feature", function () {
  const url = "http://example.com";

  describe("Assigning site to default container", function () {
    beforeEach(async function () {
      this.webExt = await initializeWithTab({
        cookieStoreId: "firefox-container-1",
        url
      });
    });

    afterEach(function () {
      this.webExt.destroy();
    });

    describe("set to 'Always open in Default Container'", function () {
      beforeEach(async function () {
        await this.webExt.popup.helper.clickElementById("always-open-in");
        // Click the first item which should be Default Container
        await this.webExt.popup.helper.clickElementByQuerySelectorAll("#picker-identities-list > .menu-item:first-child");
      });

      it("should create assignment with userContextId '0'", async function () {
        const assignments = await this.webExt.background.browser.storage.local.get();
        const siteKey = `siteContainerMap@@_${new URL(url).hostname}`;
        expect(assignments).to.have.property(siteKey);
        expect(assignments[siteKey].userContextId).to.equal("0");
      });

      it("should open the page in the default container", async function () {
        this.webExt.background.browser.tabs.create.should.have.been.calledWithMatch({
          active: true,
          cookieStoreId: "firefox-default",
          index: 1,
          url: "http://example.com"
        });
      });
    });
  });

  describe("Opening assigned default container site from regular container", function () {
    let newTab;

    beforeEach(async function () {
      this.webExt = await initializeWithTab({
        cookieStoreId: "firefox-container-1",
        url: "http://different-site.com"
      });

      // Set up assignment for example.com to default container
      await this.webExt.background.browser.storage.local.set({
        [`siteContainerMap@@_${new URL(url).hostname}`]: {
          userContextId: "0",
          neverAsk: false
        }
      });

      // Open new tab with the assigned URL in a regular container
      newTab = await this.webExt.background.browser.tabs._create({
        cookieStoreId: "firefox-container-1",
        url
      }, {
        options: {
          webRequestError: true
        }
      });
    });

    afterEach(function () {
      this.webExt.destroy();
    });

    it("should reopen in default container", function () {
      this.webExt.background.browser.tabs.create.should.have.been.calledWithMatch({
        url: url,
        cookieStoreId: "firefox-default",
        index: 2,
        active: true
      });
    });

    it("should remove the tab that got opened in the wrong container", function () {
      this.webExt.background.browser.tabs.remove.should.have.been.calledWith(newTab.id);
    });
  });

  describe("Opening assigned default container site from default container", function () {
    beforeEach(async function () {
      this.webExt = await initializeWithTab({
        cookieStoreId: "firefox-default",
        url: "http://different-site.com"
      });

      await this.webExt.background.browser.storage.local.set({
        [`siteContainerMap@@_${new URL(url).hostname}`]: {
          userContextId: "0",
          neverAsk: false
        }
      });

      await this.webExt.background.browser.tabs._create({
        cookieStoreId: "firefox-default",
        url
      });
    });

    afterEach(function () {
      this.webExt.destroy();
    });

    it("should not reopen since already in correct container", function () {
      this.webExt.background.browser.tabs.create.should.not.have.been.calledWithMatch({
        cookieStoreId: "firefox-default",
        url: url
      });
      this.webExt.background.browser.tabs.remove.should.not.have.been.called;
    });
  });

  describe("Context menu for default container assignment", function () {
    beforeEach(async function () {
      this.webExt = await initializeWithTab({
        cookieStoreId: "firefox-default",
        url
      });

      await this.webExt.background.browser.storage.local.set({
        [`siteContainerMap@@_${new URL(url).hostname}`]: {
          userContextId: "0",
          neverAsk: false
        }
      });

      await this.webExt.background.window.assignManager.calculateContextMenu(this.webExt.tab);
    });

    afterEach(function () {
      this.webExt.destroy();
    });

    it("should show context menu as checked when in default container", function () {
      this.webExt.background.browser.contextMenus.create.should.have.been.calledWithMatch({
        checked: true,
        type: "checkbox"
      });
    });
  });
});

describe("Default Container Helper Functions", function () {
  const url = "http://example.com";
  
  beforeEach(async function () {
    this.webExt = await initializeWithTab({
      cookieStoreId: "firefox-default",
      url
    });
  });

  afterEach(function () {
    this.webExt.destroy();
  });

  describe("Conversion helpers", function () {
    it("Utils.userContextId should convert firefox-default to '0'", function () {
      expect(this.webExt.popup.window.Utils.userContextId("firefox-default")).to.equal("0");
      expect(this.webExt.popup.window.Utils.userContextId("firefox-container-1")).to.equal(1);
      expect(this.webExt.popup.window.Utils.userContextId("invalid")).to.equal(false);
    });

    it("getUserContextIdFromCookieStoreId should convert firefox-default to '0'", function () {
      const logic = this.webExt.background.window.backgroundLogic;
      expect(logic.getUserContextIdFromCookieStoreId("firefox-default")).to.equal("0");
      expect(logic.getUserContextIdFromCookieStoreId("firefox-container-1")).to.equal("1");
      expect(logic.getUserContextIdFromCookieStoreId("invalid")).to.equal(false);
    });

    it("cookieStoreId should convert '0' and 0 to firefox-default", function () {
      const Utils = this.webExt.background.window.Utils;
      expect(Utils.cookieStoreId("0")).to.equal("firefox-default");
      expect(Utils.cookieStoreId(0)).to.equal("firefox-default");
      expect(Utils.cookieStoreId("1")).to.equal("firefox-container-1");
    });

    it("isDefaultContainer should identify default container", function () {
      const Utils = this.webExt.background.window.Utils;
      expect(Utils.isDefaultContainer("0")).to.be.true;
      expect(Utils.isDefaultContainer("firefox-default")).to.be.true;
      expect(Utils.isDefaultContainer("1")).to.be.false;
      expect(Utils.isDefaultContainer("firefox-container-1")).to.be.false;
    });
  });

  describe("Utils.createDefaultContainerIdentity", function () {
    it("should create default container identity object with correct properties", function () {
      const identity = this.webExt.popup.window.Utils.createDefaultContainerIdentity();
      
      expect(identity.cookieStoreId).to.equal("firefox-default");
      expect(identity.userContextId).to.equal("0");
      expect(identity.icon).to.equal("fingerprint");
      expect(identity.color).to.equal("grey");
      expect(identity.name).to.be.a("string");
    });
  });

  describe("identityState.lookupMACaddonUUID", function () {
    it("should return false for default container", async function () {
      const result = await this.webExt.background.window.identityState.lookupMACaddonUUID("0");
      expect(result).to.equal(false);
    });
  });

  describe("deleteContainer", function () {
    it("should not call contextualIdentities.remove for default container", async function () {
      await this.webExt.background.window.backgroundLogic.deleteContainer("0");
      this.webExt.background.browser.contextualIdentities.remove.should.not.have.been.called;
    });
  });
});

describe("Default Container Edge Cases and Bug Fixes", function () {
  const url = "http://example.com";

  describe("upgradeData should not delete default container assignments", function () {
    beforeEach(async function () {
      this.webExt = await initializeWithTab({
        cookieStoreId: "firefox-default",
        url
      });

      // Create default container assignment
      await this.webExt.background.browser.storage.local.set({
        [`siteContainerMap@@_${new URL(url).hostname}`]: {
          userContextId: "0",
          neverAsk: false
        }
      });
    });

    afterEach(function () {
      this.webExt.destroy();
    });

    it("should preserve default container assignments after upgrade", async function () {
      await this.webExt.background.window.assignManager.storageArea.upgradeData();
      
      const assignments = await this.webExt.background.browser.storage.local.get();
      const siteKey = `siteContainerMap@@_${new URL(url).hostname}`;
      expect(assignments).to.have.property(siteKey);
      expect(assignments[siteKey].userContextId).to.equal("0");
    });
  });

  describe("Assignment with mixed container types", function () {
    beforeEach(async function () {
      this.webExt = await initializeWithTab({
        cookieStoreId: "firefox-container-1",
        url: "http://site1.com"
      });

      await this.webExt.background.browser.storage.local.set({
        "siteContainerMap@@_site1.com": { userContextId: "1", neverAsk: false },
        "siteContainerMap@@_site2.com": { userContextId: "0", neverAsk: false },
        "siteContainerMap@@_site3.com": { userContextId: "2", neverAsk: false }
      });
    });

    afterEach(function () {
      this.webExt.destroy();
    });

    it("should retrieve assignments by container including default", async function () {
      const defaultAssignments = await this.webExt.background.window.assignManager.storageArea.getAssignedSites("0");
      expect(defaultAssignments).to.have.property("siteContainerMap@@_site2.com");
      expect(Object.keys(defaultAssignments)).to.have.lengthOf(1);

      const container1Assignments = await this.webExt.background.window.assignManager.storageArea.getAssignedSites("1");
      expect(container1Assignments).to.have.property("siteContainerMap@@_site1.com");
      expect(Object.keys(container1Assignments)).to.have.lengthOf(1);

      const allAssignments = await this.webExt.background.window.assignManager.storageArea.getAssignedSites(null);
      expect(Object.keys(allAssignments)).to.have.lengthOf(3);
    });
  });
});
