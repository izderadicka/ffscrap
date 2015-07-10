var data=require('sdk/self').data;


function Scraper(script) {
	this.name=script.name;
	this.url=script.url;
	this.script=script.script
	return this
}


Scraper.prototype.compiledScript=function () {
	return JSON.parse(this.script);
}

Scraper.prototype.testScript=function() {
	var compiled,
			errors='';
			eol='\r\n'
			
	function compareStruct(obj, etalon, level) {
		var key,
		errors='';
		if (!level) level="root";
		
		function formatMsg(message) {
			return message +' '+ key + " missing on level " + level +eol
		}
		
		
		for (key in etalon) {
			if (etalon.hasOwnProperty(key)) {
				if (typeof etalon[key] ==='string') {
					if (etalon[key].match(/\(mand\)/i) && !obj[key]) errors+=formatMsg("mandatory property")
				}
				else if (typeof etalon[key] === 'object' && etalon[key].constructor === Array) {
					if ( typeof obj[key] !== 'object' || obj[key].constructor !==Array) errors+= formatMsg("array property")
					else {
						for (var i=0; i<obj[key].length; i+=1) {
							errors+=compareStruct(obj[key][i], etalon[key][0], key+'['+i+']')
						}
					}
				}
				else if (typeof etalon[key] === 'object') {
					if ( typeof obj[key] !== 'object') errors+= formatMsg("object property")
					else {
						errors+=compareStruct(obj[key], etalon[key], key)
					}
				}
			}
		}
		return errors
	}
	
	try {
		compiled=JSON.parse(this.script)
	} catch (syntaxError) {
		errors+=syntaxError.toString()+eol
	}
	if (compiled) {
		// compare with spec
		var etalon=JSON.parse(data.load('scrap_spec.json'))
		errors+=compareStruct(compiled, etalon)
	}
	
	return errors
}

exports.Scraper=Scraper
