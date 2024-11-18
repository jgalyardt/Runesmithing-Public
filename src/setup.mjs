// setup.mjs
export async function setup({ loadModule, loadTemplates, loadData, onCharacterLoaded, onInterfaceReady, getResourceUrl }) {
  const { Storage } = await loadModule("modules/Storage.mjs");
  const { Patches } = await loadModule("modules/Patches.mjs");
  const { ForgePageElement } = await loadModule("components/ForgePageElement.mjs");

  await loadTemplates("templates.html");
  const manifest = await loadData("manifest.json");
  const config = await loadData("config.json");
  const nonSkillMods = await loadData("data/nonSkillMods.json");
  const storage = new Storage(manifest, config, nonSkillMods);
  const patches = new Patches(config);

  onCharacterLoaded((ctx) => {
    patches.applyPatches();
    storage.load();
    storage.reequipModdedItems();
    storage.checkFirstTimeUser();
  });

  onInterfaceReady((ctx) => {
    setTimeout(() => {
      storage.cleanModdedItems();
    }, 1000);

    const runesmithCategory = sidebar.category("Runesmithing", {
      toggleable: true,
      after: "Combat",
    });

    const forgePageElement = new ForgePageElement({ storage, config, nonSkillMods, ctx });
    ui.create(forgePageElement, $("#main-container")[0]);
    forgePageElement.init();
    forgePageElement.refreshBankIcons();

    runesmithCategory.item("Forge", {
      icon: getResourceUrl("assets/forgeIcon.png"),
      onClick: () => {
        $(".content:not(.d-none)").addClass("d-none");
        $("#forge-container").removeClass("d-none");
        $("#header-icon").attr("src", getResourceUrl("assets/forgeIcon.png"));
        $("#header-title").text("Forge");
        $(".content-header.game-page-header")
          .removeClass(function (index, className) {
            return (className.match(/(^|\s)bg-\S+/g) || []).join(" ");
          })
          .addClass("bg-runesmithing-forge");
        if ($(window).width() < 992) {
          $('[data-action="sidebar_close"]').trigger("click");
        }
      },
    });

    $(document).on("click", ".nav-main-item", function () {
      const clickedItemName = $(this).find(".nav-main-link-name").text().trim();
      if (clickedItemName !== "Forge") {
        $(".content-header.game-page-header").removeClass("bg-runesmithing-forge");
        $("#forge-container").addClass("d-none");
      }
    });
  });
}
