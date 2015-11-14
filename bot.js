var bot = require('nodemw'),
	async = require('async'),
	fs = require('fs');

//////////////////
// Vars
var client = new bot('config.json');
var file = 'pagelist.txt';

//////////////////
// Main
client.logIn(function(err) {
    if (err) {
        console.log(err);
        return;
    }

    readFileAndCheckCategories();
});

//////////////////
// Functions
/**
 * Open a file and check the pages inside it
 */
function readFileAndCheckCategories() {
    var arrayTitles = fs.readFileSync(file).toString().split("\r\n");
    synchedCC(arrayTitles, 0);
}

function synchedCC(array, id) {
    if(array[id] == null)
        return;

    // DEBUG
    console.log(array[id]);

    checkCategories(array[id], function() {
        synchedCC(array, id+1);
    });
}

/**
 * Check and correct double categories
 * @param title the title of the page ot edit
 * @param nextTitle
 */
function checkCategories(title, nextTitle) {
    var categoriesToRemove = [];

	client.getArticleCategories(title, function (err, categories) {
		if (err) {
			console.error(err);
			return;
		}

		async.forEach(categories, function(cat, callback) {
			getParentCategories(cat, 3, function(parentCategories){
				categories.forEach(function(c) { // Can't be async, to avoid edit conflicts
					var i = parentCategories.indexOf(c);
					if(i > -1) {
                        console.log("|- " + cat + " ∈ " + parentCategories[i]);
                        categoriesToRemove.push(parentCategories[i]);
                    }
				});
                callback();
			});
		}, function(err) {
            // Remove categories
            if(categoriesToRemove.length > 0)
                removeCategoriesFromArticle(title, categoriesToRemove);

            nextTitle();
        });
	});
}
/**
 * Remove the categories from article
 * @param article String: the article to edit
 * @param categories String[]: the categories
 */
function removeCategoriesFromArticle(article, categories)
{
    client.getArticle(article, function(err, content) {
        if (err) {
            console.error(err);
            return;
        }

        // Remove the categories
        async.forEach(categories, function(c, callback2) {
            var regex = new RegExp("\\[\\["+c+"(\\|.*)?\\]\\]\\s*","ig");
            content = content.replace(regex, "");
            callback2();
        }, function(err) {
            editPage(article, content);
        });
    });
}

/**
 * Edit a page and replace the content with the new content
 * @param page String: the page to edit
 * @param newcontent String: the new content
 */
function editPage(page, newcontent) {
    // Edit the Article
    var summary = "Application de [[WP:CC]] (double catégorisation)";
    client.edit(page, newcontent, summary, function(err, data) {
        if (err) {
            console.error(err);
            return;
        }
        console.log("|--> " + page + " edited !");
    });
}

/**
 * Get the parent categories of a specific page
 * @param page String: the initial page analysed
 * @param i int: number of super-categories to include
 * @param callback
 */
function getParentCategories(page, i, callback)
{
	if(i == 0) {
		client.getArticleCategories(page, function (err, categories) {
			if (err) {
				console.error(err);
				return;
			}
			callback(categories);
		});
	}
	else {
		client.getArticleCategories(page, function (err, categories) {
			if (err) {
				console.error(err);
				return;
			}

			var parentCategories = categories,
				superCategories = parentCategories;

			// Get super categories
			async.forEach(parentCategories, function(cat, callback2) {
				getParentCategories(cat, i-1, function(categories) {
					superCategories = superCategories.concat(categories);
					callback2();
				});
			}, function(err) {
				callback(superCategories);
			});
		});
	}
}
