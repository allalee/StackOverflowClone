function login(){
	var usrname = document.getElementById("username").value
	var passwd = document.getElementById("password").value
	$.ajax({
		type: "POST",
		url: "/login",
		data: JSON.stringify({username: usrname, password: passwd}),
		contentType: "application/json; charset=utf-8",
		success: function(data){
			redirect_login(data)
		},
		dataType: "json"
	});
}

function redirect_login(data){
	if(data.status == "error"){
		alert(data.error)
	} else{
		window.location.href = "/login"
	}
}

function logout(){
	$.ajax({
		type: "POST",
		url: "/logout",
		success: function(data){
			redirect_login(data)
		}
	})
}