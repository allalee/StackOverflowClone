function submit(){
	var usrname = document.getElementById("username").value
	var passwd = document.getElementById("password").value
	var e_mail = document.getElementById("email").value
	$.ajax({
		type: "POST",
		url: "/adduser",
		data: JSON.stringify({username:usrname,password: passwd,email:e_mail }),
		contentType: "application/json; charset=utf-8",
		success: redirect(),
		dataType: "json"
	});
}

function redirect(){
	window.location.href = "http://localhost:3000/";
}

// function verify(){
// 	var e_mail = document.getElementById("email").value
// 	var verify_key = document.getElementById("key").value
// 	console.log(verify_key)
// 	$.ajax({
// 		type: "POST",
// 		url: "/verify",
// 		data: JSON.stringify({email: e_mail, key: verify_key}),
// 		contentType: "application/json; charset=utf-8",
// 		success: redirect_login(),
// 		dataType: "json"
// 	})
// }

// function redirect_login(){
// 	window.location.href = "http://localhost:3891/login"
// }

// function login(){
// 	var usrname = document.getElementById("username").value
// 	var passwd = document.getElementById("password").value
// 	$.ajax({
// 		type: "POST",
// 		url: "/login",
// 		data: JSON.stringify({username: usrname, password: passwd}),
// 		contentType: "application/json; charset=utf-8",
// 		success: redirect_login(),
// 		dataType: "json"
// 	});
// }

// function redirect_login(){
// 	window.location.href = "http://localhost:3891/adduser"
// }