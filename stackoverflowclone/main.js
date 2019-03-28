//Basic express server config
const express = require('express')
const app = express()
const port = 3000

//npm packages and module imports
const mailer_js = require('./mailer.js')
const bodyParser = require('body-parser')
const mongo_client = require('mongodb').MongoClient
const session = require('express-session')

//Specify this so that you can retrieve the post data in the request
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());
//Specify the place where Express will look for static files to serve(CSS and JS)
app.use(express.static(__dirname + "/static"))
//Create a session for the app to use
app.use(session({
	secret: 'main_secret',
	saveUninitialized: false,
	resave: false,
	cookie: {maxAge: 365*24*60*60*1000}
}))

var soc_db
var url = "mongodb://localhost:27017/" //Specify the url of the db that we are connecting to
mongo_client.connect(url, function(err, db){
	if(err) throw err
	console.log("Connected to MongoDB")
	soc_db = db
})

app.get('/', function(req, res) {
	res.send("Hello World")
})

app.get('/adduser', function(req, res){
	res.sendFile("/templates/adduser.html", {root: __dirname})
})

app.post('/adduser', function(req, res){
	var request_body = req.body
	var username = request_body.username
	var password = request_body.password
	var email = request_body.email
	var stackoverflowclone_db = soc_db.db("StackOverflowClone")

	stackoverflowclone_db.collection("user_accounts").findOne({"username": username}, function(err, result){
		if(result != null){ //If there is already an entry in the db with that username
			res.json({"status": "error", "error": "Username already exists!"})
			return
		} else {
			stackoverflowclone_db.collection("user_accounts").findOne({"email": email}, function(err, result){
				if(result != null){
					res.json({"status": "error", "error": "Email already exists!"})
					return
				} else {
					var validation_key = mailer_js.makeid(6)
					mailer_js.mail(email, validation_key)
					stackoverflowclone_db.collection("user_accounts").insert({"username": username, "email": email, "password": password, "verified": "no", "key": validation_key}, function(err, result){
						console.log("Account created...")
						res.json({"status": "OK", "error": ""})
					});
				}
			});
		}
	});
})

app.get('/verify', function(req, res){
	res.sendFile("/templates/verify.html", {root: __dirname})
})

app.post('/verify', function(req, res){
	var request_body = req.body
	var email = request_body.email
	var key = request_body.key
	var stackoverflowclone_db = soc_db.db("StackOverflowClone")

	stackoverflowclone_db.collection("user_accounts").findOne({"email": email}, function(err, result){
		if(result == null){
			res.json({"status": "error", "error": "Email not found!"})
			return
		} else if(key == result["key"] || key == "abracadabra") {
			stackoverflowclone_db.collection("user_accounts").update({"email": email}, {"$set": {"verified": "yes"}})
			res.json({"status": "OK", "error": ""})
			return
		} else {
			res.json({"status": "error", "error": "Invalid key for user!"})
			return
		}
	})
})

app.get('/login', function(req, res){
	if(req.session.username == null){
		res.sendFile("/templates/login.html", {root: __dirname})
	} else {
		res.sendFile("/templates/logged_in.html", {root: __dirname})
	}
})

app.post('/login', function(req, res){
	var request_body = req.body
	var username = request_body.username
	var password = request_body.password
	var stackoverflowclone_db = soc_db.db("StackOverflowClone")

	stackoverflowclone_db.collection("user_accounts").findOne({"username": username}, function(err, result){
		if(result == null){
			res.json({"status": "error", "error": "Username not found!"})
			return
		} else if(result["verified"] != "yes"){
			res.json({"status": "error", "error": "User is not verified!"})
			return
		} else if (result["password"] != password){
			res.json({"status": "error", "error": "Invalid password for user!"})
			return
		}
		req.session.username = username
		res.json({"status": "OK", "error": ""})
		return
	})
})

app.post('/logout', function(req, res){
	if(req.session.username == null){
		res.json({"status": "error", "error": "User is not logged in!"})
	} else {
		req.session.destroy()
		res.json({"status": "OK", "error": ""})
	}
})

app.get('/questions/add', function(err, res){
	res.sendFile("/templates/add_question.html", {root: __dirname})
})

app.post('/questions/add', function(req, res){
	var request_body = req.body
	var title = request_body.title
	var body = request_body.body
	var tags = request_body.tags
	if(title == null){
		
	}
})

app.listen(port, function() {
	console.log("It works!")
})