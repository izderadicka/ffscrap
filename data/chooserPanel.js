self.on('message', function(data){
	data.items.sort();
	$('h1').text(data.title);
	$list=$('ul.selector');
	$list.empty();
	for (var i=0;i<data.items.length;i+=1) {
		$('<li>', {class:"existing"}).text(data.items[i])
		.appendTo($list).data("name", data.items[i]).click(function(){
			self.port.emit('select', $(this).data('name'));
		})
	}
	if (data.create) {
		$('<li>', {class:"new"}).text('<Create New Scrapper>').appendTo($list).click(function(){
			self.port.emit("new")
		})
	}
	
})
