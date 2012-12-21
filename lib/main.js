var widgets = require('widget'),
 data = require('self').data,
 tabs = require('tabs'),
 request = require('request').Request,
 panels = require('panel'),
 store = require('simple-storage').storage,
 Scraper = require('scraper').Scraper,
 clipboard = require("clipboard"),
 {Cc, Ci} = require("chrome"),
 file = require("file"),
 privateBrowsing=require("private-browsing"),
 preferences=require("simple-prefs"),
 prefs=preferences.prefs;


if (!store.scrapeScripts) {
	store.scrapeScripts = {}
}

require('simple-storage').on("OverQuota", function () {
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
			contentScript:'$(\'<div id="ffscrapperMessage" style="position: absolute; font-size: 32px;'+ 
				'font-weight: bold; color: red;  z-index: 999;">Scraping in progress...</div>\').appendTo($("body")).center();'+
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

function getScraperForTab(tab) {
	if (!tab)
		tab = tabs.activeTab;
	delete tab.scraperDef;
	var scraper;
	for (key in store.scrapeScripts) {
		scraper = store.scrapeScripts[key];
		if (tab.url.match(/^http/) && matchURL(scraper.url, tab.url)) {
			console.debug('Scraper ' + scraper.name + ' set as active');
			if (!tab.scraperDef)
				tab.scraperDef = [scraper.name]
			else
				tab.scraperDef.push(scraper.name)

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
	var win = require("window/utils").getMostRecentBrowserWindow();

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

var widget = widgets.Widget({
	id : 'ffscrap',
	label : 'Scraping plugin',
	contentScriptWhen : 'start',
	contentScriptFile : data.url('widget-content.js'),
	contentURL : data.url('scraping1.png'),
	onAttach : function(worker) {
		console.debug('Widget attached');
	}
});

widget.port.on('left-click', function() {
	console.debug("Left click in tab", tabs.activeTab.url, tabs.activeTab.scraperDef)
	selectScraper(function(scraper) {
		applyScraper(scraper)
	}, null, "Select Scraper to Run")
})

widget.port.on('right-click', function() {
	var scraper;
	console.debug('Right click');
  if (!tabs.activeTab.url.match(/^http/)) return;
  
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
	enableIcon(tab)

})

tabs.on('ready', function(tab) {
	getScraperForTab(tab);
	console.debug('Tab loaded', tab.title, tab.scraperDef);
	enableIcon(tab)
})
function enableIcon(tab) {
	if (tab === tabs.activeTab) {
		if (tab.scraperDef) {
			widget.contentURL = data.url('scraping2.png');
			widget.contentURL = data.url('scraping1.png');
		} else {
			widget.contentURL = data.url('scraping1.png');
			;
			widget.contentURL = data.url('scraping2.png');

		}
	}

}
