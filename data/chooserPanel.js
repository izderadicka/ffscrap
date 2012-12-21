self.on('message', function(data){
	data.items.sort();
	$('h1').text(data.title);
	$list=$('ul.selector');
	$list.empty();
	for (var i=0;i<data.items.length;i+=1) {
		$('<li class="existing">'+data.items[i]+'</li>').appendTo($list).data("name", data.items[i]).click(function(){
			self.port.emit('select', $(this).data('name'));
		})
	}
	if (data.create) {
		$('<li class="new">&lt;Create New Scrapper&gt;</li>').appendTo($list).click(function(){
			self.port.emit("new")
		})
	}
	
})
