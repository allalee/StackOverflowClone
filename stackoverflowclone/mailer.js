const nodemailer = require("nodemailer")

function makeid(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function mail(receiver, validation_key){
	let transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'artemisiacse356@gmail.com',
			pass: 'cse356verify'
		}
	});

	let mailOptions = {
		from: 'artemisiacse356@gmail.com',
		to: receiver,
		subject: 'E-mail Verification',
		text: validation_key
	}

	transporter.sendMail(mailOptions, function(err, info){
		if(err) {
			console.log(err)
		}
	})
}

module.exports = {
	mail: mail,
	makeid: makeid
}
