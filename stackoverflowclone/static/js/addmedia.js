function addmedia(){
	var form = new FormData()
	form.append('content', $("#media")[0].files[0])
	$.ajax({
		url: "/addmedia",
		method: "POST",
		processData: false,
		contentType: false,
		data: form,
		success: function(data){
			alert("Image has been uploaded!")
		},
		error: function(xhr, status, error){
			console.log(JSON.parse(xhr.responseText))
			alert("Image not uploaded!")
		}
	})
}