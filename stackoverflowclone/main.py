#!/usr/bin/env python
from flask import Flask, request, render_template, jsonify, session, make_response, redirect, url_for, abort
import datetime, string, json, pymongo, time

db_connection = pymongo.MongoClient("mongodb://localhost:27017/")
database = db_connection.UserAccounts
account_system = database.accounts #Refer to the accounts collection in the database
account_questions = database.account_questions #Refers to the data of the questions asked by each user

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
			question["accepted_answer_id"] = "Null"
			account_questions.insert(question)
			return jsonify({"status": "OK", "id": question_count, "error": ""})


if __name__ == '__main__':
   app.run(host='0.0.0.0', port=3001)