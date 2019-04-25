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

//Specify this so that you can retrieve the post data in the request
app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}))
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
			res.status(400)
			res.json({"status": "error", "error": "Username already exists!"})
			return
		} else {
			stackoverflowclone_db.collection("user_accounts").findOne({"email": email}, function(err, result){
				if(result != null){
					res.status(400)
					res.json({"status": "error", "error": "Email already exists!"})
					return
				} else {
					var validation_key = mailer_js.makeid(6)
					console.log("It's trying to send mail")
					mailer_js.mail(email, validation_key)
					stackoverflowclone_db.collection("user_accounts").insert({"username": username, "email": email, "password": password, "reputation": 1, "verified": "no", "key": validation_key}, function(err, result){
						if(err) throw err;
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
			res.status(400)
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
			res.status(400).json({"status": "error", "error": "Username not found!"})
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
		res.status(400).json({"status": "error", "error": "User is not logged in!"})
	} else {
		req.session.destroy()
		res.json({"status": "OK", "error": ""})
	}
})

app.get('/questions/add', function(err, res){
	res.sendFile("/templates/add_question.html", {root: __dirname})
})

app.post('/questions/add', async function(req, res){
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
		res.status(400).json({"status": "error", "id": "", "error": "Title is undefined"})
		return
	}
	if(body == null){
		res.status(400).json({"status": "error", "id": "", "error": "Body is undefined"})
		return
	}
	if(tags == null){
		res.status(400).json({"status": "error", "id": "", "error": "Tags is undefined"})
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
	question_dictionary["accepted_answer_id"] = null
	question_dictionary["answer_count"] = 0
	if(media == null || media.length == 0){
		stackoverflowclone_db.collection("questions").insertOne(question_dictionary)
		stackoverflowclone_db.collection("view_tracker").insertOne({"id": question_id, "usernames": [], "ips": []})
		res.json({"status": "OK", "id": question_id, "error": ""})
		return
	}
	//Check to make sure the media doesn't exist in another question or answer
	function track_media(input){
		return stackoverflowclone_db.collection("questions").find({"media": {'$in': input}}).toArray()
	}
	function track_media_a(input){
		return stackoverflowclone_db.collection("question_answers").find({"media": {"$in": input}}).toArray()
	}
	var result = await Promise.all([track_media(media), track_media_a(media)])
	console.log("Question length is: " + result[0].length + " ------- Answer length is: " + result[1].length)
	if(result[0].length != 0 || result[1].length != 0){
		res.status(400)
		res.json({"status": "error", "error": "Media tag(s) found in other questions/answers"})
		return
	}
	var query = 'SELECT user FROM media WHERE file_id IN ?'
	var params = [media]
	console.log(media)
	cassandra_cluster.execute(query, params, async function(err, result){
		if(err) console.log(err)
		else {
			var media_error = false
			result["rows"].forEach(function(item){
				if(item["user"] != req.session.username){
					media_error = true
					return
				}
			})
			if(media_error){
				res.status(400)
				res.json({"status": "error", "error": "Media does not belong to user!"})
				return
			} else {
				function write_q(){
					return stackoverflowclone_db.collection("questions").insertOne(question_dictionary)
				}
				function write_v(){
					return stackoverflowclone_db.collection("view_tracker").insertOne({"id": question_id, "usernames": [], "ips": []})
				}
				var m = await Promise.all([write_q(), write_v()])
				res.json({"status": "OK", "id": question_id, "error": ""})
				return
			}
		}
	})
})

app.get('/questions/:id', async function(req, res){
	// console.log(req.method)
	// console.log(req.url)
	// console.log(req.body)
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	var username = req.session.username //If it is null then user is not logged in, if not then they are logged in
	function getInitialQuestion(id){
		return stackoverflowclone_db.collection("questions").findOne({"id": id}, {projection: {_id: 0}})
	}
	function getViewTracker(id){
		return stackoverflowclone_db.collection("view_tracker").findOne({"id": id})
	}
	var promise_returns = await Promise.all([getInitialQuestion(req.params.id), getViewTracker(req.params.id)]) //promise_returns[0] is the question, [1] is the view_tracker
	var found_question = promise_returns[0]
	var view_tracker = promise_returns[1]
	if(found_question == null){
		res.status(400)
		res.json({"status": "error", "error": "Question not found!"})
		return
	}
	function getUser(username){
		return stackoverflowclone_db.collection("user_accounts").findOne({"username": username})
	}
	var user = await Promise.all([getUser(found_question["username"])]) //user[0] has the username
	if(username == null){ //Not logged in
		viewer_ip = req.clientIp
		if(!view_tracker["ips"].includes(viewer_ip)){ //If the list doesn't include the ip
			stackoverflowclone_db.collection("view_tracker").updateOne({"id": req.params.id}, {"$push": {"ips": viewer_ip}}) //Update the view tracker to have the ip
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"view_count": found_question["view_count"] + 1}})//Increment the question's view count
			res.json({"status": "OK", "question": {"id": req.params.id, 
				"user": {"username": user[0]["username"],
				"reputation": user[0]["reputation"]}, 
				"title": found_question["title"], 
				"body": found_question["body"],
				"score": found_question["score"],
				"view_count": found_question["view_count"] + 1,
				"answer_count": found_question["answer_count"],
				"timestamp": found_question["timestamp"],
				"media": found_question["media"],
				"tags": found_question["tags"],
				"accepted_answer_id": found_question["accepted_answer_id"]}})
			return
		} else {
			res.json({"status": "OK", "question": {"id": req.params.id, 
				"user": {"username": user[0]["username"],
				"reputation": user[0]["reputation"]}, 
				"title": found_question["title"], 
				"body": found_question["body"],
				"score": found_question["score"],
				"view_count": found_question["view_count"],
				"answer_count": found_question["answer_count"],
				"timestamp": found_question["timestamp"],
				"media": found_question["media"],
				"tags": found_question["tags"],
				"accepted_answer_id": found_question["accepted_answer_id"]}})
			return
		}
	} else {	//Logged in
		if(!view_tracker["usernames"].includes(username)){ //If the list doesn't include the username
			stackoverflowclone_db.collection("view_tracker").updateOne({"id": req.params.id}, {"$push": {"usernames": req.session.username}}) //Update the view tracker to have the name
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"view_count": found_question["view_count"] + 1}})//Increment the questions collection's view count
			res.json({"status": "OK", "question": {"id": req.params.id, 
				"user": {"username": user[0]["username"],
				"reputation": user[0]["reputation"]}, 
				"title": found_question["title"], 
				"body": found_question["body"],
				"score": found_question["score"],
				"view_count": found_question["view_count"] + 1,
				"answer_count": found_question["answer_count"],
				"timestamp": found_question["timestamp"],
				"media": found_question["media"],
				"tags": found_question["tags"],
				"accepted_answer_id": found_question["accepted_answer_id"]}})
			return
		} else {
			res.json({"status": "OK", "question": {"id": req.params.id, 
				"user": {"username": user[0]["username"],
				"reputation": user[0]["reputation"]}, 
				"title": found_question["title"], 
				"body": found_question["body"],
				"score": found_question["score"],
				"view_count": found_question["view_count"],
				"answer_count": found_question["answer_count"],
				"timestamp": found_question["timestamp"],
				"media": found_question["media"],
				"tags": found_question["tags"],
				"accepted_answer_id": found_question["accepted_answer_id"]}})
			return
		}
	}
})

app.delete('/questions/:id', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, async function(err, result){
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
		var query = "DELETE FROM media WHERE file_id IN ?;"
		var params = result["media"]
		function deleteManyAnswers(q_id){
			return stackoverflowclone_db.collection("question_answers").deleteMany({"q_id": req.params.id})
		}
		function deleteQuestion(id){
			return stackoverflowclone_db.collection("questions").deleteOne({"id": req.params.id})
		}
		function getAnswers(){
			return stackoverflowclone_db.collection("question_answers").findMany({"q_id": req.params.id}).toArray()
		}
		var answerArray = await Promise.all([getAnswers()]) //Answer array in [0]
		answerArray = answerArray[0]
		for(i = 0; i < answerArray; i++){
			if(answerArray[i]["media"] && answerArray[i]["media"].length > 0){
				params.concat(answerArray[i]["media"])
			}
		}
		console.log(params)
		if(params && params.length > 0){ //skip this if there isn't any media
			console.log("DELETING FROM CASS CLUSTER")
			cassandra_cluster.execute(query, [params], async function(err, result){
				var ok = await Promise.all([deleteManyAnswers(req.params.id), deleteQuestion(req.params.id)])
				res.status(200)
				res.send("OK")
				return
			})
		} else {
			var ok = await Promise.all([deleteManyAnswers(req.params.id), deleteQuestion(req.params.id)])
			res.status(200)
			res.send("OK")
			return
		}
	})
})

app.get('/questions/:id/answers/add', function(req, res){
	res.sendFile("/templates/add_question_answer.html", {root: __dirname})
})

app.post('/questions/:id/answers/add', async function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(req.session.username == null){
		res.status(400).json({"status": "error", "id": "", "error": "User is not logged in!"})
		return
	}
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, async function(err, result){
		var request_body = req.body
		var media
		if(result == null){
			res.status(400).json({"status": "error", "id": "", "error": "Question does not exist!"})
			return
		}
		if(request_body.body == null){
			res.status(400).json({"status": "error", "id": "", "error": "Body is undefined!"})
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
		if(media == null || media.length == 0){
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"answer_count": result["answer_count"] + 1}})
			stackoverflowclone_db.collection("question_answers").insertOne(answer)
			res.json({"status": "OK", "id": answer["id"], "error": ""})
			return	
		}
		function track_media(input){
			return stackoverflowclone_db.collection("questions").find({"media": {'$in': input}}).toArray()
		}
		function track_media_a(input){
			return stackoverflowclone_db.collection("question_answers").find({"media": {"$in": input}}).toArray()
		}
		var result = await Promise.all([track_media(media), track_media_a(media)])
		if(result[0].length != 0 || result[1].length != 0){
			res.status(400)
			res.json({"status": "error", "error": "Media tag(s) found in other questions/answers"})
			return
		}
		var query = 'SELECT user FROM media WHERE file_id IN ?'
		var params = [media]
		console.log(media)
		cassandra_cluster.execute(query, params, function(err, result){
			if(err) console.log(err)
			else {
				var media_error = false
				result["rows"].forEach(function(item){
					if(item["user"] != req.session.username){
						media_error = true
						return
					}
				})
				if(media_error){
					res.status(400)
					res.json({"status": "error", "error": "Media does not belong to user!"})
					return
				} else {
					stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"answer_count": result["answer_count"] + 1}})
					stackoverflowclone_db.collection("question_answers").insertOne(answer)
					res.json({"status": "OK", "id": answer["id"], "error": ""})
					return
				}
			}
		})
	})
})

app.get('/questions/:id/answers', function(req,res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("questions").findOne({"id": req.params.id}, function(err, result){
		if(result == null){
			res.status(400).json({"status": "error", "answers": "", "error": "Question not found!"})
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
	var current_timestamp, question_limit, sort_by
	var timestamp = req.body.timestamp
	var limit = req.body.limit
	//==================================================================
	//PARSE THE OPTIONS [timestamp, limit, q, sort_by, tags, has_media, accepted]
	if(timestamp == null || timestamp == ""){
		current_timestamp = Math.floor(Date.now()/1000)
	} else if(timestamp < 0){
		res.status(400).json({"status": "error", "questions": "", "error": "Timestamp is an invalid integer!"})
		return
	} else {
		current_timestamp = timestamp
	}
	if(limit == null || limit == ""){
		question_limit = 25
	} else if (limit < 0 || limit > 100){
		res.status(400).json({"status": "error", "questions": "", "error": "Limit must be between 0 and 100"})
		return
	} else {
		question_limit = parseInt(limit,10)
	}
	var question_query = {}
	question_query["timestamp"] = {'$lte': current_timestamp}
	if(req.body.q != null && req.body.q.trim() != ""){
		question_query["$text"] = {"$search": req.body.q}
	}
	if(req.body.sort_by == null){
		sort_by = "score"
	} else {
		sort_by = req.body.sort_by
	}
	if(req.body.tags != null){
		question_query["tags"] = {"$all": req.body.tags}
	}
	if(req.body.has_media != null && req.body.has_media == true){
		question_query["media"] = {"$ne": []}
	}
	if(req.body.accepted != null && req.body.accepted == true){
		question_query["accepted_answer_id"] = {"$ne": null}
	}
	//timestamp, limit, sort_by, has_media, and accepted have default values
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	if(sort_by == "timestamp"){
		stackoverflowclone_db.collection("questions").find(question_query).sort({"timestamp": -1}).limit(question_limit).toArray(function(err, result){
			if(err) console.log(err)
			res.json({"status": "OK", "questions": result, "error": ""})
			return
		})
	} else {
		stackoverflowclone_db.collection("questions").find(question_query).sort({"score": -1}).limit(question_limit).toArray(function(err, result){
			if(err) console.log(err)
			res.json({"status": "OK", "questions": result, "error": ""})
			return
		})
	}
})

app.get('/user/:username', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("user_accounts").findOne({"username": req.params.username}, function(err, result){
		if(result == null){
			res.status(400).json({"status": "error", "user": ""})
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
			res.status(400).json({"status": "error", "questions": ""})
			return
		} else {
			stackoverflowclone_db.collection("questions").find({"username": req.params.username}, {projection: {_id: 0, id: 1}}).toArray(function(err, result){
				console.log(result)
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
			res.status(400).json({"status": "error", "answers": ""})
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
		res.status(400).json({"status": "error", "error": "Question does not exist!"})
		return
	}
	if(req.body.upvote == null)
		upvote_option = true
	else
		upvote_option = req.body.upvote
	var user = await Promise.all([retrieve_user(question["username"])])
	user = user[0]
	console.log(upvote_option + " id: " + req.params.id)
	if(vote == null){ //If a vote document doesn't exist in the database
		if(upvote_option){ //Add one reputation to the user
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] + 1}})
			stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] + 1}})
			stackoverflowclone_db.collection("votes").insertOne({"id": uuidv4(), "post_type": "question", "username": req.session.username, "post_id": question["id"], "status": "upvote"})
			res.json({"status": "OK", "error": ""})
			return
		} else {
			stackoverflowclone_db.collection("questions").updateOne({"id": req.params.id}, {"$set": {"score": question["score"] - 1}})
			if(user["reputation"] <= 1){ //When user reputation is <= 1, we cannot go lower
				stackoverflowclone_db.collection("votes").insertOne({"id": uuidv4(), "post_type": "question", "username": req.session.username, "post_id": question["id"], "status": "downvote_ignored"})
				res.json({"status": "OK", "error": ""})
				return
			} else { //Subtract one reputation from the user
				stackoverflowclone_db.collection("user_accounts").updateOne({"username": question["username"]}, {"$set": {"reputation": user["reputation"] - 1}})
				stackoverflowclone_db.collection("votes").insertOne({"id": uuidv4(), "post_type": "question", "username": req.session.username, "post_id": question["id"], "status": "downvote"})
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
		res.status(400).json({"status": "error", "error": "Answer does not exist!"})
		return
	}
	if(req.body.upvote == null)
		upvote_option = true
	else
		upvote_option = req.body.upvote
	console.log(upvote_option + " id: " + req.params.id)
	var user = await Promise.all([retrieve_user(answer["user"])])
	user = user[0]
	function setScore(id, score){
		return stackoverflowclone_db.collection("question_answers").updateOne({"id": id}, {"$set": {"score": score}})
	}
	function updateRep(username, reputation){
		return stackoverflowclone_db.collection("user_accounts").updateOne({"username": username}, {"$set": {"reputation": reputation}})
	}
	function insertVotes(dictionary){
		return stackoverflowclone_db.collection("votes").insertOne(dictionary)
	}
	function updateVotes(username, id, status){
		return stackoverflowclone_db.collection("votes").updateOne({"username": username, "post_type": "answer", "post_id": id}, {"$set": {"status": status}})
	}
	if(vote == null){ //If a vote document doesn't exist in the database
		if(upvote_option){ //Add one reputation to the user
			var results = await Promise.all([setScore(req.params.id, answer["score"] + 1), updateRep(answer["user"], user["reputation"] + 1), insertVotes({"id": uuidv4(), "post_type": "answer", "username": req.session.username, "post_id": answer["id"], "status": "upvote"})])
			res.json({"status": "OK", "error": ""})
			return
		} else {
			if(user["reputation"] <= 1){ //When user reputation is <= 1, we cannot go lower
				var results = await Promise.all([setScore(req.params.id, answer["score"] - 1), insertVotes({"id": uuidv4(), "post_type": "answer", "username": req.session.username, "post_id": answer["id"], "status": "downvote_ignored"})])
				res.json({"status": "OK", "error": ""})
				return
			} else { //Subtract one reputation from the user
				var results = await Promise.all([setScore(req.params.id, answer["score"] - 1), updateRep(answer["user"], user["reputation"] -1), insertVotes({"id": uuidv4(), "post_type": "answer", "username": req.session.username, "post_id": answer["id"], "status": "downvote"})])
				res.json({"status": "OK", "error": ""})
				return
			}
		}
	} else { //If a vote document already exists then we check it first before making changes
		if(upvote_option){
			if(vote["status"] == "none"){  //+1 rep
				var results = await Promise.all([setScore(req.params.id, answer["score"] + 1),updateRep(answer["user"], user["reputation"] + 1), updateVotes(req.session.username, answer["id"], "upvote")])
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote") {//+2 rep
				var results = await Promise.all([setScore(req.params.id, answer["score"] + 2), updateRep(answer["user"], user["reputation"] + 2), updateVotes(req.session.username, answer["id"], "upvote")])
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote_ignored"){//+1 rep 
				var results = await Promise.all([setScore(req.params.id, answer["score"] + 2), updateRep(answer["user"], user["reputation"] + 1), updateVotes(req.session.username, answer["id"], "upvote")])
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "upvote") {//-1 
				if(user["reputation"] <= 1){
					var results = await Promise.all([setScore(req.params.id, answer["score"] -1), updateVotes(req.session.username, answer["id"], "none")])
					res.json({"status": "OK", "error": ""})
					return
				} else {
					var results = await Promise.all([setScore(req.params.id, answer["score"] - 1), updateRep(answer["user"], user["reputation"] - 1), updateVotes(req.session.username, answer["id"], "none")])
					res.json({"status": "OK", "error": ""})
					return
				}
			}
		} else {
			if(vote["status"] == "none") {//-1
				if(user["reputation"] <= 1){
					var results = await Promise.all([setScore(req.params.id, answer["score"] -1), updateVotes(req.session.username, answer["id"], "downvote_ignored")])
					res.json({"status": "OK", "error": ""})
					return
				} else {
					var results = await Promise.all([setScore(req.params.id, answer["score"] - 1), updateRep(answer["user"], user["reputation"] + 1), updateVotes(req.session.username, answer["id"], "downvote")])
					res.json({"status": "OK", "error": ""})
					return
				}

			}
			if(vote["status"] == "downvote") {//+1
				var results = await Promise.all([setScore(req.params.id, answer["score"] + 1), updateRep(answer["user"], user["reputation"] + 1), updateVotes(req.session.username, answer["id"], "none")])
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "downvote_ignored"){//0
				var results = await Promise.all([setScore(req.params.id, answer["score"] + 1), updateVotes(req.session.username, answer["id"], "none")])
				res.json({"status": "OK", "error": ""})
				return
			}
			if(vote["status"] == "upvote") {//-2
				if(user["reputation"] == 2){ //If it is exactly 2, we have to ignore the downvote, but still subtract 1
					var results = await Promise.all([setScore(req.params.id, answer["score"] - 2), updateRep(answer["user"], user["reputation"] - 1), updateVotes(req.session.username, answer["id"], "downvote_ignored")])
					res.json({"status": "OK", "error": ""})
					return
				} else if(user["reputation"] <= 1){ //Only update the vote document
					var results = await Promise.all([setScore(req.params.id, answer["score"] - 2), updateVotes(req.session.username, answer["id"], "downvote_ignored")])
					res.json({"status": "OK", "error": ""})
					return
				} else{
					var results = await Promise.all([setScore(req.params.id, answer["score"] - 2), updateRep(answer["user"], user["reputation"] - 2), updateVotes(req.session.username, answer["id"], "downvote")])
					res.json({"status": "OK", "error": ""})
					return
				}
			}
		}
	}
})

app.post('/answers/:id/accept', function(req, res){
	stackoverflowclone_db = soc_db.db("StackOverflowClone")
	stackoverflowclone_db.collection("question_answers").findOne({"id": req.params.id}, function(err, a_result){
		if(err) throw err;
		if(a_result == null){
			res.status(400).json({"status": "error", "error": "Answer was not found in database"})
			return
		}
		stackoverflowclone_db.collection("questions").findOne({"id": a_result["q_id"]}, function(err, q_result){
			if(err) throw err;
			if(req.session.username != q_result["username"]){
				res.status(400).json({"status": "error", "error": "User trying to accept answer is not the asker of the question!"})
				return
			} else if (q_result["accepted_answer_id"] != null){
				res.status(400).json({"status": "error", "error": "Question already has an accepted answer"})
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

app.post('/addmedia', upload.single('content'), async function(req, res){
	if(req.session.username == null){
		res.status(400).json({"status": "error", "id": "", "error": "User is not logged in!"})
		return
	}
	var uploaded_content = req.file.buffer
	var file_ext = req.file.originalname.split(".")[1] //Retrieve the file extension
	var file_id = uuidv4()
	var query = `INSERT INTO media (file_id, ext, content, user) VALUES (?, ?, ?, ?);`
	var params = [file_id, file_ext, uploaded_content, req.session.username]
	redis_client.set(file_id, [file_ext, req.file.buffer], 'EX', 4)
	cassandra_cluster.execute(query, params, function(err, result){
		if(err){
			console.log(err)
			return
		}
		console.log(result)
		res.json({"status": "OK", "id": file_id, "error": ""})
		console.log(file_id + " has been uploaded into the database with ext: " + file_ext + ", user: " + req.session.username)
	})
})

app.get('/media/:id', function(req, res){
	var file_id = req.params.id
	if(file_id == null){
		res.status(400)
		res.json({"status": "error", "error": "id is null"})
		return
	}
	var query = `SELECT ext, content FROM media WHERE file_id=?;`
	var params = [file_id]
	console.log("Trying to find image with id: " + req.params.id)
	cassandra_cluster.execute(query, params, function(err, result){
		if(err){
			console.log(err)
		}
		console.log("Found result with row length: " + result.rowLength)
		//console.log(result)
		if(result.rowLength == 0 && redis_client.get(req.params.id) == null){
			res.status(400)
			res.json({"status": "error", "error": "Image not found"})
			return
		} else if(result.rowLength == 0 && redis_client.get(req.params.id) != null){ //Get from redis
			console.log("Getting image from cache...")
			var img = redis_client.get(req.params.id)
			header = img[0]
			if(header == "jpg"){
				res.header("Content-Type", "image/jpeg")
			}
			if(header == "gif"){
				res.header("Content-Type", "image/gif")
			}
			if(header == "png"){
				res.header("Content-Type", "image/png")
			}
			res.send(img[1])
		} else {
			console.log(result.rows[0].ext)
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
		}
	})
})

app.listen(port, function() {
	console.log("It works!")
})
