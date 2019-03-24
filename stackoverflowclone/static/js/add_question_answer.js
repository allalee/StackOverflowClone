function submit(){
	var q_body = document.getElementById("body").value
	var q_media = document.getElementById("media").value
	$.ajax({
		type: "POST",
		url: $(this).data('url'),
		data: JSON.stringify({body: q_body, media: q_media}),
		contentType: "application/json; charset=utf-8",
		success: function(data){
			check(data)
		},
		dataType: "json"
	});
}

function check(data){
	if(data.status == "error"){
		alert(data.error)
	} else {
		alert("Your answer has been posted")
	}
}