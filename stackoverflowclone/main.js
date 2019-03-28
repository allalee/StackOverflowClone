const express = require('express')
const app = express()
const port = 3000
const mailer_js = require('./mailer.js')
const bodyParser = require('body-parser')
const mongo_client = require('mongodb').MongoClient

//Specify this so that you can retrieve the post data in the request
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());
//Specify the place where Express will look for static files to serve(CSS and JS)
app.use(express.static(__dirname + "/static"))

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
})

app.listen(port, function() {
	console.log("It works!")
})