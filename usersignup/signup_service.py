#!/usr/bin/env python
from flask import Flask, request, render_template, jsonify, session, make_response, redirect, url_for, abort
import datetime, string, json, pymongo, random, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# email = "artemisiacse356@gmail.com"
# password = "cse356verify"
# subject = "E-mail Verification"
backdoor = "abracadabra"

def send_verification(message, send_to_email):
	msg = MIMEMultipart()
	msg['From'] = "artemisiacse356@gmail.com"
	msg['To'] = send_to_email
	msg['Subject'] = "E-mail Verification"
	msg.attach(MIMEText("validation key: <%s>" % message, 'plain'))
	server = smtplib.SMTP('smtp.gmail.com', 587)
	server.starttls()
	server.login("artemisiacse356@gmail.com", "cse356verify")
	text = msg.as_string()
	server.sendmail("artemisiacse356@gmail.com", send_to_email, text)
	server.quit()

def id_generator(size=6, chars=string.ascii_uppercase + string.digits):
	return ''.join(random.choice(chars) for _ in range(size))

# db_connection = pymongo.MongoClient("mongodb://localhost:27017/")
# database = db_connection.warmup 
# account_system = database.accounts #Refer to the accounts collection in the database
# current_games = database.currentgames
db_connection = pymongo.MongoClient("mongodb://localhost:27017/")
database = db_connection.UserAccounts
account_system = database.accounts

app = Flask(__name__, template_folder='templates')
app.config['TEMPLATES_AUTO_RELOAD'] = True

@app.route('/', methods=['GET'])
def index():
	return "Index Page"

@app.route('/adduser', methods=['GET','POST'])
def adduser():
	if(request.method == 'POST'):
		request_json = request.get_json()
		username = request_json['username']
		password = request_json['password']
		email = request_json['email']

		#Check to see if username and email already exists. If yes, return error
		if(account_system.find_one({"username": username}) != None):
			return jsonify({"status" : "error", "error": "Username or Email already exists!"})
		elif(account_system.find_one({"email": email}) != None):
			return jsonify({"status" : "error", "error": "Username or Email already exists!"})
		else:
			key = id_generator(size=6, chars=string.ascii_uppercase + string.digits)
			send_verification(key, email)
			account_system.insert({"username": username, "password": password, "email": email, "verified": "no", "key": key})
			return jsonify({"status": "OK", "error": ""})
	return render_template('adduser.html')

@app.route('/verify', methods=['GET', 'POST'])
def verify():
	if(request.method == 'POST'):
		request_json = request.get_json()
		email = request_json['email']
		key = request_json['key']
		found = account_system.find_one({"email": email})
		if(found == None):
			return jsonify({"status": "error", "error": "Email not found!"})
		if(found['key'] == key or key == "abracadabra"):
			account_system.update({"email": email}, {'$set' : {"verified": "yes"}})
			return jsonify({"status": "OK", "error": ""})
		else:
			return jsonify({"status": "error", "error": "Bad key"})
	return render_template('verify.html')

if __name__ == '__main__':
   app.run(host='0.0.0.0', port=3000)
