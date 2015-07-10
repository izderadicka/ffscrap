var
 data = require('sdk/self').data,
 tabs = require('sdk/tabs'),
 request = require('sdk/request').Request,
 panels = require('sdk/panel'),
 {ToggleButton} = require('sdk/ui/button/toggle'),
 store = require('sdk/simple-storage').storage,
 Scraper = require('scraper').Scraper,
 clipboard = require("sdk/clipboard"),
 {Cc, Ci} = require("chrome"),
 file = require("sdk/io/file"),
 privateBrowsing=require("sdk/private-browsing"),
 preferences=require("sdk/simple-prefs"),
 prefs=preferences.prefs;


var button = ToggleButton({
	id: 'ffscrap-button',
	label: 'ffscrap Toolbar button',
	icon: {
		"16": "./scraping2.png",
		"32": "./scraping2.png"
	    },
	onClick: showScraperMenu,
});

if (!store.scrapeScripts) {
	store.scrapeScripts = {}
}

require('sdk/simple-storage').on("OverQuota", function () {
	errorPanel.run({title:'Save Error', 
	text:'Storage quota reach, your last scraping script may not be saved, delete some previous scripts to gain space'})
});

function loadRemoteDefs() {
	
		if (!prefs.scraperSource && ! prefs.scraperSource.match(/^http/)) return
		console.log("Loading remote scraper scripts definitions from "+prefs.scraperSource);
		
		var req=request({url:prefs.scraperSource,
										onComplete: function(response) {
											
		if (!response || parseInt(response.status)>=400) {
			console.error("Cannot load remote file "+response.status+' '+response.statusText)
		}
		var scripts=response.json;
		if (scripts.length===undefined) {
			console.error("Remote scraper scripts definitions must be an array")
		}
		for (var i=0;i<scripts.length;i+=1) {
			var script= scripts[i];
			if (script.name && script.url && script.script) {
				saveScript(script)
			}
			else {
				log.error("Script must have name, url and script members")
			}
		}	
	}});
	req.get();
	
}

loadRemoteDefs();
preferences.on('scraperSource', loadRemoteDefs);


function saveScript(script) {
	if (privateBrowsing.isActive) {
		errorPanel.run({title:"Save Error",text:"Nothing is stored because private browsing is on"});
		return
	}
	store.scrapeScripts[script.name] = script;
	updateAllTabs();
}

function deleteScript(script) {
	delete store.scrapeScripts[script.name];
	updateAllTabs()
}

function applyScraper(scraper) {
	scraper = new Scraper(scraper);
	var errors = scraper.testScript();
	if (errors) {
		console.error('Scraper ' + scraper.name + ' has following errors:\r\n', errors);
		errorPanel.run({
			text : errors,
			title : "Scraping Script Errors"
		})
	} else {
		var script = scraper.compiledScript(),
		worker,
		theTab=tabs.activeTab;
		function scaperDone() {
			var worker2=theTab.attach({
			contentScriptFile : [data.url('jquery-1.8.3.min.js')],
			contentScript:'$("#ffscrapperMessage").remove();$("body").css("cursor", "")'
		});
		worker2.destroy();
		worker.destroy()
		}
		
		worker=theTab.attach({
			contentScriptFile : [data.url('jquery-1.8.3.min.js'), data.url('center.js')],
			contentScript:'$("<div>", {id:"ffscrapperMessage", style:"position: absolute; font-size: 32px;'+ 
				'font-weight: bold; color: red;  z-index: 999;"}).text("Scraping in progress...").appendTo($("body")).center();'+
				'$("body").css("cursor", "wait")'
		});
		worker.destroy();
		
		worker = tabs.activeTab.attach({
			contentScriptFile : [data.url('jquery-1.8.3.min.js'), data.url('scraper.js')],
			contentScript : 'self.on("message", function(script) { var res=scraper(script)(document); self.postMessage(res)});',
			onMessage : function(data) {
				console.debug('Data received', data && data.length);
				var csv = require('format').formatter(data, script).csv();
				scaperDone();
				resultPanel.run(csv)
			}
		});
		worker.port.on('error', function(msg) {
			console.error('Scraper ' + scraper.name + ' remote error:\r\n', msg);
			scaperDone();
			errorPanel.run({
				text : msg,
				title : "Scraping Data Error"
			})
		})
		worker.postMessage(script)
	}
}

function matchURL(pattern, url) {
	pattern=pattern.replace(/[\\\^\$\+\?\.\(\)\{\}\[\]]/g, "\\$&");
	pattern=pattern.replace(/\*/g, ".*");
	if (pattern[0] != '^')
		pattern = '^' + pattern;
	var regExp = new RegExp(pattern);
	console.debug('Testing ' + url + ' against ' + pattern + ' with result ' + regExp.test(url));
	return regExp.test(url)
}

function clearURL(url) {
	var clean=url.replace(/^wyciwyg:\/\/\d+\//, '');
	return clean
}

function getScraperForTab(tab) {
	var scraper, 
			url;
	if (!tab)
		tab = tabs.activeTab;
	delete tab.scraperDef;
	for (key in store.scrapeScripts) {
		scraper = store.scrapeScripts[key];
		url= clearURL(tab.url);
		if (url.match(/^http/) && matchURL(scraper.url, url)) {
			console.debug('Scraper ' + scraper.name + ' set as active');
			if (!tab.scraperDef) {
				tab.scraperDef = [scraper.name]
			} else {
				tab.scraperDef.push(scraper.name)
			}
		} else {
			//console.debug("Url "+ url + " not matching "+scraper.url)
		}
	}
}

function updateAllTabs() {
	for (var i = 0; i < tabs.length; i += 1)
		getScraperForTab(tabs[i]);
	enableIcon(tabs.activeTab)
}

function selectScraper(onSelected, onNew, title) {
	if (tabs.activeTab.scraperDef) {
		if (tabs.activeTab.scraperDef.length === 1 && ! onNew) {
			var scraper = store.scrapeScripts[tabs.activeTab.scraperDef[0]];
			onSelected(scraper)
		} else {
			//TODO: Selection Dialog
			var selectPanel=createPanel({
				width:300,
				height:300,
				contentURL: data.url('chooserPanel.html'),
				contentScriptFile:[data.url('jquery-1.8.3.min.js'), data.url('chooserPanel.js')]
			});
			
			selectPanel.run({items:tabs.activeTab.scraperDef,
											 create: onNew? true: false,
											 title: onNew? 'Edit Scraper' : 'Apply Scraper'});
											 
			selectPanel.port.on("select", function (name) {
				onSelected(store.scrapeScripts[name]);
				selectPanel.hide();
				selectPanel.destroy();
			});
			
			selectPanel.port.on("new", function () {
				onNew();
				selectPanel.hide();
				selectPanel.destroy();
			});
			
		}
		

	} else {
		if (onNew && typeof onNew === 'function')
			onNew()
	}
}

function createPanel(options) {
	var panel = panels.Panel(options);
	panel.run = function(data) {
		var that=this,
				onShow=function() {
			  that.postMessage(data);
			  that.removeListener('show', onShow)
		}
		this.show();
		this.on('show', onShow);
	};
	return panel
}

var menuPanel = createPanel({
	width: 300,
	height: 200,
	contentURL: data.url('menuPanel.html'),
	contentScriptFile:[data.url('jquery-1.8.3.min.js'), data.url('menuPanel.js')],
	onHide: handleMenuHide
});

var resultPanel = createPanel({
	width : 530,
	height : 500,
	contentURL : data.url('resultPanel.html'),
	contentScriptFile : [data.url('jquery-1.8.3.min.js'), data.url('resultPanel.js')]
});

resultPanel.port.on("copy", function(data) {
	clipboard.set(data);
	resultPanel.hide();
})
resultPanel.port.on("save", function(data) {

	var picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
	var win = require("sdk/window/utils").getMostRecentBrowserWindow();

	console.debug("Right window", win, win instanceof Ci.nsIDOMWindow);
	picker.init(win, "Save as", Ci.nsIFilePicker.modeSave);
	picker.appendFilter("Text (CSV)", "*.csv");
	var rv = picker.show();
	if (rv == Ci.nsIFilePicker.returnOK || rv == Cif.nsIFilePicker.returnReplace) {
		var path = picker.file.path;
		console.debug("Saving to file", path);
		var writer = file.open(path, 'w');
		writer.write(data);
		writer.close();

	}
})
var errorPanel = createPanel({
	width : 530,
	height : 500,
	contentURL : data.url('errorPanel.html'),
	contentScriptFile : [data.url('jquery-1.8.3.min.js'), data.url('errorPanel.js')]
});

errorPanel.on('message', function() {
	errorPanel.hide()
})

var editPanel = createPanel({
	width : 530,
	height : 500,
	contentURL : data.url('scraperPanel.html'),
	contentScriptFile : [data.url('jquery-1.8.3.min.js'), data.url('scraperPanel.js')]
});

editPanel.port.on('apply', function(scraper) {
	console.debug("applying scraper", scraper);
	editPanel.hide();
	saveScript(scraper);
	applyScraper(scraper)
});

editPanel.port.on('save', function(scraper) {
	console.debug("saving scraper", scraper)
	saveScript(scraper);
	editPanel.hide()
});

editPanel.port.on('delete', function(scraper) {
	console.debug("deleting scraper");
	deleteScript(scraper);
	editPanel.hide()
});

editPanel.port.on('copy', function(scraper) {
	clipboard.set(JSON.stringify(scraper));
});

editPanel.port.on('tab', function(scraper) {
	var originTab=tabs.activeTab;
	tabs.open({url:data.url('scraperPanel.html'),
	onReady: function(editTab) {
	var worker=editTab.attach({
		contentScriptFile :[data.url('jquery-1.8.3.min.js'), data.url('scraperPanel.js')],
		contentScript:'$(function(){$("#tab-btn").hide();$("#delete-btn").hide();$("#apply-btn").attr("value", "Apply on Previous Page")})'
	});
	editPanel.hide();
	worker.postMessage(scraper);
	
	worker.port.on('apply', function(scraper) {
	console.debug("applying scraper", scraper);
	function apply(tab) {
		applyScraper(scraper);
		tab.removeListener('activate',apply)
		
	}
	originTab.activate();
	saveScript(scraper);
	originTab.on('activate', apply)
	
});

  worker.port.on('save', function(scraper) {
	console.debug("saving scraper", scraper)
	saveScript(scraper);
	
});
	
	editTab.on('close', function(){
		worker.destroy()
	})
}})
});

menuPanel.port.on('left-click', function() {
	console.debug("Left click in tab", tabs.activeTab.url, tabs.activeTab.scraperDef)
	selectScraper(function(scraper) {
		applyScraper(scraper)
	}, null, "Select Scraper to Run")
})

menuPanel.port.on('right-click', function() {
	var scraper;
	console.debug('Right click');

	selectScraper(function(scraper) {
		editPanel.run(scraper)
	}, function() {
		editPanel.run({
			url : tabs.activeTab.url,
			script : data.load('scrap_spec.json')
		})
	}, "Select Scraper to Edit")
})

tabs.on('activate', function(tab) {
	console.debug('Tab activated ', tab.title, tab.scraperDef);
	enableIcon(tab);
})

tabs.on('ready', function(tab) {
	getScraperForTab(tab);
	console.debug('Tab loaded', tab.title, tab.scraperDef, clearURL(tab.url));
	enableIcon(tab);
})

function showScraperMenu(state){
	console.debug('Showing menu', state.checked);
	if(state.checked){
		if (tabs.activeTab.scraperDef) {
			menuPanel.run({items:tabs.activeTab.scraperDef});
		}else{
			menuPanel.run();
		}
	}
}

function handleMenuHide(){
	button.state('window', {checked: false});
}

function enableIcon(tab){
	if (tab === tabs.activeTab) {
		 if (!clearURL(tabs.activeTab.url).match(/^http/)) {
			// if it's an unsupported URL,
			console.debug('Unsupported url '+ tabs.activeTab.url);
			button.disabled	 = true;
			button.badge = null;
		}else{
			button.disabled = false;
			if(tab.scraperDef){
				button.badge = tab.scraperDef.length;
			}else{
				button.badge = null;
			}
		}
	}
}
