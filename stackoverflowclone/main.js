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
const cassandra_db = require('cassandra-driver') //npm install --save cassandra-driver: Install Cassandra DB for blob storage
const multer = require('multer') //npm install --save multer: Install multer to handle multipart/form-data which is for uploading files
const uuidv4 = require('uuid/v4') //npm install --save uuid: Install uuid in order to generate random ids
const redis = require('redis') //npm install --save redis: Install redis for caching and session saving
const redisStore = require('connect-redis')(session)
const nodemailer = require("nodemailer")

//Create a nodemailer object
let transporter = nodemailer.createTransport({
	service: 'gmail-send',
	auth: {
		user: 'artemisiacse356@gmail.com',
		pass: 'cse356verify'
	}
});
//Specify this so that you can retrieve the post data in the request
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json());
//Specify the place where Express will look for static files to serve(CSS and JS)
app.use(express.static(__dirname + "/static"))
//Initiate the redis caching client
var redis_client = redis.createClient({
	port: 6379,
	host: '64.52.162.255',
	password: "pJoWYJXxK2xJWptedPkx+q7cRdxpGyKRQld6W0+CUzjyBJKT2xrFeFoVC/xOnNQUz7dritTBe6ph34sw"
})
//Create a session for the app to use
app.use(session({
	secret: 'main_secret',
	saveUninitialized: false,
	resave: false,
	cookie: {maxAge: 365*24*60*60*1000},
	store: new redisStore({host: "64.52.162.255", port: 6379, client: redis_client})
}))
app.use(request_ip.mw())
//Tell the application to use ejs for html styling
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '/templates'))
//Initiate the multer variable for use later
var upload = multer()
//Initiate cassandraDB with options in order to use it
var options = {contactPoints: ['64.190.90.111:9042'], keyspace: 'hw5', localDataCenter: 'datacenter1'}
var cassandra_cluster = new cassandra_db.Client(options)
redis_client.get("test", function(err, val){
	console.log(val)
})

var soc_db
var url = "mongodb://cse356admin:cse356mongodb@64.190.91.15:27017/admin" //Specify the url of the db that we are connecting to
//"mongodb://localhost:27017/"
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
					mailer_js.mail(email, validation_key, transporter)
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
			res.status(400)
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
			res.status(400).send({"status": "error", "error": "Username not found!"})
			return
		} else if(result["verified"] != "yes"){
			res.status(400)
			res.json({"status": "error", "error": "User is not verified!"})
			return
		} else if (result["password"] != password){
			res.status(400)
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
		res.status(400).send({"status": "error", "error": "User is not logged in!"})
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
		res.status(400).send({"status": "error", "error": "User is not logged in!"})
		return
	}
	var request_body = req.body
	var title = request_body.title
	var body = request_body.body
	var tags = request_body.tags
	var media
	if(title == null){
		res.status(400).send({"status": "error", "id": "", "error": "Title is undefined"})
		return
	}
	if(body == null){
		res.status(400).send({"status": "error", "id": "", "error": "Body is undefined"})
		return
	}
	if(tags == null){
		res.status(400).send({"status": "error", "id": "", "error": "Tags is undefined"})
		return
	}
	if(req.body.media == null){ //Media is an optional tag and can be null
		media = []
	} else {
		media = req.body.media
	}
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	question_dictionary = {}
	var question_id = uuidv4()
	question_dictionary["id"] = question_id
	question_dictionary["username"] = req.session.username
	question_dictionary["title"] = title
	question_dictionary["body"] = body
	question_dictionary["score"] = 0
	question_dictionary["view_count"] = 0
	question_dictionary["answer"] = 0
	question_dictionary["timestamp"] = Math.floor(Date.now()/1000)
	question_dictionary["media"] = media
	question_dictionary["tags"] = tags
	question_dictionary["accepted_answer"] = null
	stackoverflowclone_db.collection("questions").insert(question_dictionary)
	stackoverflowclone_db.collection("view_tracker").insert({"id": question_id, "usernames": [], "ips": []})
	res.json({"status": "OK", "id": question_id, "error": ""})
	return
})

app.get('/questions/:id', function(req, res){
	console.log(req.method)
	console.log(req.url)
	console.log(req.body)
	var user
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, async function(err, result){
		function retrieve_user(username){
			return stackoverflowclone_db.collection("user_accounts").findOne({"username": username})
		}
		user = await Promise.all([retrieve_user(result["username"])])
		found_question = result
		if(result == null){
			res.status(400).send({"status": "error", "question": "", "error": "Question not found"})
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
									result["user"] = {"username": user[0]["username"], "reputation": user[0]["reputation"]}
									res.json({"status": "OK", "question": result, "error": ""})
									console.log("Found new username")
									return
								})
							})
						})
					} else {
						stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
							result["user"] = {"username": user[0]["username"], "reputation": user[0]["reputation"]}
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
									result["user"] = {"username": user[0]["username"], "reputation": user[0]["reputation"]}
									res.json({"status": "OK", "question": result, "error": ""})
									return
								})
							})
						})

					} else {
						console.log("IP was found")
						stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, {projection: {_id: 0}}, function(err, result){
							result["user"] = {"username": user[0]["username"], "reputation": user[0]["reputation"]}
							console.log(result)
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
		if(result["username"] != req.session.username){
			res.status(403)
			res.send("Forbidden delete of question not owned by user")
			return
		}

		var query = "DELETE FROM media WHERE id IN ?;"
		var params = result["media"]
		if(params != []){ //skip this if there isn't any media
			cassandra_cluster.execute(query, params)
		}
		stackoverflowclone_db.collection("questions").deleteMany({"q_id": req.params.id})
		stackoverflowclone_db.collection("questions").deleteOne({"id": req.params.id})
		res.status(200)
		res.send("OK")
		// stackoverflowclone_db.collection("questions").deleteOne({"id": req.params.id}, function(err, result){
		// 	if(err){
		// 		console.log(err)
		// 		return
		// 	} else {
		// 		res.status(200)
		// 		res.send("OK")
		// 		return
		// 	}
		// })
	})
})

app.get('/questions/:id/answers/add', function(req, res){
	res.sendFile("/templates/add_question_answer.html", {root: __dirname})
})

app.post('/questions/:id/answers/add', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(req.session.username == null){
		res.status(400).send({"status": "error", "id": "", "error": "User is not logged in!"})
		return
	}
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, function(err, result){
		var request_body = req.body
		var media
		if(result == null){
			res.status(400).send({"status": "error", "id": "", "error": "Question does not exist!"})
			return
		}
		if(request_body.body == null){
			res.status(400).send({"status": "error", "id": "", "error": "Body is undefined!"})
			return
		}
		if(request_body.media == null){ //Media is an optional value which defaults to []
			media = []
		} else {
			media = request_body.media
		}
		answer= {}
		answer["q_id"] = req.params.id
		answer["id"] = uuidv4()
		answer["user"] = req.session.username
		answer["body"] = request_body.body
		answer["score"] = 0
		answer["is_accepted"] = false
		answer["timestamp"] = Math.floor(Date.now()/1000)
		answer["media"] = media
		stackoverflowclone_db.collection("question_answers").insert(answer)
		res.json({"status": "OK", "id": answer["id"], "error": ""})
		return
	})
})

app.get('/questions/:id/answers', function(req,res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, function(err, result){
		if(result == null){
			res.status(400).send({"status": "error", "answers": "", "error": "Question not found!"})
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
	var current_timestamp, question_limit, query, sort_by, tags, has_media, accepted
	var timestamp = req.body.timestamp
	var limit = req.body.limit
	//==================================================================
	//PARSE THE OPTIONS [timestamp, limit, q, sort_by, tags, has_media, accepted]
	if(timestamp == null || timestamp == ""){
		current_timestamp = Math.floor(Date.now()/1000)
	} else if(timestamp < 0){
		res.status(400).send({"status": "error", "questions": "", "error": "Timestamp is an invalid integer!"})
		return
	} else {
		current_timestamp = timestamp
	}
	if(limit == null || limit == ""){
		question_limit = 25
	} else if (limit < 0 || limit > 100){
		res.status(400).send({"status": "error", "questions": "", "error": "Limit must be between 0 and 100"})
		return
	} else {
		question_limit = parseInt(limit,10)
	}
	if(req.body.q == null || req.body.q.trim() == ""){
		query = null
	} else {
		query = req.body.q
	}
	if(req.body.sort_by == null){
		sort_by = "score"
	} else {
		sort_by = req.body.sort_by
	}
	if(req.body.tags == null){
		tags = null	
	} else {
		tags = req.body.tags
	}
	if(req.body.has_media == null){
		has_media = false
	} else {
		has_media = req.body.has_media
	}
	if(req.body.accepted == null){
		accepted = false
	} else {
		accepted = req.body.accepted
	}
	//timestamp, limit, sort_by, has_media, and accepted have default values
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(query == null && tags == null){
		if(has_media){
			stackoverflowclone_db.collection("questions").find({"timestamp": {'$lte': current_timestamp}, "accepted": accepted, "media": {'$ne': []}}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		} else {
			stackoverflowclone_db.collection("questions").find({"timestamp": {'$lte': current_timestamp}, "accepted": accepted}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		}
	} else if (query == null && tags != null){
		if(has_media){
			stackoverflowclone_db.collection("questions").find({"timestamp": {'$lte': current_timestamp}, "accepted": accepted, "media": {'$ne': []}, "tags": {"$all": tags}}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		} else {
			stackoverflowclone_db.collection("questions").find({"timestamp": {'$lte': current_timestamp}, "accepted": accepted, "tags": {"$all": tags}}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		}

	} else if (query != null && tags == null){
		if(has_media){
			stackoverflowclone_db.collection("questions").find({"$text": {"$search": query}, "timestamp": {'$lte': current_timestamp}, "accepted": accepted, "media": {'$ne': []}}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		} else {
			stackoverflowclone_db.collection("questions").find({"$text": {"$search": query}, "timestamp": {'$lte': current_timestamp}, "accepted": accepted}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		}
	} else {
		if(has_media){
			stackoverflowclone_db.collection("questions").find({"$text": {"$search": query}, "timestamp": {'$lte': current_timestamp}, "accepted": accepted, "media": {'$ne': []}, "tags": {"$all": tags}}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		} else {
			stackoverflowclone_db.collection("questions").find({"$text": {"$search": query}, "timestamp": {'$lte': current_timestamp}, "accepted": accepted, "tags": {"$all": tags}}).sort({sort_by: -1}).limit(question_limit).toArray(function(err, result){
				res.json({"status": "OK", "questions": result, "error": ""})
				return
			})
		}
	}

	// //===================================================================
	// stackoverflowclone_db = soc_db.db("StackOverflowClone")
	// if(req.body.q == null || req.body.q.trim() == ""){ //If the search query is not here then we can do this
	// 	stackoverflowclone_db.collection("questions").find({"timestamp": {'$lte': current_timestamp}}).sort({"timestamp": -1}).limit(question_limit).toArray(function(err, result){
	// 		res.json({"status": "OK", "questions": result, "error": ""})
	// 		return
	// 	})
	// } else { //If the search query exists then we do this
	// 	stackoverflowclone_db.collection("questions").find({"$text":{"$search": req.body.q}, "timestamp": {'$lte': current_timestamp}}).sort({"timestamp": -1}).limit(question_limit).toArray(function(err, result){
	// 		console.log("Search has been done with a query")
	// 		res.json({"status": "OK", "questions": result, "error": ""})
	// 		return
	// 	})
	// }
})

app.get('/user/:username', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("user_accounts").findOne({"username": req.params.username}, function(err, result){
		if(result == null){
			res.status(400).send({"status": "error", "user": ""})
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
			res.status(400).send({"status": "error", "questions": ""})
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
			res.status(400).send({"status": "error", "answers": ""})
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
//var [post, vote] = await Promise.all([ qa.retrieve(), upvote.retrieve() ])
app.post('/questions/:id/upvote', async function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	var upvote_option
	function retrieve_question(){
		return stackoverflowclone_db.collection("questions").findOne({"id": req.params.id})
	}
	function retrieve_votes(){
		return stackoverflowclone_db.collection("votes").findOne({"username": req.session.username, "post_id": req.params.id, "post_type": "question"})
	}
	function retrieve_user(username){
		return stackoverflowclone_db.collection("user_accounts").findOne({"username": username})
	}
	var [question, vote] = await Promise.all([retrieve_question(), retrieve_votes()])
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(question == null){
		res.status(400).send({"status": "error", "error": "Question does not exist!"})
		return
	}
	if(req.body.upvote == null)
		upvote_option = true
	else
		upvote_option = req.body.upvote
	console.log(question)
	console.log(question["username"])
	var user = await Promise.all([retrieve_user(question["username"])])
	user = user[0]
	console.log(user) //User of the asker
	if(vote == null){ //If a vote document doesn't exist in the database
		if(upvote_option){ //Add one reputation to the user
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 1}})
			stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] + 1}})
			stackoverflowclone_db.collection("votes").insert({"id": uuidv4(), "post_type": "question", "username": req.session.username, "post_id": question["id"], "status": "upvote"})
			res.json({"status": "OK", "error": ""})
			return
		} else {
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] - 1}})
			if(user["reputation"] <= 1){ //When user reputation is <= 1, we cannot go lower
				stackoverflowclone_db.collection("votes").insert({"id": uuidv4(), "post_type": "question", "username": req.session.username, "post_id": question["id"], "status": "downvote_ignored"})
				res.json({"status": "OK", "error": ""})
				return
			} else { //Subtract one reputation from the user
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] - 1}})
				stackoverflowclone_db.collection("votes").insert({"id": uuidv4(), "post_type": "question", "username": req.session.username, "post_id": question["id"], "status": "downvote"})
				res.json({"status": "OK", "error": ""})
				return
			}
		}
	} else { //If a vote document already exists then we check it first before making changes
		if(upvote_option){
			if(vote["status"] == "none"){  //+1 rep
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 1}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "upvote"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote") {//+2 rep
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 2}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] + 2}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "upvote"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote_ignored"){//+1 rep 
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 2}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "upvote"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "upvote") {//-1 
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] - 1}})
				if(user["reputation"] <= 1){
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "none"}})
					res.json({"status": "OK", "error": ""})
					return
				} else {
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] - 1}})
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "none"}})
					res.json({"status": "OK", "error": ""})
					return
				}
			}
		} else {
			if(vote["status"] == "none") {//-1
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] - 1}})
				if(user["reputation"] <= 1){
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "downvote_ignored"}})
					res.json({"status": "OK", "error": ""})
					return
				} else {
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] - 1}})
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "downvote"}})
					res.json({"status": "OK", "error": ""})
					return
				}

			}
			if(vote["status"] == "downvote") {//+1
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "none"}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] + 1}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote_ignored"){//0
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "none"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "upvote") {//-2
				stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] - 2}})
				if(user["reputation"] == 2){ //If it is exactly 2, we have to ignore the downvote, but still subtract 1
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "downvote_ignored"}})
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] - 1}})
					res.json({"status": "OK", "error": ""})
					return
				} else if(user["reputation"] <= 1){ //Only update the vote document
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "downvote_ignored"}})
					res.json({"status": "OK", "error": ""})
					return
				} else{
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "question", "post_id": question["id"]}, {"$set": {"status": "downvote"}})
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] - 2}})
					res.json({"status": "OK", "error": ""})
					return
				}
			}
		}
	}
})

app.post('/answers/:id/upvote', async function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	var upvote_option
	function retrieve_answer(){
		return stackoverflowclone_db.collection("question_answers").findOne({"id": req.params.id})
	}
	function retrieve_votes(){
		return stackoverflowclone_db.collection("votes").findOne({"username": req.session.username, "post_id": req.params.id, "post_type": "answer"})
	}
	function retrieve_user(username){
		return stackoverflowclone_db.collection("user_accounts").findOne({"username": username})
	}
	var [answer, vote] = await Promise.all([retrieve_answer(), retrieve_votes()])
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(answer == null){
		res.status(400).send({"status": "error", "error": "Answer does not exist!"})
		return
	}
	if(req.body.upvote == null)
		upvote_option = true
	else
		upvote_option = req.body.upvote
	console.log(answer)
	var user = await Promise.all([retrieve_user(answer["user"])])
	user = user[0]
	console.log(user) //User of the asker
	if(vote == null){ //If a vote document doesn't exist in the database
		if(upvote_option){ //Add one reputation to the user
			stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] + 1}})
			stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] + 1}})
			stackoverflowclone_db.collection("votes").insert({"id": uuidv4(), "post_type": "answer", "username": req.session.username, "post_id": answer["id"], "status": "upvote"})
			res.json({"status": "OK", "error": ""})
			return
		} else {
			stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] - 1}})
			if(user["reputation"] <= 1){ //When user reputation is <= 1, we cannot go lower
				stackoverflowclone_db.collection("votes").insert({"id": uuidv4(), "post_type": "answer", "username": req.session.username, "post_id": answer["id"], "status": "downvote_ignored"})
				res.json({"status": "OK", "error": ""})
				return
			} else { //Subtract one reputation from the user
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] - 1}})
				stackoverflowclone_db.collection("votes").insert({"id": uuidv4(), "post_type": "answer", "username": req.session.username, "post_id": answer["id"], "status": "downvote"})
				res.json({"status": "OK", "error": ""})
				return
			}
		}
	} else { //If a vote document already exists then we check it first before making changes
		if(upvote_option){
			if(vote["status"] == "none"){  //+1 rep
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] + 1}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "upvote"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote") {//+2 rep
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] + 2}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] + 2}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "upvote"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote_ignored"){//+1 rep 
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] + 2}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "upvote"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "upvote") {//-1 
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] - 1}})
				if(user["reputation"] <= 1){
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "none"}})
					res.json({"status": "OK", "error": ""})
					return
				} else {
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] - 1}})
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "none"}})
					res.json({"status": "OK", "error": ""})
					return
				}
			}
		} else {
			if(vote["status"] == "none") {//-1
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] - 1}})
				if(user["reputation"] <= 1){
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "downvote_ignored"}})
					res.json({"status": "OK", "error": ""})
					return
				} else {
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] - 1}})
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "downvote"}})
					res.json({"status": "OK", "error": ""})
					return
				}

			}
			if(vote["status"] == "downvote") {//+1
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "none"}})
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] + 1}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote_ignored"){//0
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] + 1}})
				stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "none"}})
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "upvote") {//-2
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id}, {"$set": {"score": answer["score"] - 2}})
				if(user["reputation"] == 2){ //If it is exactly 2, we have to ignore the downvote, but still subtract 1
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "downvote_ignored"}})
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] - 1}})
					res.json({"status": "OK", "error": ""})
					return
				} else if(user["reputation"] <= 1){ //Only update the vote document
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "downvote_ignored"}})
					res.json({"status": "OK", "error": ""})
					return
				} else{
					stackoverflowclone_db.collection("votes").updateOne({"username": req.session.username, "post_type": "answer", "post_id": answer["id"]}, {"$set": {"status": "downvote"}})
					stackoverflowclone_db.collection("user_accounts").updateOne({"username": answer["user"]}, {"$set": {"reputation": user["reputation"] - 2}})
					res.json({"status": "OK", "error": ""})
					return
				}
			}
		}
	}
})

app.post('/answers/:id/accept', function(req, res){
	console.log(req.params.id)
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("question_answers").findOne({"id": req.params.id}, function(err, a_result){
		if(err) throw err;
		if(a_result == null){
			res.status(400).send({"status": "error", "error": "Answer was not found in database"})
			return
		}
		stackoverflowclone_db.collection("questions").findOne({"id": a_result["q_id"]}, function(err, q_result){
			if(err) throw err;
			if(req.session.username != q_result["username"]){
				res.status(400).send({"status": "error", "error": "User trying to accept answer is not the asker of the question!"})
				return
			} else {
				stackoverflowclone_db.collection("questions").updateOne({"id": a_result["q_id"]},  {"$set": {"accepted_answer_id": a_result["id"]}})
				stackoverflowclone_db.collection("question_answers").updateOne({"id": req.params.id},  {"$set": {"is_accepted": true}})
				res.json({"status": "OK", "error": ""})
				return
			}
		})
	})
})

app.post('/addmedia', upload.single('content'), function(req, res){
	if(req.session.username == null){
		res.status(400).send({"status": "error", "id": "", "error": "User is not logged in!"})
		return
	}
	var uploaded_content = req.file.buffer
	var file_ext = req.file.originalname.split(".")[1] //Retrieve the file extension
	var file_id = uuidv4()
	var query = `INSERT INTO media (file_id, ext, content) VALUES (?, ?, ?);`
	var params = [file_id, file_ext, uploaded_content]
	cassandra_cluster.execute(query, params, function(err, result){
		if(err){
			console.log(err)
			return
		}
		res.json({"status": "OK", "id": file_id, "error": ""})
	})
})

app.get('/media/:id', function(req, res){
	var file_id = req.params.id
	console.log(file_id)
	var query = `SELECT ext, content FROM media WHERE file_id=?;`
	var params = [file_id]
	cassandra_cluster.execute(query, params, function(err, result){
		if(err){
			console.log(err)
		}
		console.log(result.rows[0].ext)
		console.log(result.rows[0].content)
		header = result.rows[0].ext
		if(header == "jpg"){
			res.header("Content-Type", "image/jpeg")
		}
		if(header == "gif"){
			res.header("Content-Type", "image/gif")
		}
		if(header == "png"){
			res.header("Content-Type", "image/png")
		}
		res.send(result.rows[0].content)
	})
})

app.listen(port, function() {
	console.log("It works!")
})
