self.on('message', function(data){
	$('h1').text(data.title);
	$('div#errors').html(data.text.replace('\r', '').replace('\n', '<br/>'));
});

$(function(){
	$('#close-btn').click(function () {
		self.postMessage('close')
	})
})
