const { patch } = mod.getContext(import.meta);
export class Patches {
  constructor(config) {
    this.patch = patch;
    this.config = config;
  }

  applyPatches() {
    this.updateContainers();
    this.patchMonsterDrops();
  }

  updateContainers() {
    const chests = Array.from(game.items.openables.registeredObjects.values());

    chests.forEach((chest) => {
        // Check if the chest's sell value is greater than the min chest value to spawn a blank rune
        if (chest.sellsFor.currency.type === 'GP' && chest.sellsFor.quantity > this.config.blankRune.minChestValueToSpawn) {
            const blankRuneChance = this.config.blankRune.chestSpawnChance;
            const dropTable = chest.dropTable;

            // Check if blankRune is already in the dropTable to avoid duplicates
            let blankRuneExists = dropTable.drops.some((drop) => drop.item.id === "runesmithing:blankRune");

            if (!blankRuneExists) {
                // Multiply all existing drop weights by 100
                let updatedTotalWeight = 0;
                dropTable.drops.forEach((drop) => {
                    drop.weight *= 100;
                    updatedTotalWeight += drop.weight;
                });

                // Define the new weight based on the chestSpawnChance
                let newWeight = updatedTotalWeight * blankRuneChance;

                // Create the new drop item
                let itemToAdd = {
                    item: game.items.getObjectByID("runesmithing:blankRune"),
                    minQuantity: 1,
                    maxQuantity: 1,
                    weight: newWeight,
                };

                // Add the new drop to the chest's drop table
                dropTable.drops.push(itemToAdd);

                // Update the total weight of the drop table
                dropTable.totalWeight = updatedTotalWeight + newWeight;
            }
        }
    });
}

  patchMonsterDrops() {
    this.patch(CombatManager, "dropEnemyLoot").before((monster) => {
        const lootTable = monster.lootTable;
        if (lootTable) {
            let drops = lootTable.drops;

            // Step 1: Check if 'blankRune' is already in the drops
            let blankRuneExists = drops.some((drop) => drop.item.id === "runesmithing:blankRune");

            if (!blankRuneExists) {
                // Step 2: Sum the monster's levels (Attack, Corruption, Defence, etc.)
                let totalLevel = 0;
                if (monster.levels) {
                    for (let key in monster.levels) {
                        totalLevel += monster.levels[key];
                    }
                }

                // Step 3: Normalize the chance based on totalLevel
                const minLevel = this.config.blankRune.minLevel;
                const maxLevel = this.config.blankRune.maxLevel;
                const minChance = this.config.blankRune.minChance;
                const maxChance = this.config.blankRune.maxChance;

                // Ensure totalLevel is within the min-max range
                let normalizedLevel = Math.max(minLevel, Math.min(totalLevel, maxLevel));

                // Calculate the percentage chance for blankRune based on level
                let blankRuneChance = minChance + (maxChance - minChance) * ((normalizedLevel - minLevel) / (maxLevel - minLevel));

                // Multiply all existing drop weights by 100
                let updatedTotalWeight = 0;
                for (let drop of drops) {
                    drop.weight *= 100;
                    updatedTotalWeight += drop.weight;
                }

                // Step 4: Define the new weight based on the normalized chance
                let newWeight = updatedTotalWeight * blankRuneChance;

                // Step 5: Create the new drop item
                let itemToAdd = {
                    item: game.items.getObjectByID("runesmithing:blankRune"),
                    minQuantity: 1,
                    maxQuantity: 1,
                    weight: newWeight,
                };

                // Add the new drop to the loot table's drops array
                lootTable.drops.push(itemToAdd);

                // Update the total weight of the loot table to include the new item
                lootTable.totalWeight = updatedTotalWeight + newWeight;
            }
        }
    });
}

}
