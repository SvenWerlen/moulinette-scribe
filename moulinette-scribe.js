
Hooks.once("init", async function () {
  console.log("Moulinette Scribe | Init")
  game.settings.register("moulinette", "packInstalled", { scope: "world", config: false, type: Object, default: [] })
  game.settings.register("moulinette", "coreLanguages", { scope: "world", config: false, type: Object, default: [] })
  
  // dynamically add languages
  let coreLang = game.settings.get("moulinette", "coreLanguages")
  if(coreLang) {
    // backwards compatibility
    if(typeof coreLang === "string" || coreLang instanceof String) {
      coreLang = JSON.parse(coreLang)
      game.settings.set('moulinette', 'coreLanguages', coreLang)
      console.log(`Moulinette Scribe | Setting coreLanguages successfully migrated!`)
    }
    const langList = coreLang
    langList.forEach( l => {
      console.log(`Moulinette Scribe | Dynamic translation ${l.path}`)
      game.modules.get("moulinette-scribe").languages.push(l)
    })
  }
})

/**
 * Ready: defines a shortcut to open Moulinette Interface
 */
Hooks.once("ready", async function () {
  if (game.user.isGM) {
    // load module
    game.moulinette.modules.push({
      id: "scribe",
      name: game.i18n.localize("mtte.moulinetteScribe"),
      descr: game.i18n.localize("mtte.moulinetteScribeHelp"), 
      icon: "modules/moulinette-scribe/img/scribe-icon.png",
      class: (await import("./modules/moulinette-scribe.js")).MoulinetteScribe
    })
  }
})
   


