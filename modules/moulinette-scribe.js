/*************************
 * Translations
 *************************
 * 
 * Supported languages (don't remove!) 
 * "mtte.lang.en"
 * "mtte.lang.fr"
 * "mtte.lang.de"
 * "mtte.lang.it"
 * "mtte.lang.es"
 * "mtte.lang.cn"
 * "mtte.lang.ja"
 * "mtte.lang.ko"
 * "mtte.lang.pt-BR"
 * "mtte.lang.sv"
 */
export class MoulinetteScribe extends FormApplication {
  
  constructor(scene) {
    super()
    this.onlyMyNeed = false;
    this.onlyMyLang = false;
    this.includeCore = true;
    this.includeBabele = true;
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "moulinette",
      classes: ["mtte", "scribe"],
      title: game.i18n.localize("mtte.moulinetteScribe"),
      template: "modules/moulinette-scribe/templates/scribe.hbs",
      width: 800,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    if (!game.user.isGM) {
      return { error: game.i18n.localize("mtte.errorGMOnly") }
    }
    
    let client = new game.moulinette.applications.MoulinetteClient()
    let lists = await client.get("/bundler/fvtt/packs")
    const lang = game.settings.get("core", "language")
    const filterLang = game.i18n.format("mtte.filterLang", { lang: game.i18n.localize("mtte.lang." + lang) })
    
    // filter list
    if(this.onlyMyNeed) {
      const modules = game.modules.keys()
      lists.data.transl = lists.data.transl.filter(t => (!t.system || t.system == game.system.id) && (!t.module || t.module in modules))
    }
    if(this.onlyMyLang) {
      lists.data.transl = lists.data.transl.filter(t => t.lang == lang)
    }
    if(!this.includeCore) {
      lists.data.transl = lists.data.transl.filter(t => t.type != "core-translation")
    }
    if(!this.includeBabele) {
      lists.data.transl = lists.data.transl.filter(t => t.type != "babele-translation")
    }
    // prepare
    if( lists && lists.status == 200 ) {
      this.lists = lists.data
      let scCount = 0;
      this.lists.transl.forEach( tr => {
        tr.source = { name: tr.source.split('|')[0], url: tr.source.split('|')[1] }
        tr.name = `(${game.i18n.localize("mtte.lang." + tr.lang)}) ${tr.name}`
      })
      return { 
        filterModSysEnabled: this.onlyMyNeed, 
        filterLangEnabled: this.onlyMyLang, 
        filterCore: this.includeCore, 
        filterBabele: this.includeBabele, 
        filterLang: filterLang,
        lists: this.lists 
      }
    } else {
      console.log(`Moulinette Scribe | Error during communication with server ${game.moulinette.applications.MoulinetteClient.SERVER_URL}`, lists)
      return { error: game.i18n.localize("mtte.errorServerCommunication") }
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.bringToTop()
    const window = this;
  
    // filter function
    html.find("#searchTransl").on("keyup", function() {
      let filter = $(this).val().toLowerCase()
      $('#translPacks *').filter('.pack').each(function() {
        const text = $(this).text().trim().toLowerCase() + $(this).attr("title");
        $(this).css('display', text.length == 0 || text.indexOf(filter) >= 0 ? 'flex' : 'none')
      });
      window._alternateColors();
    });
    
    this.html = html
    
    // toggle filters
    html.find("#filterModSys").click(this._toggleFilter.bind(this))
    html.find("#filterLang").click(this._toggleFilterLang.bind(this))
    html.find("#filterCore").click(this._toggleCore.bind(this))
    html.find("#filterBabele").click(this._toggleBabele.bind(this))
    
    // buttons
    html.find("button").click(this._onClickButton.bind(this))
    
    // enable alt _alternateColors
    this._alternateColors()
  }
  
  _toggleFilter(event) {
    this.onlyMyNeed = !this.onlyMyNeed;
    this.render()
  }
  
  _toggleFilterLang(event) {
    this.onlyMyLang = !this.onlyMyLang;
    this.render()
  }
  
  _toggleCore(event) {
    this.includeCore = !this.includeCore;
    this.render()
  }
  
  _toggleBabele(event) {
    this.includeBabele = !this.includeBabele;
    this.render()
  }
  
  _alternateColors() {
    $('#translPacks .pack').removeClass("alt");
    $('#translPacks .pack:even').addClass("alt");
  }
  
  async _onClickButton(event) {
    event.preventDefault();
    const source = event.currentTarget;
    const window = this
    if (source.classList.contains("install")) {
      const names = []
      this.html.find("#translPacks .check:checkbox:checked").each(function () {
        names.push($(this).attr("name"))
      });
      const selected = this.lists.transl.filter( ts => names.includes(ts.id) )
      if(selected.length == 0) {
        return ui.notifications.error(game.i18n.localize("mtte.errorSelectAtLeastOne"))
      }
      this._installPacks(selected)
    }
    else if (source.classList.contains("clear")) {
      this.html.find("#translPacks .check:checkbox:checked").prop('checked', false);
    }
    else if (source.classList.contains("update")) {
      let packInstalled = game.settings.get("moulinette", "packInstalled")
      const selected = this.lists.transl.filter( ts => packInstalled.includes(ts.filename) )
      let namesList = ""
      selected.forEach(s => namesList += `<li>${s.name}</li>`)
      Dialog.confirm({
        title: game.i18n.localize("mtte.updateAction"),
        content: game.i18n.format("mtte.updateContent", { count: selected.length }) + `<ul>${namesList}</ul>`,
        yes: async function() {
          window._installPacks(selected)
        },
        no: () => {}
      });
    }
  }
  
  /**
   * Downloads and installs all selected translations
   */
  async _installPacks(selected) {
    this.inProgress = true
    let client = new game.moulinette.applications.MoulinetteClient()
    
    let babeleInstalled = false
    let coreInstalled = false
    
    try {
      // installed packs
      let packInstalled = game.settings.get("moulinette", "packInstalled")
      // backwards compatibility
      if(typeof packInstalled === "string" || packInstalled instanceof String) {
        packInstalled = JSON.parse(packInstalled)
        game.settings.set('moulinette', 'packInstalled', packInstalled)
        console.log(`Moulinette Scribe | Setting packInstalled successfully migrated!`)
      }
      
      // iterate on each desired request
      for( const r of selected ) {
        const response = await fetch(`${game.moulinette.applications.MoulinetteClient.GITHUB_SRC}/main${r.url}`).catch(function(e) {
          console.log(`Moulinette Scribe | Not able to fetch JSON for pack ${r.name}`, e)
        });
        if(!response) continue;
        const pack = await response.json()
        
        if(r.type == "babele-translation" && (!"babele" in game.modules.keys() || !game.modules.get("babele").active)) {
          ui.notifications.error(game.i18n.localize("mtte.errorNoBabele"));
          continue;
        }
        
        // initialize progressbar
        SceneNavigation._onLoadProgress(r.name,0);  
        
        // retrieve all translations from pack
        let idx = 0
        for( const ts of pack.list ) {
          idx++;
          
          // retrieve transl JSON
          const filename = ts.url.split('/').pop()
          let response = await fetch(`${ts.url}`).catch(function(e) {
            console.log(`Moulinette Scribe | Not able to fetch translation of pack ${pack.name}`, e)
          });
          if(!response) {
            console.log("Moulinette Scribe | Direct download not working. Using proxy...")
            response = await client.fetch(`/bundler/fvtt/transl/${pack.id}/${idx-1}`)
            if(!response) {
              console.log("Moulinette Scribe | Proxy download not working. Skip.")
              continue;
            }
          }
          const blob = await response.blob()
          
          // Babele translations
          if(r.type == "babele-translation") {
            const folder = `moulinette/transl/babele/${r["lang"]}`
            await game.moulinette.applications.MoulinetteFileUtil.upload(new File([blob], filename, { type: blob.type, lastModified: new Date() }), filename, "moulinette/transl/babele", folder, true)
            babeleInstalled = true
            if(!packInstalled.includes(r.filename)) packInstalled.push(r.filename)
          } 
          // Core/system translation
          else if(r.type == "core-translation") {
            const folder = `moulinette/transl/core/${r["lang"]}`
            const transFilename = `${r["filename"]}-${filename}`
            await game.moulinette.applications.MoulinetteFileUtil.upload(new File([blob], transFilename, { type: blob.type, lastModified: new Date() }), transFilename, "moulinette/transl/core", folder, true)
            coreInstalled = true
            if(!packInstalled.includes(r.filename)) packInstalled.push(r.filename)
          }
          
          // update progressbar
          SceneNavigation._onLoadProgress(r.name, Math.round((idx / pack.list.length)*100));
        }
      }
      
      // cleanup installed packages (avoid two conflicting translations)
      let core = []
      let modules = []
      let systems = []
      let packInstalledClean = []
      packInstalled.slice().reverse().forEach( installed => {
        const pack = this.lists.transl.find( tr => tr.filename == installed )
        if(!pack) return
        if(pack.system && !systems.includes(`${pack.type}-${pack.lang}-${pack.system}`)) {
          systems.push(`${pack.type}-${pack.lang}-${pack.system}`)
          packInstalledClean.push(installed)
        }
        else if(pack.module && !modules.includes(`${pack.type}-${pack.lang}-${pack.module}`)) {
          modules.push(`${pack.lang}-${pack.module}`)
          packInstalledClean.push(installed)
        } else if(!pack.module && !pack.system && !core.includes(pack.lang)) {
          core.push(pack.lang)
          packInstalledClean.push(installed)
        } else {
          console.log(`Moulinette Scribe | Translation ${installed} removed from list because in conflict with another`)
        }
      });
      
      
      // store settings (installed packs)
      game.settings.set("moulinette", "packInstalled", packInstalledClean)
      
      if(babeleInstalled) {
        game.settings.set('babele', 'directory', "moulinette/transl/babele")
        ui.notifications.info(game.i18n.localize("mtte.downloadSuccess"))
      } 
      if(coreInstalled) {
        let languages = []
        let browse = await FilePicker.browse(game.moulinette.applications.MoulinetteFileUtil.getSource(), "moulinette/transl/core");
        for( const d of browse.dirs ) {
          const lang = d.split('/').pop()
          const data = await FilePicker.browse(game.moulinette.applications.MoulinetteFileUtil.getSource(), d, {'extensions': ['.json']});
          data.files.forEach( f => {
            languages.push( {
              "lang": lang,
              "name": game.i18n.localize("mtte.lang." + lang),
              "path": f
            })
          });
        }
        game.settings.set("moulinette", "coreLanguages", languages)
        ui.notifications.info(game.i18n.localize("mtte.downloadCoreSuccess"))
      }
      
    } catch(e) {
      console.log(`Moulinette Scribe | Unhandled exception`, e)
      ui.notifications.error(game.i18n.localize("mtte.downloadFailure"))
    }
    
    // hide progressbar
    SceneNavigation._onLoadProgress(game.i18n.localize("mtte.installingPacks"), 100);
  }
    
}
