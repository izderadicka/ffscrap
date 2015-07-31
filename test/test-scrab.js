var data=require('sdk/self').data;
var tabs=require('sdk/tabs');



var spec1={
   		"selector":"table.kurzy_tisk", 
   		"rowsRange": 1,
   		"row":{"selector":"tr", "fields": [
   			{"selector": "td:eq(0)",
   			 "name":"country"},
   			{"selector": "td:eq(1)",
   			 "name":"currency"},
   			 {"selector":"td:eq(2)",
   			  "name":"quatity",
   			  "type":"int"},
   			  {"selector":"td:eq(3)",
   			   "name":"code"},
   			  {"selector":"td:eq(4)", 
   			   "name":"rate",
   			   "preprocess": "numberNormalizeCZ",
   			   "type":"float"}
   			 ] }};
   			 
var spec2= {
   		"selector":"table", 
   		"rowsRange": 1,
   		"row":{"selector":"tr", "fields": [
   			{"selector": "td:eq(0)",
   			 "name":"string"},
   			{"selector": "td:eq(1)",
   			 "name":"int",
   			 "type":"int"},
   			 {"selector":"td:eq(2)",
   			  "name":"float",
   			  "type":"float"},
   			  {"selector":"td:eq(3)",
   			   "name":"boolean",
   			   "type":"boolean"},
   			  {"selector":"td:eq(4)", 
   			   "name":"int in input",
   			   "type":"int",
   			   "source":"input"},
   			  {"selector":"td:eq(5)",
   			  	"name":"href",
   			  	"source":"attr:href"},
   			  {"selector":"td:eq(6)",
   			  	"name":"fuzzy float",
   			  	"type":"float",
   			  	"preprocess":"normalizeNumber"}
   			 ] }};
   			 
   			 
var specErr1= '{"selector":"table", "rowsRange": 1, "row":{selector:"tr", fields: [{"selector": "td:eq(0)","name":"string"}] }}';
var specCorr1= '{"selector":"table", "rowsRange": 1, "row":{"selector":"tr", "fields": [{"selector": "td:eq(0)","name":"string"}] }}';
var specErr2= '{"seleptor":"table", "rowsRange": 1, "row":{"selector":"tr", "fields": [{"selector": "td:eq(0)"}] }}';

   			 
var testData=[{"string":"aaa\"a", "int":1, "float":1.2, "boolean":true, "int in input":2, "href":"http://neco", "fuzzy float":3.2}];

exports["test scrap"] = function(assert, done) {
	tabs.on('ready', function(tab) {
		if (tab.title!=="TEST1") return;
		console.log('Tab open', tab.url)
		var worker=tab.attach({
			contentScriptFile: [ data.url('jquery-2.1.4.min.js'),data.url('scraper.js')],
			contentScript: 'self.on("message", function(script) { var res=scraper(script)(document); self.postMessage(res)});',
			onMessage: function(data) {
				console.log('Data received', tab.url);
				assert.ok(data, 'Has some data');
				assert.equal(data.length, 34, "Has 34 rows")
				tab.close()
				done()
			}
		});
		
		worker.postMessage(spec1);
   			 
   		
	})
	tabs.open(data.url('test/test.html'));
}

exports["test scrap2"] = function(assert, done) {
	tabs.on('ready', function(tab) {
		if (tab.title!=="TEST2") return;
		console.log('Tab open', tab.url)
		var worker=tab.attach({
			contentScriptFile: [ data.url('jquery-2.1.4.min.js'),data.url('scraper.js')],
			contentScript: 'self.on("message", function(script) { var res=scraper(script)(document); self.postMessage(res)});',
			onMessage: function(data) {
				console.log('Data received', tab.url);
				assert.ok(data, 'Has some data');
				assert.equal(data.length, 3, "Has 3 rows")
				tab.close()
				done()
			}
		});
		
		worker.postMessage(spec2);	
	})
	tabs.open(data.url('test/test2.html'));
	
	
}

var formatter=require('lib/format').formatter;

exports.testCSV= function (assert) {
	var formatter=require('lib/format').formatter;
	assert.ok(formatter, "Export formatter is defined")
	var res=formatter(testData, spec2).csv();
	console.log("Result CSV",res)
	assert.equal(res, '"string","int","float","boolean","int in input","href","fuzzy float"\r\n'+
			'"aaa\"\"a",1,1.2,true,2,"http://neco",3.2\r\n')
	assert.ok(res, "Resource not null")
}

var Scraper=require('lib/scraper').Scraper;
exports.testScraper= function(assert) {
	var s=new Scraper({script:specErr1});
	var errors= s.testScript();
	console.log(errors);
	assert.ok (errors, 'Should have syntactic error')
	
	s=s=new Scraper({script:specCorr1});
	errors=s.testScript();
	assert.ok (!errors, 'Errors specCorr1: '+errors)
	
	s=s=new Scraper({script:JSON.stringify(spec1)});
	errors=s.testScript();
	assert.ok (!errors, 'Errors spec1: '+errors)
	
	s=s=new Scraper({script:JSON.stringify(spec2)});
	errors=s.testScript();
	assert.ok (!errors, 'Errors spec2: '+errors)
	
	s=new Scraper({script:specErr2});
	errors= s.testScript();
	console.log(errors);
	assert.ok (errors, 'Should have semantic errors');
	assert.equal(errors.split('\r\n').length-1, 2)
}

require("sdk/test").run(exports);
