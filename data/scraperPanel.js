self.on("message", function (scrapper){
	$('input[name="name"]').val(scrapper.name);
	$('input[name="url_match"]').val(scrapper.url);
	$('textarea.editor').val(scrapper.script)
});


$(function () {
	var $name=$('input[name="name"]'),
			$url=$('input[name="url_match"]'),
			$script=$('textarea.editor');
			
	self.on("message", function (scrapper){
	$name.val(scrapper.name);
	if (scrapper.name) {
		$name.attr('disabled', true)
	}
	else {
		$name.attr('disabled', false)
	};
	$url.val(scrapper.url);
	$script.val(scrapper.script)
	});	
	
	function check()  {
		var ok=true;
		$.each([$name, $url, $script], function () {
			this.removeClass('error');
			if (! this.val()) {
				this.addClass('error');
				ok=false
			}
		});
		return ok
	};	
	
	function send(signal) {
		var scrapper={
			name: $name.val(),
			url: $url.val(),
			script: $script.val()
		};
		if (check()){
		self.port.emit(signal, scrapper);
		}
	};
	
	
	
	$('#apply-btn').click(function () {
		send('apply')
	});
	
	$('#save-btn').click(function() {
		send('save')
	});
	
	$('#delete-btn').click(function(){
		send('delete')
	});
	
	$('#tab-btn').click(function(){
		send('tab')
	});
	
	$('#copy-btn').click(function(){
		send('copy')
	})
});
