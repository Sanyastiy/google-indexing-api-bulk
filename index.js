
const fs = require('fs');
var request = require('request');
var { google } = require('googleapis');
var key = require('./service_account.json');

const jwtClient = new google.auth.JWT(
  key.client_email,
  null,
  key.private_key,
  ['https://www.googleapis.com/auth/indexing'],
  null
);

// collect all urls
const batchAll = fs
  .readFileSync('urls.txt')
  .toString()
  .split('\n');
// set first url index in current pack to send
var batchIndexFirst = parseInt(fs.readFileSync('Index.txt'));
// catcher for end of mission
if (batchAll.length < batchIndexFirst) {
  console.error(' Seems all URLs passed. Current Index is bigger, than sizeof batchAll. Setup 0 in Index.txt file ');
  return;
}
// amount of URLs per batch (limitation per operation is 100? per batch, 200 per day or 24h)
const howMuchUrls = 3;
// set last url index in current pack to send 
var batchIndexLast = batchIndexFirst + howMuchUrls;
// save last url index in file, that will be first index in next pack
fs.writeFileSync('Index.txt', batchIndexLast.toString());
// set batch variable with selected indexes
var batch = batchAll.slice(batchIndexFirst, batchIndexLast);
// sum of sent urls
var resultCounter = 0;


jwtClient.authorize(function (err, tokens) {
  if (err) {
    console.log(err);
    return;
  }

  const items = batch.map(line => {
    return {
      'Content-Type': 'application/http',
      'Content-ID': '',
      body:
        'POST /v3/urlNotifications:publish HTTP/1.1\n' +
        'Content-Type: application/json\n\n' +
        JSON.stringify({
          url: line,
          type: 'URL_UPDATED'
        })
    };
  });

  const options = {
    url: 'https://indexing.googleapis.com/batch',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/mixed'
    },
    auth: { bearer: tokens.access_token },
    multipart: items
  };

  request(options, (err, resp, body) => {

    ///////////////console.log(body);
    // without developing current state of index.txt is 300

    ++resultCounter;

    // End report
    console.info('Task Done. URLs sent: ', resultCounter);


    // in future need to make it as callback

    function myExtractJSON(str) {
      // making string in one line without breaks
      str = str.replace(/(\r\n|\n|\r)/gm, "");

      // determination of variables
      var lastOpen, firstClose = 0, candidate, buffer;

      // enter the loop while we have Closing Brackets inside of the string
      while (firstClose !== -1) {

        // set position of first Closing Bracket
        firstClose = str.indexOf('}');

        // set buffer as str from beginning to first Close Bracket (+1 means including Closing Bracket )
        buffer = str.substring(0, firstClose + 1);

        // if only Closing Bracket (with spaces) inside of the buffer then
        if (buffer == '}' || buffer == " }" || buffer == "  }") {
          // shift str on 1 symbol ahead
          str = str.substring(1, str.length);
          // catch moment when there will be no more Closing Brackets inside of the string
          firstClose = str.indexOf('}');
          // go to next itteration
          continue;
        }

        // set first Open Bracket
        lastOpen = buffer.lastIndexOf('{');

        // candidate now is only 1 JSON (+1 with Closing Bracket for correct parse )
        candidate = str.substring(lastOpen, firstClose + 1);

        // here must be output of JSON or pass further
        console.log('candidate: ' + candidate);

        // check for JSON validity
        console.log('Success?: ' + (JSON.parse(candidate) ? 'Yezzz' : 'nope('));

        // cut checked part of the string
        str = str.substring(firstClose, str.length);
      }
    }

    myExtractJSON(body);
  });
});
