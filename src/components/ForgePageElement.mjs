// components/ForgePageElement.mjs
const { getResourceUrl } = mod.getContext(import.meta);

export function ForgePageElement(props) {
  return {
    $template: "#forge-page-template",

    init() {
      this.storage = props.storage;
      this.config = props.config;
      this.nonSkillMods = props.nonSkillMods;
      this.ctx = props.ctx;
      this.setupEventListeners();
      this.updateSmithButton();
      this.updateBorder();
      this.updateUsedCount();
    },

    setupEventListeners() {
      const $forgeContainer = $("#forge-container");

      $forgeContainer.find('.forge-ui').css('background-image', `url("${getResourceUrl('assets/forgeBackground.png')}")`);

      $forgeContainer.on("click", ".forge-slot", (e) => this.openModal(e.currentTarget));
      $forgeContainer.on("click", ".forge-smith-btn", () => this.smith());

      $(document).on("click", "#forge-modal .modal-item", (e) => {
        const itemId = $(e.currentTarget).data("item-id");
        const slot = $(e.currentTarget).data("slot");
        this.selectItem(itemId, slot);
        $("#forge-modal").modal("hide");
      });
    },

    openModal(slot) {
      const $modal = $("#forge-modal");
      const $modalBody = $modal.find(".modal-body .row");
      $modalBody.empty();

      const slotType = $(slot).data("slot");
      let items;

      if (slotType === "item") {
        items = this.getValidEquipment();
      } else {
        items = this.getValidRunes();
      }

      if (items.length === 0) {
        // Show message if no items found
        const message = slotType === "item" 
          ? "No valid equipment found in Bank."
          : "No Ancient Runes found in Bank. Find them by killing monsters.";
        
        $modalBody.html(`<div class="col-12 p4">${message}</div`);
      } else {
        // Existing modal population code
        items.forEach((item) => {
          const mediaUrl = item.media;
          const displayName = item.name.replace(" Rune", "");
          const $item = $(`
            <div class="col-lg-1 col-sm-2 col-4 p-0 mt-2">
              <div class="modal-item text-center" data-item-id="${item.id}" data-slot="${slotType}">
                <img src="${mediaUrl}" alt="${item.name}" class="img-fluid" />
                <div class="item-name text-center mt-1">${displayName}</div>
              </div>
            </div>
          `);
          $modalBody.append($item);
        });
      }

      $modal.modal("show");
    },

    getValidEquipment() {
      const validSlots = ["Helmet", "Platelegs", "Platebody", "Ring", "Amulet", "Boots", "Gloves", "Shield", "Cape", "Passive"];

      const bankItems = Array.from(game.bank.items.values());
      const equipment = [];

      bankItems.forEach((itemData) => {
        // Ensure validSlots exists and is an array
        if (itemData.item.namespace !== "runesmithing" && Array.isArray(itemData.item.validSlots)) {
          // Extract all localID values from the validSlots array
          const validItemSlots = itemData.item.validSlots.map((slot) => slot.localID);

          // Check if any of the localIDs are present in the validSlots array
          const hasValidSlot = validItemSlots.some((slot) => validSlots.includes(slot));

          if (hasValidSlot) {
            equipment.push(itemData.item);
          }
        }
      });

      return equipment;
    },

    getValidRunes() {
      const bankItems = Array.from(game.bank.items.values());
      const runes = [];
      bankItems.forEach((itemData) => {
        if (itemData.item.category === "ancientRune") {
          runes.push(itemData.item);
        }
      });

      return runes;
    },

    selectItem(itemId, slot) {
      const $slot = $(`.forge-slot[data-slot="${slot}"]`);
      const item = game.items.getObjectByID(itemId);

      $slot.empty();
      if (item) {
        const $img = $(`<img src="${item.media}" alt="${item.name}" />`);
        $slot.append($img);
        $slot.data("value", item.id);
        $slot.addClass("filled"); // Optional: Visual indicator for filled slot
      } else {
        $slot.removeClass("filled");
      }

      this.updateLines();
      this.updateSmithButton();
      this.updateBorder(); // Update border based on new rune placement
    },

    updateLines() {
      const svg = document.getElementById("forge-lines");
      svg.innerHTML = ""; // Clear existing lines

      // Define slot data
      const slots = [
        { slot: "rune1", color: "cyan" },
        { slot: "rune2", color: "yellow" },
        { slot: "rune3", color: "magenta" },
      ];

      // Get the item slot
      const $itemSlot = $('.forge-slot[data-slot="item"]');
      if (!$itemSlot.length) return;

      const itemPos = this.getElementCenter($itemSlot);

      slots.forEach(({ slot, color }) => {
        const $runeSlot = $(`.forge-slot[data-slot="${slot}"]`);
        if ($runeSlot.data("value")) {
          // Only draw if rune is placed
          const runePos = this.getElementCenter($runeSlot);
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", runePos.x);
          line.setAttribute("y1", runePos.y);
          line.setAttribute("x2", itemPos.x);
          line.setAttribute("y2", itemPos.y);
          line.setAttribute("stroke", color);
          line.setAttribute("stroke-width", "5");
          svg.appendChild(line);
        }
      });
    },

    getElementCenter($element) {
      const offset = $element.offset();
      const width = $element.outerWidth();
      const height = $element.outerHeight();
      const parentOffset = $("#forge-container .container").offset(); // Relative to container
      return {
        x: offset.left - parentOffset.left + width / 2,
        y: offset.top - parentOffset.top + height / 2,
      };
    },

    updateSmithButton() {
      const $forgeContainer = $("#forge-container");
      const allFilled =
        $forgeContainer.find(".forge-slot").filter(function () {
          return !$(this).data("value");
        }).length === 0;

      $(".forge-smith-btn").prop("disabled", !allFilled);
    },

    smith() {
      const $forgeContainer = $("#forge-container");
      const slots = {};

      // Collect the selected runes and item from the forge slots
      $forgeContainer.find(".forge-slot").each(function () {
        slots[$(this).data("slot")] = $(this).data("value");
      });

      // Validate that all required slots are filled
      if (!slots.rune1 || !slots.rune2 || !slots.rune3 || !slots.item) {
        alert("Please select 3 runes and an item before smithing.");
        return;
      }

      // Array of selected rune IDs
      const runeIDs = [slots.rune1, slots.rune2, slots.rune3];

      // Initialize arrays to hold rune codes
      const runeCodes = [];

      // Process each rune
      for (const runeID of runeIDs) {
        // Extract the rune name from the runeId (e.g., "runesmithing:r_mino" -> "mino")
        const runeName = this.extractRuneName(runeID);

        if (!runeName) {
          alert(`Invalid rune identifier format: ${runeID}`);
          return;
        }

        // Validate that the rune exists in the config
        if (!this.config.runeCodes[runeName]) {
          alert(`Rune "${runeName}" is not properly configured.`);
          return;
        }

        // Retrieve rune code from config
        const code = this.config.runeCodes[runeName];

        runeCodes.push(code);
      }

      // Get the equipment item
      const itemID = slots.item;
      const equipmentItem = game.items.getObjectByID(itemID);
      if (!equipmentItem) {
        alert(`Item ${itemID} not found.`);
        return;
      }

      // Find an available eID from e0 to e99
      const usedIDs = Object.keys(props.storage.items || {});
      let newItemId = null;
      for (let i = 0; i <= 199; i++) {
        const eID = `e${i}`;
        if (!usedIDs.includes(eID)) {
          newItemId = eID;
          break;
        }
      }
      if (!newItemId) {
        alert("No available item IDs left.");
        return;
      }

      // Create a mapping
      const mapping = {
        [newItemId]: {
          0: equipmentItem.id,
          1: runeCodes.join(""),
        },
      };

      // Try to add the item mapping and load it
      try {
        props.storage.addItemMapping(mapping);
        props.storage.load();
      } catch (error) {
        console.error("Error during smithing:", error);
        // Pop open a modal with "Error generating item. Please try again."
        $("#forge-error-modal .modal-body").text("Error generating item. Please try again.");
        $("#forge-error-modal").modal("show");
        return;
      }

      // Add the new item to the player's bank
      game.bank.addItemByID(`runesmithing:${newItemId}`, 1, true, true, false);

      // Remove the consumed items from the bank
      // Remove 1 of the equipment item
      game.bank.removeItemQuantityByID(itemID, 1, false);
      // Remove 1 of each rune
      for (const runeID of runeIDs) {
        game.bank.removeItemQuantityByID(runeID, 1, false);
      }

      // Clear the slots after smithing
      $forgeContainer.find(".forge-slot").empty().removeData("value").removeClass("filled");
      
      // Reset slot text
      $forgeContainer.find('.forge-slot[data-slot="rune1"]').text("Rune 1");
      $forgeContainer.find('.forge-slot[data-slot="rune2"]').text("Rune 2");
      $forgeContainer.find('.forge-slot[data-slot="rune3"]').text("Rune 3");
      $forgeContainer.find('.forge-slot[data-slot="item"]').text("Item");

      this.updateLines();
      this.updateSmithButton();
      this.updateBorder();
      this.updateUsedCount();

      setTimeout(() => {
        this.refreshBankIcons();
      }, 500);
    },

    getRuneCode(runeName) {
      return this.config.runeCodes[runeName];
    },

    extractRuneName(runeId) {
      if (typeof runeId !== "string") return null;
      const parts = runeId.split(":");
      if (parts.length !== 2) return null;

      const runePart = parts[1];
      // Assuming rune identifiers start with 'r_'
      if (!runePart.startsWith("r_")) return null;

      return runePart.substring(2); // Remove 'r_' prefix
    },

    refreshBankIcons() {
      $('.bank-item[data-item-id*="runesmithing"]').each(function () {
        var $bankItem = $(this);
        var itemId = $bankItem.data("item-id");
        var item = game.items.getObjectByID(itemId);

        if (item && item.category !== "ancientRune" && item.category !== "blankRune" && item.media && !item.media.startsWith("blob")) {
          var mediaUrl = getResourceUrl(item.media);
          $bankItem.find(".bank-img").attr("src", mediaUrl);
        }
      });

      $('.bank-item[data-item-id*="runesmithing:e"]').each(function () {
        const $bankItem = $(this);

        if (!$bankItem.find(".enchantment-overlay").length) {
          const $overlay = $('<div class="enchantment-overlay"></div>');
          $bankItem.append($overlay);
        }
      });
    },

    updateBorder() {
      const $container = $("#forge-container > .container");
      const runeSlots = ["rune1", "rune2", "rune3"];
      const activeRunes = {};

      // Determine which runes are placed
      runeSlots.forEach((slot) => {
        const $slot = $(`.forge-slot[data-slot="${slot}"]`);
        if ($slot.data("value")) {
          activeRunes[slot] = true;
        }
      });

      // Remove all border classes first
      $container.removeClass("border-cyan border-yellow border-magenta border-cyan-yellow border-yellow-magenta border-cyan-magenta border-cyan-yellow-magenta");

      // Determine which runes are active and apply corresponding border class
      const activeRuneNames = [];

      if (activeRunes["rune1"]) activeRuneNames.push("cyan");
      if (activeRunes["rune2"]) activeRuneNames.push("yellow");
      if (activeRunes["rune3"]) activeRuneNames.push("magenta");

      const activeCount = activeRuneNames.length;

      switch (activeCount) {
        case 0:
          // No runes selected: solid #555
          // No additional class needed
          break;
        case 1:
          // Single rune selected
          $container.addClass(`border-${activeRuneNames[0]}`);
          break;
        case 2:
          // Two runes selected
          // Determine which two
          if (activeRuneNames.includes("cyan") && activeRuneNames.includes("yellow")) {
            $container.addClass("border-cyan-yellow");
          } else if (activeRuneNames.includes("yellow") && activeRuneNames.includes("magenta")) {
            $container.addClass("border-yellow-magenta");
          } else if (activeRuneNames.includes("cyan") && activeRuneNames.includes("magenta")) {
            $container.addClass("border-cyan-magenta");
          }
          break;
        case 3:
          // All three runes selected
          $container.addClass("border-cyan-yellow-magenta");
          break;
        default:
          // Fallback to default border
          break;
      }
    },

    updateUsedCount() {
      const storageItems = props.storage.items || {};
      const EID_REGEX = /^e(?:\d{1,2}|1\d\d)$/;
      const usedCount = Object.keys(storageItems).filter((eID) => EID_REGEX.test(eID)).length;

      $(".forge-used-number").text(usedCount);
    },
  };
}
