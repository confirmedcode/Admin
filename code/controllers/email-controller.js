const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { body } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Models
const { User, Campaign, CampaignEmail } = require("shared/models");

// Utilities
const { Email, Secure } = require("shared/utilities");
const nodemailer = require('nodemailer');
const aws = require("aws-sdk");
const transporter = nodemailer.createTransport({
  SES: new aws.SES({
    apiVersion: '2010-12-01',
    region: "us-east-1"
  }),
  sendingRate: 13 // max 13 messages/second
});
const sqs = new aws.SQS();
const sts = new aws.STS();
const handlebars = require("handlebars");

// Constants
const DOMAIN = process.env.DOMAIN;
const AES_EMAIL_KEY = process.env.AES_EMAIL_KEY;
const ENVIRONMENT = process.env.ENVIRONMENT == "LOCAL" ? "DEV" : process.env.ENVIRONMENT;
const QUEUE_REGION = "us-east-1"
var accountId;

// Routes
const router = require("express").Router();

/*********************************************
 *
 * Email Page
 *
 *********************************************/

router.get("/email",
authenticate,
(request, response, next) => {
  var bouncesAttributes;
  var complaintAttributes;
  return sts.getCallerIdentity().promise()
  .then( result => {
    accountId = result.Account;
    return sqs.getQueueAttributes({
      QueueUrl: `https://sqs.${QUEUE_REGION}.amazonaws.com/${accountId}/${ENVIRONMENT}-BouncesQueue`,
      AttributeNames: [ "All" ]
    }).promise()
  })
  .then( result => {
    bouncesAttributes = result;
    return sqs.getQueueAttributes({
    QueueUrl: `https://sqs.${QUEUE_REGION}.amazonaws.com/${accountId}/${ENVIRONMENT}-ComplaintsQueue`,
      AttributeNames: [ "All" ]
    }).promise()
  })
  .then( result => {
    complaintAttributes = result;
    return Campaign.getAll()
  })
  .then( result => {
    return response.render("email", 
    {
      bounces: bouncesAttributes.Attributes.ApproximateNumberOfMessages,
      complaints: complaintAttributes.Attributes.ApproximateNumberOfMessages,
      campaigns: result
    });
  })
  .catch(error => { next(error); });
});

router.post("/campaign-stats",
[
  authenticate,
  body("id")
    .exists().withMessage("Missing id."),
  validateCheck
],
(request, response, next) => {
  
  var id = request.values.id;
  
  // Notify Admin
  Email.sendAdminAlert("ADMIN ACTION", "Get Campaign Stats By " + request.user.email);
  
  return Campaign.getStats(id)
  .then( stats => {
    return response.status(200).json(stats);
  })
  .catch(error => { next(error); });
});

router.post("/create-campaign",
[
  authenticate,
  body("name")
    .exists().withMessage("Missing name."),
  body("fromAddress")
    .exists().withMessage("Missing fromAddress."),
  body("subject")
    .exists().withMessage("Missing subject."),
  body("html")
    .exists().withMessage("Missing html."),
  body("plaintext")
    .exists().withMessage("Missing plain."),
  validateCheck
],
(request, response, next) => {
  
  var name = request.values.name;
  var fromAddress = request.values.fromAddress;
  var subject = request.values.subject;
  var html = request.values.html;
  var plaintext = request.values.plaintext;
  
  // Notify Admin
  Email.sendAdminAlert("ADMIN ACTION", "Created Campaign By " + request.user.email);
  
  return Campaign.create(name, fromAddress, subject, html, plaintext)
  .then( info => {
    return response.status(200).json({
      message: "success"
    });
  })
  .catch(error => { next(error); });
});

router.post("/send-single-email",
[
  authenticate,
  body("campaignId")
    .exists().withMessage("Missing campaign ID."),
  body("toAddress")
    .exists().withMessage("Missing to."),
  validateCheck
],
(request, response, next) => {
  
  var campaignId = request.values.campaignId;
  var toAddress = request.values.toAddress;

  Email.sendAdminAlert("ADMIN ACTION", "Send Single Email By " + request.user.email);
  
  var unsubscribeCode = "";
  var campaign;
  
  return User.getWithEmail(toAddress)
  .catch( error => {
    Logger.info("Error getting user but continuing: " + JSON.stringify(error))
  })
  .then( user => {
    if (user) {
      unsubscribeCode = user.newsletterUnsubscribeCode;
    }
    return Campaign.getById(campaignId);
  })
  .then( result => {
    campaign = result;
    unsubscribeLink = `https://${DOMAIN}/newsletter-unsubscribe?email=${toAddress}&code=${unsubscribeCode}`
    let plaintext = campaign.plaintext + "\nUnsubscribe from future emails: " + unsubscribeLink;
    let html = campaign.html + `<div style="width:100%; text-align:center; margin-bottom: 10px;"><a href="${unsubscribeLink}" style="font-size: 10.5px; text-decoration: underline; color: gray;">Unsubscribe</a></div>`;
    return transporter.sendMail({
      from: campaign.fromAddress,
      to: toAddress,
      subject: campaign.subject,
      text: plaintext,
      html: html
    });
  })
  .then( info => {
    response.status(200).json({
      message: "success"
    })
  })
  .catch(error => { next(error); });

});

router.post("/send-emails-to-campaign",
[
  authenticate,
  body("campaignId")
    .exists().withMessage("Missing campaign ID."),
  body("maxNum")
    .exists().withMessage("Missing number of emails."),
  validateCheck
],
(request, response, next) => {
  
  var campaignId = request.values.campaignId;
  var maxNum = request.values.maxNum;
  var campaign;
  var count = 0;
  var successCount = 0;
  
  Email.sendAdminAlert("ADMIN ACTION", "Send Emails To Campaign By " + request.user.email);

  return Campaign.getById(campaignId)
  .then( result => {
    campaign = result;
    Logger.info("getting unsent emails and marking as sent")
    return CampaignEmail.getUnsentEmailsAndMarkAsSent(campaignId, maxNum);
  })
  .then( campaignEmails => {
    response.status(200).json({
      message: "queuing " + campaignEmails.length + " campaign emails"
    })  
    campaignEmails.forEach(campaignEmail => {
      count = count + 1;
      Logger.info("queueing email #" + count)
      var email = Secure.aesDecrypt(campaignEmail.emailEncrypted, AES_EMAIL_KEY);
      unsubscribeLink = `https://${DOMAIN}/newsletter-unsubscribe?email=${email}&code=${campaignEmail.unsubscribeCode}`
      let plaintext = campaign.plaintext + "\nUnsubscribe from future emails: " + unsubscribeLink;
      let html = campaign.html + `<div style="width:100%; text-align:center; margin-bottom: 10px;"><a href="${unsubscribeLink}" style="font-size: 10.5px; text-decoration: underline; color: gray;">Unsubscribe</a></div>`;
      transporter.sendMail({
        from: campaign.fromAddress,
        to: email,
        subject: campaign.subject,
        text: plaintext,
        html: html
      })
      .then(result => {
        successCount = successCount + 1;
        Logger.info("successfully sent email #" + successCount);
      })
      .catch(error => {
        // set as failed in DB but continue
        Logger.error("Error sending campaign email: " + JSON.stringify(error, null, 2))
        CampaignEmail.setFailed(campaignEmail.id);
      })
    })
  })
  .catch(error => { next(error); });

});

router.post("/fetch-bounces",
[
  authenticate,
  validateCheck
],
(request, response, next) => {
  
  // Notify Admin
  Email.sendAdminAlert("ADMIN ACTION", "Fetch Bounces By " + request.user.email);
  
  sqs.receiveMessage({
    QueueUrl: `https://sqs.${QUEUE_REGION}.amazonaws.com/${accountId}/${ENVIRONMENT}-BouncesQueue`,
    MaxNumberOfMessages: "10",
    VisibilityTimeout: "600", // 10 minutes
    WaitTimeSeconds: "1"
  }).promise()
  .then( result => {
    var toReturn = [];
    if (!result.Messages) {
      return response.status(200).json({
        message: []
      });
    }
    result.Messages.forEach( message => {
      let parsedMessage = JSON.parse(JSON.parse(message.Body).Message)
      if (parsedMessage.notificationType == 'Bounce') {
        var toPush = parsedMessage.bounce
        if (toPush.bouncedRecipients && toPush.bouncedRecipients.length > 0) {
          toPush.rEmail = toPush.bouncedRecipients[0].emailAddress
          toPush.rAction = toPush.bouncedRecipients[0].action
          toPush.rStatus = toPush.bouncedRecipients[0].status
          toPush.rCode = toPush.bouncedRecipients[0].diagnosticCode
        }
        toPush.sender = parsedMessage.mail.source
        toPush.sendTime = parsedMessage.mail.timestamp
        toPush.id = message.MessageId
        toPush.receiptHandle = message.ReceiptHandle
        toReturn.push(toPush);
      }
    });
    response.status(200).json({
      message: toReturn
    });
  })
  .catch(error => { next(error); });
  
});

router.post("/fetch-complaints",
[
  authenticate,
  validateCheck
],
(request, response, next) => {
  
  // Notify Admin
  Email.sendAdminAlert("ADMIN ACTION", "Fetch Complaints By " + request.user.email);
  
  sqs.receiveMessage({
    QueueUrl: `https://sqs.${QUEUE_REGION}.amazonaws.com/${accountId}/${ENVIRONMENT}-ComplaintsQueue`,
    MaxNumberOfMessages: "10",
    VisibilityTimeout: "600", // 10 minutes
    WaitTimeSeconds: "1"
  }).promise()
  .then( result => {
    var toReturn = [];
    if (!result.Messages) {
      return response.status(200).json({
        message: []
      });
    }
    result.Messages.forEach( message => {
      let parsedMessage = JSON.parse(JSON.parse(message.Body).Message)
      if (parsedMessage.notificationType == 'Complaint') {
        var toPush = parsedMessage.complaint
        if (toPush.complainedRecipients && toPush.complainedRecipients.length > 0) {
          toPush.rEmail = toPush.complainedRecipients[0].emailAddress
        }
        toPush.sender = parsedMessage.mail.source
        toPush.sendTime = parsedMessage.mail.timestamp
        toPush.id = message.MessageId
        toPush.receiptHandle = message.ReceiptHandle
        toReturn.push(toPush);
      }
    });
    response.status(200).json({
      message: toReturn
    });
  })
  .catch(error => { next(error); });
  
});

router.post("/delete-queue-messages",
[
  authenticate,
  body("type")
    .exists().withMessage("Missing type."),
  body("ids")
    .exists().withMessage("Missing IDs."),
  body("receiptHandles")
    .exists().withMessage("Missing receiptHandles."),
  validateCheck
],
(request, response, next) => {
  
  const type = request.values.type;
  const ids = JSON.parse(request.values.ids);
  const receiptHandles = JSON.parse(request.values.receiptHandles);
  
  // Notify Admin
  Email.sendAdminAlert("ADMIN ACTION", "Delete Queue Messages By " + request.user.email);
  
  var entries = [];
  ids.forEach( (id, index) => {
    entries.push({
      Id: id,
      ReceiptHandle: receiptHandles[index]
    })
  })
  
  sqs.deleteMessageBatch({
    Entries: entries,
    QueueUrl: `https://sqs.${QUEUE_REGION}.amazonaws.com/${accountId}/${ENVIRONMENT}-${type}Queue`,
  }).promise()
  .then( result => {
    response.status(200).json({
      message: result
    });
  })
  .catch(error => { next(error); });
  
});


module.exports = router;