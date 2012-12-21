var scraper=(function () {
	
	
	//utility functions
	function limits(len, range) {
						if (typeof range ==="number") {
							return [range, len, 1]
						}
						else if (range && range.length && range.length>0) {
							var lims=[];
							lims.push(range[0]);
							var end = range[1];
							if (end && end <= 0) {
								end=len+end
							}
							lims.push(end || len);
							lims.push(range[2] || 1)
							return lims;
						}
						return [0, len, 1]
					};
					
					
		function preprocess(val, preprocessorName) {
			     if (preprocessorName && preprocessors[preprocessorName] && typeof preprocessors[preprocessorName] === "function") {
			     	return preprocessors[preprocessorName](val)
			     }
			
						return val
					}
					
		function convert(val, type) {
			
			switch (type ) {
				case "int": {
					val=parseInt(val);
				} break;
				case "float": {
					val=parseFloat(val)
				} break;
				case "boolean": {
					if (val.toLowerCase() in {'true':true, 'yes':true, 'y':true, '1':true}) val=true;
					else val=false;
				} break;
			}
			
			return val
		}
		
		function grab (elements, source) {
			if (source && source.substr(0, 5) ==='attr:') {
				var attrName=source.split(':')[1];
				return elements.attr(attrName)
			}
			else if (source==='input') {
				return elements.val()
			}
			
			return elements.text()
		}
					
					
		var preprocessors = {
			// First changes decimal mark to US standard (dot), then removes everything but numbers and decimal mark
			numberNormalizeCZ: function(val) {
				return preprocessors.numberNormalize(val.replace(',', '.'))
			},
			//Removes everything but digits and decimal mark dot
			numberNormalize: function(val) {
				return val.replace(/[^\d\.]/g, '')
			}
		}
	
	
	
		return function(script, options) {
				var scrap= function(rootElement) {	
					try {
					var root=$(script.selector),
							start,stop, step,
							data=[];
				  if (!root.length) {
				  	self.port.emit('error', "No root element found");
				  	return
				  }
					console.debug('Root is', root);
					rows= $(script.row.selector, root);
					if (!rows.length) {
				  	self.port.emit('error', "No row elements found");
				  	return
				  }
					[start,stop, step]=limits(rows.length, script.rowsRange);
					for (var i=start;i<stop;i+=step) {
						rowData={};
						for (var j=0; j<script.row.fields.length; j+=1) {
							var val=grab($(script.row.fields[j].selector, rows[i]), script.row.fields[j].source);
							val=preprocess(val, script.row.fields[j].preprocess)
							rowData[script.row.fields[j].name]=convert(val, script.row.fields[j].type);
						}
						data.push(rowData)
					}
					return data
					} catch (scrapingError) {
						self.port.emit("error", "Scraping Error: "+ scrapingError.toString())
					}
			}
			return scrap
		}
	
})();
