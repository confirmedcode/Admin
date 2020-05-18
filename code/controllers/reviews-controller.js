const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const authenticate = require("../middleware/authenticate.js");
const { body, query } = require("express-validator/check");
const ValidateCheck = require("../middleware/validate-check.js");

// Models
const { Review, Tracker } = require("shared/models");

// Routes
const router = require("express").Router();

router.get("/reviews",
[
  authenticate
],
(request, response, next) => {
  return Review.getAllWithoutTrackers(true)
    .then(reviews => {
      return response.render("reviews", {
        reviews: reviews
      });
    })
    .catch(error => { next(error); });
});

router.get("/new-review",
authenticate,
(request, response, next) => {
  return response.render("reviews-new");
});

router.get("/edit-review",
[
  authenticate,
  query("name")
    .exists().withMessage("Missing name.")
    .not().isEmpty().withMessage("Missing name."),
  ValidateCheck
],
(request, response, next) => {
  const name = request.values.name;
  
  return Review.getWithName(name, true)
    .then(review => {
      return response.render("reviews-edit", {
        review: review
      });
    })
    .catch(error => { next(error); });
});

router.post("/save-review",
[
  authenticate,
  body("reviewId"),
  body("reviewName")
    .exists().withMessage("Missing name.")
    .not().isEmpty().withMessage("Missing name."),
  body("reviewDisplayName")
    .exists().withMessage("Missing display name.")
    .not().isEmpty().withMessage("Missing display name."),
  body("reviewTagline")
    .exists().withMessage("Missing tagline.")
    .not().isEmpty().withMessage("Missing tagline."),
  body("reviewNumAttempts")
    .exists().withMessage("Missing num attempts.")
    .not().isEmpty().withMessage("Missing num attempts."),
  body("reviewRating")
    .exists().withMessage("Missing rating.")
    .not().isEmpty().withMessage("Missing rating."),
  body("reviewPlatforms")
    .exists().withMessage("Missing platforms.")
    .not().isEmpty().withMessage("Missing platforms."),
  body("reviewRanking"),
  body("reviewIconUrl")
    .exists().withMessage("Missing IconUrl.")
    .not().isEmpty().withMessage("Missing IconUrl."),
  body("reviewDisclaimer"),
  body("reviewDataRequiredInfo")
    .exists().withMessage("Missing DataRequiredInfo.")
    .not().isEmpty().withMessage("Missing DataRequiredInfo."),
  body("reviewDataRequiredAccess")
    .exists().withMessage("Missing DataRequiredAccess.")
    .not().isEmpty().withMessage("Missing DataRequiredAccess."),
  body("reviewDataOptional")
    .exists().withMessage("Missing reviewDataOptional.")
    .not().isEmpty().withMessage("Missing reviewDataOptional."),
  body("reviewScreenshotUrl"),
  body("reviewTestMethod")
    .exists().withMessage("Missing reviewTestMethod.")
    .not().isEmpty().withMessage("Missing reviewTestMethod."),
  body("reviewTestDescription")
    .exists().withMessage("Missing reviewTestDescription.")
    .not().isEmpty().withMessage("Missing reviewTestDescription."),
  body("reviewTestOpen")
    .exists().withMessage("Missing reviewTestOpen.")
    .not().isEmpty().withMessage("Missing reviewTestOpen."),
  body("reviewTestConsent")
    .exists().withMessage("Missing reviewTestConsent.")
    .not().isEmpty().withMessage("Missing reviewTestConsent."),
  body("reviewTestBackground")
    .exists().withMessage("Missing reviewTestBackground.")
    .not().isEmpty().withMessage("Missing reviewTestBackground."),
  body("reviewTestNotes")
    .exists().withMessage("Missing reviewTestNotes.")
    .not().isEmpty().withMessage("Missing reviewTestNotes."),
  body("reviewSummaryUrl"),
  body("reviewPublished")
    .exists().withMessage("Missing reviewPublished.")
    .not().isEmpty().withMessage("Missing reviewPublished.")
    .isBoolean(),
  body("reviewTrackerNames")
    .exists().withMessage("Missing TrackerNames.")
    .not().isEmpty().withMessage("Missing TrackerNames."),
  ValidateCheck
],
(request, response, next) => {

  var id = request.values.reviewId ? request.values.reviewId : false;
  const name = request.values.reviewName;
  const displayName = request.values.reviewDisplayName;
  const tagline = request.values.reviewTagline;
  const numAttempts = request.values.reviewNumAttempts
  const rating = request.values.reviewRating
  const date = new Date()
  const platforms = request.values.reviewPlatforms
  const ranking = request.values.reviewRanking
  const iconUrl = request.values.reviewIconUrl
  const disclaimer = request.values.reviewDisclaimer
  const dataRequiredInfo = request.values.reviewDataRequiredInfo.filter(function (el) { 
    return el != null && el != "";
  }); 
  const dataRequiredAccess = request.values.reviewDataRequiredAccess.filter(function (el) { 
    return el != null && el != "";
  }); 
  const dataOptional = request.values.reviewDataOptional.filter(function (el) { 
    return el != null && el != "";
  }); 
  const screenshotUrl = request.values.reviewScreenshotUrl
  const testMethod = request.values.reviewTestMethod
  const testDescription = request.values.reviewTestDescription
  const testOpen = request.values.reviewTestOpen
  const testConsent = request.values.reviewTestConsent
  const testBackground = request.values.reviewTestBackground
  const testNotes = request.values.reviewTestNotes
  const summaryUrl = request.values.reviewSummaryUrl
  const published = request.values.reviewPublished
  
  const trackerNames = request.values.reviewTrackerNames.filter(function (el) { 
    return el != null && el != "";
  }); 
  
  var p = Promise.resolve();

  // check if we're creating new review, or updating existing review
  if (id == false) {
    p = p.then( result => {
      return Review.create(name, displayName, tagline, numAttempts, rating, date, platforms, ranking, iconUrl, disclaimer, dataRequiredInfo, dataRequiredAccess, dataOptional, screenshotUrl, testMethod, testDescription, testOpen, testConsent, testBackground, testNotes, summaryUrl, published, trackerNames);
    })
    .then( review => {
      id = review.id;
      return review;
    });
  }
  else {
    p = p.then( result => {
      return Review.update(id, name, displayName, tagline, numAttempts, rating, date, platforms, ranking, iconUrl, disclaimer, dataRequiredInfo, dataRequiredAccess, dataOptional, screenshotUrl, testMethod, testDescription, testOpen, testConsent, testBackground, testNotes, summaryUrl, published, trackerNames);
    });
  }

  return p.then( result => {
    return response.status(200).json({
      message: "Saved successfully",
      id: id
    });
  })
  .catch(error => { next(error); });
});

router.post("/delete-review",
[
  authenticate,
  body("reviewId")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id."),
  ValidateCheck
],
(request, response, next) => {

  const id = request.values.reviewId;

  return Review.deleteById(id)
    .then(review => {
      return response.status(200).json({
        message: "Deleted successfully"
      });
    })
    .catch(error => { next(error); });
});



router.get("/trackers",
[
  authenticate
],
(request, response, next) => {
  return Tracker.getAll()
    .then(trackers => {
      return response.render("trackers", {
        trackers: trackers
      });
    })
    .catch(error => { next(error); });
});

router.get("/edit-tracker",
[
  authenticate,
  query("name")
    .exists().withMessage("Missing name.")
    .not().isEmpty().withMessage("Missing name."),
  ValidateCheck
],
(request, response, next) => {
  const name = request.values.name;
  return Tracker.getWithName(name)
    .then(tracker => {
      return response.render("trackers-edit", {
        tracker: tracker
      });
    })
    .catch(error => { next(error); });
});

router.get("/new-tracker",
authenticate,
(request, response, next) => {
  return response.render("trackers-new");
});

router.post("/save-tracker",
[
  authenticate,
  body("trackerId"),
  body("trackerName")
    .exists().withMessage("Missing name.")
    .not().isEmpty().withMessage("Missing name."),
  body("trackerDisplayName")
    .exists().withMessage("Missing display name.")
    .not().isEmpty().withMessage("Missing display name."),
  body("trackerTagline")
    .exists().withMessage("Missing tagline.")
    .not().isEmpty().withMessage("Missing tagline."),
  body("trackerCategories")
    .exists().withMessage("Missing categories.")
    .not().isEmpty().withMessage("Missing categories."),
  body("trackerConnections")
    .exists().withMessage("Missing connections.")
    .not().isEmpty().withMessage("Missing connections."),
  body("trackerCollectedData")
    .exists().withMessage("Missing collected data.")
    .not().isEmpty().withMessage("Missing collected data."),
  ValidateCheck
],
(request, response, next) => {

  var id = request.values.trackerId ? request.values.trackerId : false;
  const name = request.values.trackerName;
  const displayName = request.values.trackerDisplayName;
  const tagline = request.values.trackerTagline;
  const categories =  request.values.trackerCategories.filter(function (el) { 
    return el != null && el != "";
  }); 
  const connections = request.values.trackerConnections.filter(function (el) { 
    return el != null && el != "";
  }); 
  const collectedData = request.values.trackerCollectedData;
  
  var p = Promise.resolve();

  // check if we're creating new tracker, or updating existing tracker
  if (id == false) {
    p = p.then( result => {
      return Tracker.create(name, displayName, tagline, categories, connections, collectedData);
    })
    .then( tracker => {
      id = tracker.id;
      return tracker;
    });
  }
  else {
    p = p.then( result => {
      return Tracker.update(id, name, displayName, tagline, categories, connections, collectedData);
    });
  }

  return p.then( result => {
    return response.status(200).json({
      message: "Saved successfully",
      id: id
    });
  })
  .catch(error => { next(error); });
});

router.post("/delete-tracker",
[
  authenticate,
  body("trackerId")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id."),
  ValidateCheck
],
(request, response, next) => {

  const id = request.values.trackerId;

  return Tracker.deleteById(id)
    .then(tracker => {
      return response.status(200).json({
        message: "Deleted successfully"
      });
    })
    .catch(error => { next(error); });
});

// router.get("/new-post",
// authenticate,
// (request, response, next) => {
//   return response.render("cms-newpost");
// });
// 
// router.post("/save-post",
// [
//   authenticate,
//   body("id"),
//   body("title")
//     .exists().withMessage("Missing title.")
//     .not().isEmpty().withMessage("Missing title."),
//   body("author")
//     .exists().withMessage("Missing author.")
//     .not().isEmpty().withMessage("Missing author."),
//   body("alias")
//     .matches(Post.aliasPattern).withMessage("Alias must only contain alphanumerics, dashes, and underscores."),
//   body("body")
//     .exists().withMessage("Missing body.")
//     .not().isEmpty().withMessage("Missing body."),
//   body("tags"),
//   body("published"),
//   ValidateCheck
// ],
// (request, response, next) => {
//
//   const title = request.values.title;
//   const author = request.values.author;
//   const alias = request.values.alias || null;
//   const body = request.values.body;
//   const tags = request.values.tags ? request.values.tags.split(",").map(function(item) {
//     return item.toLowerCase().trim();
//   }) : [];
//   const published = request.values.published ? request.values.published : false;
//   var id = request.values.id ? request.values.id : false;
//
//   var p = Promise.resolve();
//
//   // check if we're creating new post, or updating existing post
//   if (id == false) {
//     p = p.then( result => {
//       return Post.create(title, author, alias, body, tags, published);
//     })
//     .then( post => {
//       id = post.id;
//       return post;
//     });
//   }
//   else {
//     p = p.then( result => {
//       return Post.update(id, title, author, alias, body, tags, published);
//     });
//   }
//
//   return p.then( result => {
//     return response.status(200).json({
//       message: "Saved successfully",
//       id: id
//     });
//   })
//   .catch(error => { next(error); });
// });
//
// router.post("/delete-post",
// [
//   authenticate,
//   body("id")
//     .exists().withMessage("Missing id.")
//     .not().isEmpty().withMessage("Missing id."),
//   ValidateCheck
// ],
// (request, response, next) => {
//
//   const id = request.values.id;
//
//   return Post.deleteById(id)
//     .then(post => {
//       return response.status(200).json({
//         message: "Deleted successfully"
//       });
//     })
//     .catch(error => { next(error); });
// });

module.exports = router;