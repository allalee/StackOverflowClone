#!/usr/bin/env python
from flask import Flask, request, render_template, jsonify, session, make_response, redirect, url_for, abort
import datetime, string, json, pymongo, time

db_connection = pymongo.MongoClient("mongodb://localhost:27017/")
database = db_connection.UserAccounts
views_database = db_connection.ViewCount
account_system = database.accounts #Refer to the accounts collection in the database
account_questions = database.account_questions #Refers to the data of the questions asked by each user
question_answers = database.question_answers
views_db = views_database.view_tracker #Tracks views for questions

app = Flask(__name__, template_folder='templates')
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.secret_key = b'_5#y2L"F4Q8z\n\xec]/'

@app.route('/', methods=['GET'])
def index():
	return "Index Page"

@app.route("/login", methods=['GET', 'POST'])
def login():
	if(request.method == 'POST'):
		request_json = request.get_json()
		username = request_json['username']
		password = request_json['password']
		found = account_system.find_one({"username": username})
		if(found == None):
			return jsonify({"status": "error", "error": "Username not found!"})
		if(found["verified"] == "no"):
			return jsonify({"status": "error", "error": "User is not verified!"})
		if(found["password"] != password):
			return jsonify({"status": "error", "error": "Invalid password!"})
		session["username"] = username
		session.permanent = True
		return jsonify({"status": "OK", "error": ""})
	if 'username' in session:
		return render_template('login.html', logged_out=False)
	else:
		return render_template('login.html', logged_out=True)

@app.route("/logout", methods=['GET', 'POST'])
def logout():
	if not('username' in session):
		return jsonify({"status": "error", "error": "Not signed in!"})
	session.clear()
	return jsonify({"status": "OK", "error": ""})

@app.route("/questions/add", methods=['GET', 'POST'])
def add_question():
	if(request.method == 'GET'):
		return render_template('add_question.html')
	else:
		if not('username' in session):
			return jsonify({"status": "error","id": "", "error": "User not logged in!"})
		else:
			request_json = request.get_json()
			question_count = account_questions.count() + 1 #Will be our unique ID for now...
			question_count = str(question_count) #IDs must be a string
			question = {}
			question["id"] = question_count
			question["user"] = {"username": session['username'], "reputation": 1} #Default reputation is set to 1 currently. Will change in the future
			question["title"] = request_json['title']
			question["body"] = request_json['body']
			question["score"] = 0
			question["view_count"] = 0
			question["answer_count"] = 0
			question["timestamp"] = int(time.time())
			question["media"] = "" #Currently do not support media tags in the version
			question["tags"] = request_json["tags"].split(",")
			question["accepted_answer_id"] = None
			account_questions.insert(question)
			return jsonify({"status": "OK", "id": question_count, "error": ""})

@app.route("/questions/<q_id>", methods=['GET'])
def get_question(q_id):
	found_question = account_questions.find_one({"id": q_id})
	if(found_question == None):
		return jsonify({"status": "error", "question": "", "error": "Question not found"})
	else:
		if(found_question["view_count"] == 0): #If the question has 0 view count then we must insert into db a new document
			views_db.insert({"id": found_question["id"], "usernames": [], "ips": []})
		view_tracker = views_db.find_one({"id": found_question["id"]})
		if('username' in session): #If the user is logged in then we check for view by username
			view_tracker_user_list = view_tracker["usernames"]
			if not(session['username'] in view_tracker_user_list):
				views_db.update({"id": found_question["id"]}, {'$push': {"usernames": session['username']}})
				account_questions.update({"id": q_id}, {'$set': {"view_count": found_question["view_count"] + 1}})
		else:	#If user is not logged in then we check for unique ip
			ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
			view_tracker_ip_list = view_tracker["ips"]
			if not(ip in view_tracker_ip_list):
				views_db.update({"id": q_id}, {'$push': {"ips": ip}})
				account_questions.update({"id": q_id}, {'$set': {"view_count": found_question["view_count"] + 1}})
		found_question = account_questions.find_one({"id": q_id})
		question = {}
		question["id"] = found_question["id"]
		question["user"] = found_question["user"]
		question["title"] = found_question["title"]
		question["body"] = found_question["body"]
		question["score"] = found_question["score"]
		question["view_count"] = found_question["view_count"]
		question["answer_count"] = found_question["answer_count"]
		question["timestamp"] = found_question["timestamp"]
		question["media"] = found_question["media"]
		question["tags"] = found_question["tags"]
		question["accepted_answer_id"] = found_question["accepted_answer_id"]
		return jsonify({"status": "OK", "question": question, "error": ""})

@app.route("/questions/<q_id>/answers/add", methods=['GET','POST'])
def add_question_answer(q_id):
	if(request.method == 'GET'):
		return render_template("add_question_answer.html")
	else:
		if (account_questions.find_one({"id": q_id}) == None):
			return jsonify({"status": "error", "id": "", "error": "Question does not exist!"})
		if not('username' in session):
			return jsonify({"status": "error", "id": "", "error": "User is not logged in!"})
		request_json = request.get_json()
		answer = {}
		answer["q_id"] = q_id
		answer["id"] = question_answers.count() + 1
		answer["user"] = session["username"]
		answer["body"] = request_json["body"]
		answer["score"] = 0
		answer["is_accepted"] = False
		answer["timestamp"] = int(time.time())
		answer["media"] = request_json["media"]
		question_answers.insert(answer)
		return jsonify({"status": "OK", "id": answer["id"], "error": ""})

@app.route("/questions/<q_id>/answers", methods=['GET'])
def get_question_answers(q_id):
	if(account_questions.find_one({"id": q_id}) == None):
		return jsonify({"status": "error", "answers": "", "error": "Question is not found!"})
	else:
		queried_answers = question_answers.find({"q_id": q_id}, {'_id': False, 'q_id': False})
		answer_array = []
		for answer in queried_answers:
			answer_array.append(answer)
		return jsonify({"status": "OK", "answers": answer_array, "error": ""})

@app.route("/search", methods=['GET','POST'])
def search_questions():
	if(request.method == 'GET'):
		return render_template("search_question.html")
	else:
		request_json = request.get_json()
		current_timestamp = 0
		if(request_json["timestamp"] == ""): #Optional timestamp
			current_timestamp = int(time.time())
		else:
			if(int(request_json["timestamp"]) < 0):
				return jsonify({"status": "error", "questions": "", "error": "Timestamp or limit is an invalid integer"})
			current_timestamp = int(request_json["timestamp"])
		question_limit = 0
		if(request_json["limit"] == ""):
			question_limit = 25 #Default is 25
		else:
			if(int(request_json["limit"]) < 0 or int(request_json["limit"]) > 100):
				return jsonify({"status": "error", "questions": "", "error": "Timestamp or limit is an invalid integer"})
			question_limit = int(request_json["limit"])
		returned_questions = account_questions.find({"timestamp": {'$lte': current_timestamp}}, {"_id": False}).sort("timestamp", -1).limit(question_limit)
		q_list = []
		for q in returned_questions:
			q_list.append(q)	
		return jsonify({"status": "OK", "questions": q_list, "error": ""})


if __name__ == '__main__':
   app.run(host='0.0.0.0', port=3001)