function submit(){
	var q_title = document.getElementById("title").value
	var q_body = document.getElementById("body").value
	var q_tags = document.getElementById("tags").value.split(",")
	$.ajax({
		type: "POST",
		url: "/questions/add",
		data: JSON.stringify({title: q_title, body: q_body, tags: q_tags}),
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
		alert("Your question has been posted")
	}
}