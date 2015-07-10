self.on('message', function(data){

	if(data && data.items.length > 0){
		$('li.choose').click(function(){
		self.port.emit('left-click')
		}).show()
	}
	else{
		$('li.choose').hide()
	}

	$('li.edit').click(function(){
		self.port.emit('right-click')
	})
})
