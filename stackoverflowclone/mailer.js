const send = require('gmail-send')({user: "artemisiacse356@gmail.com", pass: "cse356verify"})
const nodemailer = require('nodemailer')
var transporter = nodemailer.createTransport({
	host: "artemisia.cse356.compas.cs.stonybrook.edu",
	port: 25,
	pool: true,
	secure: false,
	tls: {
		rejectUnauthorized: false
	}
})

// const transporter = nodemailer.createTransport({
// 	service: 'Gmail',
// 	auth: {
// 		user: "artemisiacse356@gmail.com",
// 		pass: "cse356verify"
// 	}
// })

function makeid(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function mail(receiver, validation_key){
	// let transporter = nodemailer.createTransport({
	// 	service: 'gmail',
	// 	auth: {
	// 		user: 'artemisiacse356@gmail.com',
	// 		pass: 'cse356verify'
	// 	}
	// });
	// send({
	// 	// user: "artemisiacse356@gmail.com",
	// 	// pass: "cse356verify",
	// 	to: receiver,
	// 	subject: "E-mail Verification",
	// 	text: "validation key: <" + validation_key + ">"
	// })
	// console.log("Mail has been sent")
	// nodemailer.createTestAccount(function(err, account){
	// 	let transporter = nodemailer.createTransport({
	// 		host: account.smtp.host,
	// 		port: account.smtp.port,
	// 		secure: account.smtp.secure,
	// 		auth: {
	// 			user: account.user,
	// 			pass: account.pass
	// 		}
	// 	})
	let mailOptions = {
		from: 'artemisiacse356@gmail.com',
		to: receiver,
		subject: 'E-mail Verification',
		text: "validation key : <" + validation_key + ">"
	}
	console.log("Transporter trying to send mail...")
	transporter.sendMail(mailOptions, function(err, info){
		if(err) {
			console.log(err)
		}
		console.log(info)
	})
	// })
}

module.exports = {
	mail: mail,
	makeid: makeid
}
