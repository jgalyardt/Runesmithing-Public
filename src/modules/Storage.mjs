// modules/Storage.mjs
const { gameData, characterStorage, accountStorage, loadModule } = mod.getContext(import.meta);
const { StringCompressor } = await loadModule("modules/StringCompressor.mjs");

export class Storage {
  constructor(manifest, config, nonSkillMods) {
    this.namespace = manifest.namespace;
    this.runes = config.runes;
    this.recipes = config.recipes;
    this.config = config;
    this.nonSkillMods = nonSkillMods;
    this.characterStorage = characterStorage;
    this.accountStorage = accountStorage;
    this.stringCompressor = new StringCompressor();

    // Create a mapping of rune codes to rune names
    this.runeCodeToName = {};
    for (const runeName in this.config.runeCodes) {
      const runeCode = this.config.runeCodes[runeName];
      this.runeCodeToName[runeCode] = runeName;
    }

    // Initialize an in-memory Set to track loaded e# items for the current session
    this.loadedEItems = new Set();
  }

  checkFirstTimeUser() {
    const firstTime = this.accountStorage.getItem("firstTime");
    if (!firstTime) {
      // Add welcome items
      game.bank.addItemByID("runesmithing:note", 1, true, true, false);
      game.bank.addItemByID("runesmithing:blankRune", 3, true, true, false);
      this.accountStorage.setItem("firstTime", "true");
    }
  }

  encodeItems() {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const jsonString = JSON.stringify(this.items);
        const { compressed, mapping } = this.stringCompressor.huffmanCompress(jsonString);
        const base64Compressed = this.stringCompressor.base64Encode(compressed);
        const data = { compressed: base64Compressed, mapping };
        const dataString = JSON.stringify(data);
        return dataString; // Success: Exit the function
      } catch (error) {
        console.error(`encodeItems: Attempt ${attempt} failed.`, error);
        if (attempt === maxAttempts) {
          throw new Error(`encodeItems: All ${maxAttempts} attempts failed.`);
        }
      }
    }
  }

  decodeItems(dataString) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const data = JSON.parse(dataString);
        const compressedBinaryString = this.stringCompressor.base64Decode(data.compressed);
        const jsonString = this.stringCompressor.huffmanDecompress({
          compressed: compressedBinaryString,
          mapping: data.mapping,
        });
        const items = JSON.parse(jsonString);
        return items; // Success: Exit the function
      } catch (error) {
        console.error(`decodeItems: Attempt ${attempt} failed.`, error);
        if (attempt === maxAttempts) {
          throw new Error(`decodeItems: All ${maxAttempts} attempts failed.`);
        }
      }
    }
  }

  load() {
    // Load items from storage
    const itemsData = this.get("items");
    if (itemsData) {
      try {
        this.items = this.decodeItems(itemsData);
      } catch (error) {
        console.error("Error decoding items during load:", error);
        throw error;
      }
    } else {
      this.items = {};
    }
  
    // Add the dummy enchanted items to the game
    const eIDToDummyID = this.createDummyEnchantedItems();
    for (const eID in this.items) {
      // Check if the eID is within the e0-e99 range
      if (/^e(?:\d{1,2}|1\d\d)$/.test(eID)) {
        // If this e# item has already been loaded this session, skip it
        if (this.loadedEItems.has(eID)) {
          //console.log(`Skipping already loaded item: ${eID}`);
          continue;
        }
      }

      // Get the corresponding dummyID for this eID
      const dummyID = eIDToDummyID[eID];
      if (!dummyID) {
        console.warn(`No dummyID found for eID: ${eID}`);
        continue;
      }

      // Get the enchanted item and dummy item by their IDs
      const enchantedItem = game.items.getObjectByID(`${this.namespace}:${eID}`);
      const dummyItem = game.items.getObjectByID(`${this.namespace}:${dummyID}`);

      if (enchantedItem && dummyItem) {
        // Update the enchanted item's properties based on the dummy item
        this.updateItemProperties(enchantedItem, dummyItem);

        // Mark it as loaded for this session
        this.loadedEItems.add(eID);
      } else {
        console.warn(`Enchanted or dummy item not found for ID: ${eID}`);
      }
    }
  }

  createDummyEnchantedItems() {
    const eIDToDummyID = {};
    const itemPackage = gameData.buildPackage((itemPackage) => {
      for (const eID in this.items) {
        // Check if the eID is within the e0-e99 range
        if (/^e(?:\d{1,2}|1\d\d)$/.test(eID)) {
          // If this e# item has already been loaded this session, skip its creation
          if (this.loadedEItems.has(eID)) {
            //console.log(`Skipping creation of already loaded item: ${eID}`);
            continue;
          }
        }
  
        const mapping = this.items[eID];
        const originalItemId = mapping[0];
        const runeCode = mapping[1];
  
        const originalItem = game.items.getObjectByID(originalItemId);
        if (originalItem) {
          const runeCodes = runeCode.split("");
          const modifiers = runeCodes.map((code, index) => {
            const runeName = this.runeCodeToName[code];
            const runeModifier = this.config.runeModifiers[runeName];
            const slotKey = `slot${index + 1}`;
            const modifier = runeModifier[slotKey];
            return modifier;
          });
  
          // Get the rune names from the rune codes and capitalize the first letter
          const runeNames = runeCodes.map((code) => {
            const runeName = this.runeCodeToName[code];
            return runeName.charAt(0).toUpperCase() + runeName.slice(1);
          });
  
          // Combine modifiers
          const combinedModifiers = this.combineModifiers(
            originalItem.modifiers || {},
            modifiers
          );
  
          let requirementsArray = [];
  
          if (Array.isArray(originalItem.equipRequirements)) {
            requirementsArray = originalItem.equipRequirements.map((requirement) => {
              const newRequirement = {};
  
              // Loop through each key in the requirement object
              for (let key in requirement) {
                if (requirement.hasOwnProperty(key)) {
                  const value = requirement[key];
  
                  // Ignore the 'game' key
                  if (key === "game") continue;
  
                  // If the value is an object with an 'id' or 'uid', store the key as keyID
                  if (typeof value === "object" && value.id) {
                    newRequirement[`${key}ID`] = value.id;
                  } else {
                    // Otherwise, just copy the value as-is
                    newRequirement[key] = value;
                  }
                }
              }
  
              return newRequirement;
            });
          }
  
          let equipmentStatsArray = [];
  
          if (Array.isArray(originalItem.equipmentStats)) {
            equipmentStatsArray = originalItem.equipmentStats.map((stat) => {
              const newStat = {};
  
              // Loop through each key in the equipment stat object
              for (let key in stat) {
                if (stat.hasOwnProperty(key)) {
                  const value = stat[key];
  
                  // If the value is an object with an 'id', store the key as keyID
                  if (typeof value === "object" && value.id) {
                    newStat[`${key}ID`] = value.id;
                  } else {
                    // Otherwise, just copy the value as-is
                    newStat[key] = value;
                  }
                }
              }
  
              return newStat;
            });
          }
  
          // Generate a unique dummy ID based on the current timestamp and eID
          const timestamp = Date.now();
          const dummyID = `dummy_${eID}_${timestamp}`;
  
          // Map the eID to the dummyID
          eIDToDummyID[eID] = dummyID;
  
          // Create a new item based on the original item
          const newItem = {
            id: dummyID,
            itemType: "Equipment",
            type: originalItem.type,
            name: `${originalItem.name} (${runeNames.join("-")})`,
            customDescription: originalItem.customDescription,
            category: originalItem.category,
            attackType: originalItem.attackType,
            media: originalItem.media,
            ignoreCompletion: true,
            obtainFromItemLog: originalItem.obtainFromItemLog,
            golbinRaidExclusive: originalItem.golbinRaidExclusive,
            sellsFor: originalItem.sellsFor,
            tier: originalItem.tier,
            validSlots: originalItem.validSlots.map((slot) => slot.localID),
            occupiesSlots: originalItem.occupiesSlots || [],
            equipRequirements: requirementsArray,
            modifiers: combinedModifiers,
            equipmentStats: equipmentStatsArray,
          };
  
          // Add the new item to the item package
          itemPackage.items.add(newItem);
        } else {
          console.warn(`Original item not found for ID: ${originalItemId}`);
        }
      }
    });
  
    // Add the package to the game data
    itemPackage.add();
  
    // Return the eIDToDummyID mapping
    return eIDToDummyID;
  }

  updateItemProperties(enchantedItem, dummyItem) {
    // Update the enchanted item's properties based on the dummy item
    enchantedItem._name = `${dummyItem.name}`;
    enchantedItem._customDescription = undefined;
    enchantedItem.category = dummyItem.category;
    enchantedItem.type = dummyItem.type;
    enchantedItem.attackType = dummyItem.attackType;
    enchantedItem._media = dummyItem.media;
    enchantedItem.ignoreCompletion = true;
    enchantedItem.obtainFromItemLog = dummyItem.obtainFromItemLog;
    enchantedItem.golbinRaidExclusive = dummyItem.golbinRaidExclusive;
    enchantedItem.sellsFor = dummyItem.sellsFor.quantity;
    enchantedItem.tier = dummyItem.tier;
    enchantedItem.validSlots = dummyItem.validSlots;
    enchantedItem.occupiesSlots = dummyItem.occupiesSlots || [];
    enchantedItem.equipRequirements = dummyItem.equipRequirements || [];
    enchantedItem.modifiers = dummyItem.modifiers;
    enchantedItem.equipmentStats = dummyItem.equipmentStats || [];
    enchantedItem._modifiedDescription = dummyItem.modifiedDescription;
  }

  // Combine equipment modifiers with rune modifiers
  combineModifiers(equipmentModifiers, runeModifiers) {
    const combinedModifiers = {};

    function getScopeValue(scopeKey) {
      switch (scopeKey) {
        case "currency":
          return "melvorD:GP";
        case "damageType":
          return "melvorD:Normal";
        case "category":
          return "melvorD:Dungeons";
        default:
          console.warn(`Unhandled scope key: ${scopeKey}`);
          return null;
      }
    }

    function addModifier(key, value, originalObj = null) {
      const modifierObject = { value };
      const registeredModifier = game.modifierRegistry.registeredObjects.get(key);

      if (registeredModifier && registeredModifier.allowedScopes && registeredModifier.allowedScopes[0]) {
        const scopes = registeredModifier.allowedScopes[0].scopes;
        if (originalObj) {
          // Handle modifiers on original object
          for (const objKey in originalObj) {
            const objValue = originalObj[objKey];

            if (typeof objValue === "object" && objValue !== null && "id" in objValue) {
              // If it's an object and has an 'id' property, map it to the modifierObject
              modifierObject[`${objKey}ID`] = objValue.id;
            } else if (objKey === "value") {
              // Map the 'value' property directly
              modifierObject.value = objValue;
            }
          }
        } else {
          // Handle new rune modifiers
          for (const scopeKey in scopes) {
            if (scopes[scopeKey] === true) {
              const scopeValue = getScopeValue(scopeKey);
              if (scopeValue !== null) {
                modifierObject[`${scopeKey}ID`] = scopeValue;
              }
            }
          }
        }
      }

      if (combinedModifiers[key]) {
        combinedModifiers[key][0].value += value;
      } else {
        combinedModifiers[key] = [modifierObject];
      }
    }

    // Convert equipmentModifiers to the desired format
    for (const key in equipmentModifiers) {
      const modifierObj = equipmentModifiers[key];
      const modifierKey = `${modifierObj.modifier.namespace}:${modifierObj.modifier.localID}`;
      addModifier(modifierKey, modifierObj.value, modifierObj);
    }

    // Add rune modifiers
    for (const modifierObj of runeModifiers) {
      if (modifierObj && modifierObj.name && modifierObj.value !== undefined) {
        const modifierKey = modifierObj.name;
        const modifierValue = modifierObj.value;
        addModifier(modifierKey, modifierValue);
      }
    }

    return combinedModifiers;
  }

  getModifierValue(modifierKey) {
    const modifierData = this.nonSkillMods[modifierKey];
    if (modifierData && modifierData.values && modifierData.values.length === 2) {
      const minValue = modifierData.values[0];
      const maxValue = modifierData.values[1];
      // For deterministic behavior, pick the average value
      const value = (minValue + maxValue) / 2;
      return value;
    }
    // Default value if modifier not found
    return 0;
  }

  cleanModdedItems() {
    if (!this.items) {
      return;
    }
  
    let moddedItems = [];
  
    // Collect all currently equipped modded items
    for (let i = 0; i < game.combat.player.equipmentSets.length; i++) {
      const set = game.combat.player.equipmentSets[i];
      set.equipment.equippedArray.forEach((equippedItem) => {
        if (equippedItem.item.namespace === this.namespace) {
          const item = equippedItem.item;
          moddedItems.push(item.localID);
        }
      });
    }
  
    // Collect all modded items from the bank
    const bankItems = Array.from(game.bank.items.values());
    bankItems.forEach((itemData) => {
      if (itemData.item.namespace === this.namespace && /^e(?:\d{1,2}|1\d\d)$/.test(itemData.item.localID)) {
        moddedItems.push(itemData.item.localID);
      }
    });
  
    // Determine which items to remove (those not currently equipped or in the bank)
    const itemsToRemove = Object.keys(this.items).filter((eID) => !moddedItems.includes(eID));
  
    if (itemsToRemove.length > 0) {
      for (const eID of itemsToRemove) {
        delete this.items[eID];
        this.loadedEItems.delete(eID);
        console.log(`Removed modded item mapping: ${eID}`);
      }
      console.log(`Cleaned ${itemsToRemove.length} modded item(s) from storage.`);
      this.save();
    } else {
      console.log("No modded items to remove from storage.");
    }
  }

  reequipModdedItems() {
    let moddedItemData = [];

    // Unequip modded items
    for (let i = 0; i < game.combat.player.equipmentSets.length; i++) {
      const set = game.combat.player.equipmentSets[i];
      set.equipment.equippedArray.forEach((equippedItem) => {
        if (equippedItem.item.namespace === this.namespace) {
          const item = equippedItem.item;
          const slot = equippedItem.slot;
          moddedItemData.push({ item: item, set: i, slot: slot });
          game.combat.player.unequipItem(i, slot);
        }
      });
    }

    // Re-equip modded items
    moddedItemData.forEach((e) => {
      game.combat.player.equipItem(e.item, e.set, e.slot, 1);
    });
  }

  save() {
    const encodedItems = this.encodeItems();
    this.set("items", encodedItems);
  }

  addItemMapping(mapping) {
    this.items = this.items || {};
    Object.assign(this.items, mapping);
    this.save();
  }

  set(key, value) {
    try {
      if (value.length > 8192) {
        throw new Error("Data exceeds maximum storage size");
      }
      console.log(`Saved string of length ${value.length}`);
      this.characterStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to set item in storage with key "${key}":`, error);
    }
  }

  get(key) {
    return this.characterStorage.getItem(key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  // Remove an item from the storage
  remove(key) {
    return this.characterStorage.removeItem(key);
  }

  clear() {
    return this.characterStorage.clear();
  }
}
