function submit(){
	var q_timestamp = document.getElementById("timestamp").value
	var q_limit = document.getElementById("limit").value
	var q_accepted = document.getElementById("accepted").value
	var q_query = document.getElementById("query").value
	var q_sortby = document.getElementById("sort_by").value
	var q_tags = document.getElementById("tags").value.split(",")
	var q_media = document.getElementById("hasmedia").value
	$.ajax({
		type: "POST",
		url: "/search",
		data: JSON.stringify({timestamp: q_timestamp, limit: q_limit, accepted: q_accepted, q: q_query, sort_by: q_sortby, tags: q_tags, has_media: q_media}),
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
	var questions_json = data.questions
	for(x = 0; x < questions_json.length; x++){
		var node = document.createElement("DIV")
		node.style.border = "thick solid #0000FF";
		var question_id = document.createTextNode("Question ID: " + questions_json[x].id)
		var question_content = document.createTextNode("User: " + questions_json[x].username + "\n\
			Title: " + questions_json[x].title + "\n\
			Body: " + questions_json[x].body + "\n\
			Views: " + questions_json[x].view_count + "\n\
			Answer Count: " + questions_json[x].answer_count + "\n\
			Timestamp: " + questions_json[x].timestamp + "\n\
			Media Tags: " + questions_json[x].media + "\n\
			Tags: " + questions_json[x].tags + "\n\
			Accepted Answer ID: " + questions_json[x].accepted_answer_id)
		node.append(question_id)
		node.append(question_content)
		document.getElementById("questions").appendChild(node)
	}
}