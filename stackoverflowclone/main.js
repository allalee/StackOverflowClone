//Basic express server config
const express = require('express')
const app = express()
const port = 3000

//npm packages and module imports
const mailer_js = require('./mailer.js')
const bodyParser = require('body-parser')
const mongo_client = require('mongodb').MongoClient
const session = require('express-session')
const request_ip = require('request-ip')
const path = require('path')

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
app.use(request_ip.mw())
//Tell the application to use ejs for html styling
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '/templates'))

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
					stackoverflowclone_db.collection("user_accounts").insert({"username": username, "email": email, "password": password, "reputation": 1, "verified": "no", "key": validation_key}, function(err, result){
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
	if(req.session.username == null){
		res.json({"status": "error", "error": "User is not logged in!"})
		return
	}
	var request_body = req.body
	var title = request_body.title
	var body = request_body.body
	var tags = request_body.tags
	if(title == null){
		res.json({"status": "error", "id": "", "error": "Title is undefined"})
		return
	}
	if(body == null){
		res.json({"status": "error", "id": "", "error": "Body is undefined"})
		return
	}
	if(tags == null){
		res.json({"status": "error", "id": "", "error": "Tags is undefined"})
		return
	}
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").count(function(err, count){
		q_count = count + 1  //Temporary ID for questions at the moment
		q_count = q_count.toString()
		question_dictionary = {}
		question_dictionary["id"] = q_count
		question_dictionary["user"] = {"username": req.session.username, "reputation": 1} //HARD CODED VALUE
		question_dictionary["title"] = title
		question_dictionary["body"] = body
		question_dictionary["score"] = 0
		question_dictionary["view_count"] = 0
		question_dictionary["answer"] = 0
		question_dictionary["timestamp"] = Math.floor(Date.now()/1000)
		question_dictionary["media"] = []
		question_dictionary["tags"] = tags
		question_dictionary["accepted_answer"] = null
		stackoverflowclone_db.collection("questions").insert(question_dictionary)
		stackoverflowclone_db.collection("view_tracker").insert({"id": q_count, "usernames": [], "ips": []})
		res.json({"status": "OK", "id": q_count, "error": ""})
		return
	})
})

app.get('/questions/:id', function(req, res){
	console.log(req.method)
	console.log(req.url)
	console.log(req.body)
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
		found_question = result
		if(result == null){
			res.json({"status": "error", "question": "", "error": "Question not found"})
			return
		} else {
			stackoverflowclone_db.collection("view_tracker").findOne({"id": req.params.id}, function(err, result){
				found_view_tracker = result
				if(req.session.username != null){ //If the user is logged in then we check by username
					console.log("Tracking by usernames...")
					console.log(req.session.username)
					view_tracker_user_list = found_view_tracker["usernames"]
					if (!view_tracker_user_list.includes(req.session.username)){
						stackoverflowclone_db.collection("view_tracker").updateOne({"id": req.params.id}, {"$push": {"usernames": req.session.username}}, function(err, result){
							stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"view_count": found_question["view_count"] + 1}}, function(err, result){
								stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
									res.json({"status": "OK", "question": result, "error": ""})
									console.log("Found new username")
									return
								})
							})
						})
					} else {
						stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
							res.json({"status": "OK", "question": result, "error": ""})
							return
						})
					}
				} else { //If the user is not logged in then we check by ip
					console.log("Tracking by IPs")
					console.log(req.clientIp)
					view_tracker_user_list = found_view_tracker["ips"]
					viewer_ip = req.clientIp
					if(!view_tracker_user_list.includes(viewer_ip)){
						console.log("Ip not found")
						stackoverflowclone_db.collection("view_tracker").updateOne({"id": req.params.id}, {"$push": {"ips": viewer_ip}}, function(err, result){
							stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"view_count": found_question["view_count"] + 1}}, function(err, result){
								stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
									res.json({"status": "OK", "question": result, "error": ""})
									return
								})
							})
						})

					} else {
						console.log("IP was found")
						stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
							res.json({"status": "OK", "question": result, "error": ""})
							return
						})
					}
				}
			})
		}
	})
})

app.delete('/questions/:id', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, function(err, result){
		if(result == null){
			res.status(400)
			res.send("Question does not exist")
			return
		}
		if(result["user"]["username"] != req.session.username){
			res.status(403)
			res.send("Forbidden delete of question not owned by user")
			return
		}
		stackoverflowclone_db.collection("questions").deleteOne({"id": req.params.id}, function(err, result){
			if(err){
				console.log(err)
				return
			} else {
				res.status(200)
				res.send("OK")
				return
			}
		})
	})
})

app.get('/questions/:id/answers/add', function(req, res){
	res.sendFile("/templates/add_question_answer.html", {root: __dirname})
})

app.post('/questions/:id/answers/add', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(req.session.username == null){
		res.json({"status": "error", "id": "", "error": "User is not logged in!"})
		return
	}
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, function(err, result){
		var request_body = req.body
		if(result == null){
			res.json({"status": "error", "id": "", "error": "Question does not exist!"})
			return
		}
		if(request_body.body == null){
			res.json({"status": "error", "id": "", "error": "Body is undefined!"})
			return
		}
		answer= {}
		answer["q_id"] = req.params.id
		stackoverflowclone_db.collection("question_answers").count(function(err, count){
			answer["id"] = count + 1
			answer["user"] = req.session.username
			answer["body"] = request_body.body
			answer["score"] = 0
			answer["is_accepted"] = false
			answer["timestamp"] = Math.floor(Date.now()/1000)
			stackoverflowclone_db.collection("question_answers").insert(answer)
			res.json({"status": "OK", "id": answer["id"].toString(), "error": ""})
			return
		})
	})
})

app.get('/questions/:id/answers', function(req,res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, function(err, result){
		if(result == null){
			res.json({"status": "error", "answers": "", "error": "Question not found!"})
			return
		}
		stackoverflowclone_db.collection("question_answers").find({"q_id": req.params.id}, {projection: {_id: 0}}).toArray(function(err, result){
			res.json({"status": "OK", "answers": result, "error": ""})
			return
		})
	})
})

app.get('/search', function(req, res){
	res.sendFile("/templates/search_question.html", {root: __dirname})
})

app.post('/search', function(req, res){
	var current_timestamp
	var question_limit
	var timestamp = req.body.timestamp
	var limit = req.body.limit
	if(timestamp == null || timestamp == ""){
		current_timestamp = Math.floor(Date.now()/1000)
	} else if(timestamp < 0){
		res.json({"status": "error", "questions": "", "error": "Timestamp is an invalid integer!"})
		return
	} else {
		current_timestamp = timestamp
	}
	if(limit == null || limit == ""){
		question_limit = 25
	} else if (limit < 0 || limit > 100){
		res.json({"status": "error", "questions": "", "error": "Limit must be between 0 and 100"})
		return
	} else {
		question_limit = parseInt(limit,10)
	}
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(req.body.q == null || req.body.q.trim() == ""){ //If the search query is not here then we can do this
		stackoverflowclone_db.collection("questions").find({"timestamp": {'$lte': current_timestamp}}).sort({"timestamp": -1}).limit(question_limit).toArray(function(err, result){
			res.json({"status": "OK", "questions": result, "error": ""})
			return
		})
	} else { //If the search query exists then we do this
		stackoverflowclone_db.collection("questions").find({"$text":{"$search": req.body.q}, "timestamp": {'$lte': current_timestamp}}).sort({"timestamp": -1}).limit(question_limit).toArray(function(err, result){
			console.log("Search has been done with a query")
			res.json({"status": "OK", "questions": result, "error": ""})
			return
		})
	}
})

app.get('/user/:username', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("user_accounts").findOne({"username": req.params.username}, function(err, result){
		if(result == null){
			res.json({"status": "error", "user": ""})
			return
		} else {
			// var user = [{user : req.params.username, email : result["email"], reputation : result["reputation"]}]
			// res.render("get_user")
			res.json({"status": "OK", "user": {"email": result["email"], "reputation": result["reputation"]}})
			return
		}
	})
})

app.get('/user/:username/questions', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("user_accounts").findOne({"username": req.params.username}, function(err, result){
		if(result == null){
			res.json({"status": "error", "questions": ""})
			return
		} else {
			stackoverflowclone_db.collection("questions").find({"user.username": req.params.username}, {projection: {_id: 0, id: 1}}).toArray(function(err, result){
				if(result == null){
					res.json({"status": "OK", "questions": []})
					return
				} else {
					var question_id_array = []
					result.forEach(function(item){
						question_id_array.push(item['id'])
					})
					res.json({"status": "OK", "questions": question_id_array})
					return
				}
			})
		}
	})
})

app.get('/user/:username/answers', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("user_accounts").findOne({"username": req.params.username}, function(err, result){
		if(result == null){
			res.json({"status": "error", "answers": ""})
			return
		} else {
			stackoverflowclone_db.collection("question_answers").find({"user": req.params.username}, {projection: {_id: 0, id: 1}}).toArray(function(err, result){
				if(result == null){
					res.json({"status": "OK", "answers": []})
					return
				} else {
					var answer_id_array = []
					result.forEach(function(item){
						answer_id_array.push(item['id'].toString())
					})
					res.json({"status": "OK", "answers": answer_id_array})
					return
				}
			})
		}
	})
})

app.listen(port, function() {
	console.log("It works!")
})
