function submit(){
	var usrname = document.getElementById("username").value
	$.ajax({
		type: "GET",
		url: "/user/" + usrname,
		success: function(data){
			write_userdata(data)
		},
		error: function(xhr, status, error){
			alert("username was not found!")
		}
	});
}

function getQ(){
	var usrname = document.getElementById("username").value
	$.ajax({
		type: "GET",
		url: "/user/" + usrname + "/questions",
		success: function(data){
			write_q(data)
		}
	})
}

function getA(){
	var usrname = document.getElementById("username").value
	$.ajax({
		type: "GET",
		url: "/user/" + usrname + "/answers",
		success: function(data){
			write_a(data)
		}
	})
}

function write_userdata(data){
	var node = document.createElement("P")
	var node2 = document.createElement("P")
	var textnode = document.createTextNode("Email: " + data.user.email)
	var repnode = document.createTextNode("Reputation: " + data.user.reputation)
	node.append(textnode)
	node2.append(repnode)
	document.getElementById("userdata").appendChild(node)
	document.getElementById("userdata").appendChild(node2)
}

function write_q(data){
	var q_array = data.questions
	var node = document.createElement("P")
	var q_node = document.createTextNode("Question IDs by this User: " + q_array)
	node.append(q_node)
	document.getElementById("questions").appendChild(node)
}

function write_a(data){
	var a_array = data.answers
	var node = document.createElement("P")
	var textnode = document.createTextNode("Answer IDs by this User: " + a_array)
	node.append(textnode)
	document.getElementById("answers").appendChild(node)
}