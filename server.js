var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");
// Initializing Express
var app = express();
// Configuring middleware
app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
var exphbs = require("express-handlebars");
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");
app.use(express.static("public"));
// Requiring models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");
// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
var PORT = process.env.PORT || 3000;
mongoose.connect("mongodb://heroku_h6vxfn7x:5ll786aqmg65bhgs4t02pckp01@ds135486.mlab.com:35486/heroku_h6vxfn7x");
//mongoose.connect("mongodb://localhost/mongodbscraper");
var db = mongoose.connection;

// Routes
app.get("/", function(req, res) {
  res.render("index");
});
// Scraping the site 
app.post("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("http://www.nytimes.com/", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    //Holding scraped articles in temp array
    var scrapedArticles = {};
    // Now, we grab every h2 within an article tag, and do the following:
    $("article h2").each(function(i, element) {
      // Saving an empty result object
      var result = {};
      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).children("a").text();
      console.log("result title " + result.title);
      result.link = $(this).children("a").attr("href");
      scrapedArticles[i] = result;
    });
    console.log("Scraped " + scrapedArticles);
    var hbsArticleObject = {
        articles: scrapedArticles
    };
    res.render("index", hbsArticleObject);
  });
});
// Saving saved articlse to db
app.get("/savedarticles", function(req, res) {
var query = Article.find({}).limit(10);
  query.exec(function(error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      var hbsArticleObject = {
        articles: doc
      };
      res.render("savedarticles", hbsArticleObject);
    }
  });
});

app.post("/save", function(req, res) {
  console.log("Title: " + req.body.title);
  var newArticleObject = {};
  newArticleObject.title = req.body.title;
  newArticleObject.link = req.body.link;
  var entry = new Article(newArticleObject);
  // Saving to db
  entry.save(function(err, doc) {
    if (err) {
      console.log(err);
    }
    else {
      console.log(doc);
    }
  });
  res.redirect("/savedarticles");
});
//Deleting saved articles 
app.get("/delete/:id", function(req, res) {
  console.log("delete id" + req.params.id);
  Article.findOneAndRemove({"_id": req.params.id}, function (err, offer) {
    if (err) {
      console.log("No delete:" + err);
    }
    res.redirect("/savedarticles");
  });
});

// Creating and saving notes 
app.post("/articles/:id", function(req, res) {
  var newNote = new Note(req.body);
  newNote.save(function(error, doc) {
    if (error) {
      console.log(error);
    } 
    else {
      // Inserting note
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: {notes: doc._id}}, {new: true, upsert: true})
      .populate('notes')
      .exec(function (err, doc) {
        if (err) {
          console.log("error");
        } else {
          res.send(doc);
        }
      });
    }
  });
});
//Deleting notes by id
app.get("/notes/:id", function(req, res) {
  console.log("will delete " + req.params.id);
  Note.findOneAndRemove({"_id": req.params.id}, function (err, doc) {
    if (err) {
      console.log("No delete:" + err);
    } 
    res.send(doc);
  });
});

app.get("/articles/:id", function(req, res) {
  console.log("id read" + req.params.id);
  // Matching id from params 
  Article.findOne({"_id": req.params.id})
  .populate('notes')
  .exec(function(err, doc) {
    if (err) {
      console.log("No match");
    }
    else {
      res.json(doc);
    }
  });
});
// Listen on port 3000
app.listen(PORT, function() {
  console.log("App running on PORT " + PORT);
});