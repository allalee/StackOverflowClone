function submit(){
	var q_timestamp = document.getElementById("timestamp").value
	var q_limit = document.getElementById("limit").value
	var q_accepted = document.getElementById("accepted").value
	console.log(q_timestamp)
	console.log(q_limit)
	console.log(accepted)
	$.ajax({
		type: "POST",
		url: "/search",
		data: JSON.stringify({timestamp: q_timestamp, limit: q_limit, accepted: q_accepted}),
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
		alert("Here are your questions!")
	}
}