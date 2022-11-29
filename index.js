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
if (batchAll.length < batchIndexFirst){
  console.error(' Seems all URLs passed. Current Index is bigger, than sizeof batchAll. Setup 0 in Index.txt file ');
  return;
}
// set last url index in current pack to send (limitation per operation is 100, per day 24h? 200)
var batchIndexLast = batchIndexFirst + 100;
// save last url index in file, that will be first index in next pack
fs.writeFileSync('Index.txt', batchIndexLast.toString());
// set batch variable with selected indexes
var batch = batchAll.slice(batchIndexFirst, batchIndexLast);

// sum of sent urls
var resultCounter = 0;

jwtClient.authorize(function(err, tokens) {
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
    console.log(body);
    resultCounter++;
  });
});
// End report
console.info('Task Done. URLs sent: ',resultCounter);
