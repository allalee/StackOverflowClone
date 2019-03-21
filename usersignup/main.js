const express = require('express')
const body_parser = require('body-parser') //Middleware in order to retrieve the request body
const app = express()
const port = 3000

app.use(express.static(__dirname + '/static'))  //Defines where to find static files for express use
app.use(body_parser.json()) //Tells the application to use the body_parser middleware

app.get('/', (req,res) => 
	res.sendFile('/static/index.html'))

app.get('/adduser', function(req, res){
	res.sendFile(__dirname + "/static/adduser.html")
})

app.post('/adduser', function(req, res){
	console.log(req.body)
	console.log(req.body.username)
})

// var nodemailer = require('nodemailer');
// var transporter = nodemailer.createTransport({
// 	service: 'gmail',
// 	auth: {
// 		user: 'artemisiacse356@gmail.com',
// 		pass: 'cse356verify'
// 	}
// });
// var mailOptions = {
// 	from: 'artemisiacse356@gmail.com',
// 	to: 'artemisiacse356@gmail.com',
// 	subject: 'Sending Email using Node.js',
// 	text: 'That was easy!'
// };
// transporter.sendMail(mailOptions, function(error, info){
// 	if(error){
// 		console.log(error);
// 	} else {
// 		console.log('Email sent')
// 	}
// });

app.listen(port, () => console.log('Example app listening on port ${port}!'))