self.on('message', function(data){
	$('#result').val(data)
})

$(function(){
$('#copy-btn').click(function(){
self.port.emit('copy', $('textarea').val())
});

$('#save-btn').click(function(){
self.port.emit('save', $('textarea').val())
})
})

