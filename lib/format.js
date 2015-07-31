
exports.formatter=function(data, definition) {
	var that={};
	function extend(obj) {
			for(var i= arguments.length-1; i>0; i-=1) {
				var extObj=arguments[i];
				for (var key in extObj) {
					if (extObj.hasOwnProperty(key))
						obj[key]=extObj[key]
				}
			}
		return obj
	}
	
	that.csv=function(specs) {
		var options=extend({}, specs, 
								{delim:',',
								lineEnd:'\r\n',
								enclose:'"',
								encloseAll:false,
								escape:'"'}),
				 result='',
				 fields=definition.row.fields,
				 header='',
				 row;
		function enclose(val, type) {
			function escape(str) {
				return str.replace(options.enclose, options.escape+options.enclose)
			}
			if (!val) return '';
			if (!type) type='string';
			if (options.encloseAll ||(type==='string')) {
				return options.enclose+escape(val)+options.enclose
			}
			else{
				return val 
			}
		}
		
		for (var h=0; h<fields.length; h+=1) {
			header+=options.enclose+fields[h].name+options.enclose;
			if (h<fields.length-1) header+=options.delim;
		}		
		header+=options.lineEnd;
		result=header;				
		for (var i=0; i< data.length; i+=1) {
			row='';
		for (var j=0; j<fields.length; j+=1){
			row+=enclose(data[i][fields[j].name], fields[j].type);
			if (j<fields.length-1) row+=options.delim;
		}
		result+=row+options.lineEnd
		}
	return result 
	}
	return that
}
