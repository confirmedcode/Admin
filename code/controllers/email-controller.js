const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { body } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Utilities
const { Email } = require("shared/utilities");
const aws = require("aws-sdk");
const sqs = new aws.SQS();
const sts = new aws.STS();

// Constants
const ENVIRONMENT = process.env.ENVIRONMENT;
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
    response.render("email", 
    {
      bounces: bouncesAttributes.Attributes.ApproximateNumberOfMessages,
      complaints: result.Attributes.ApproximateNumberOfMessages
    });
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
  Email.sendAdminAlert("Fetch Bounces By " + request.user.email);
  
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
  Email.sendAdminAlert("Fetch Complaints By " + request.user.email);
  
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
  Email.sendAdminAlert("Delete Queue Messages By " + request.user.email);
  
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