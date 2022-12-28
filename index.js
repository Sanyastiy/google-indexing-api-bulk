// Legacy block
const fs = require('fs');
let request = require('request');
let { google } = require('googleapis');
let key = require('./service_account.json');

const jwtClient = new google.auth.JWT(
  key.client_email,
  null,
  key.private_key,
  ['https://www.googleapis.com/auth/indexing'],
  null
);
// END of Legacy block


// Control panel

// Enable Debug console outputs for manual debug purposes
const myDebugging = false;
// amount of URLs per batch (limitation per operation is 100 per batch, 200 per day or 24h)
const howMuchUrls = 100;

// END of Control panel


// collect all urls
const batchAll = fs
  .readFileSync('urls.txt')
  .toString()
  .split('\n');
// set first url index in current pack to send
let batchIndexFirst = parseInt(fs.readFileSync('Index.txt'));
// catcher for end of mission
if (batchAll.length < batchIndexFirst) {
  console.error(' Seems all URLs passed. Current Index is bigger, than sizeof batchAll. Setup 0 in Index.txt file ');
  return;
}

// set last url index in current pack to send 
let batchIndexLast = batchIndexFirst + howMuchUrls;
// save last url index in file, that will be first index in next pack
fs.writeFileSync('Index.txt', batchIndexLast.toString());
// set batch variable with selected indexes
let batch = batchAll.slice(batchIndexFirst, batchIndexLast);
// sum of sent urls
let resultCounter = 0;


jwtClient.authorize(function (err, tokens) {
  if (err) {
    // Future new errors cathcer mechanism will be here
    console.log(err);
    return;
  }

  // Legacy block
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
  // END of Legacy block

  request(options, (err, resp, body) => {
    // without developing current state of index.txt is 300
    myDebugging?console.log(body):"";
    
    let displayArray = ['Status', 'Url or message'];

    function myExtractJSON(str) {
      // making string in one line without breaks
      str = str.replace(/(\r\n|\n|\r)/gm, "");

      // determination of variables
      let lastOpen, firstClose = 0, candidate, buffer;

      // enter the loop while we have Closing Brackets inside of the string
      while (firstClose !== -1) {
        myDebugging?console.log('str: '+str):"";

        // set position of first Closing Bracket
        firstClose = str.indexOf('}');
        myDebugging?console.log('firstClose index: '+firstClose):"";
        
        // set buffer as str from beginning to first Close Bracket (+1 means including Closing Bracket )
        buffer = str.substring(0, firstClose + 1);

        myDebugging?console.log('around firstClose: '+ str.substring(firstClose-20, firstClose + 20)):"";
        myDebugging?console.log('buffer: '+buffer):"";

        // if only Closing Bracket (with spaces) inside of the buffer then
        if (buffer == '}') {
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

        myDebugging?console.log('candidate: ' + candidate):"";

        // check for JSON validity
        try {
          console.log((JSON.parse(candidate) ? myDebugging?'JSON candidate valid':"" : 'How did you get here'));
        } catch (error) {
          myDebugging?console.error('JSON candidate not parsable'):"";
        }

        // cut checked part of the string
        str = str.substring(firstClose, str.length);

        // prepare JSON variable
        let candidateJSON;

        // check if now JSON parsable
        try {
          candidateJSON = JSON.parse(candidate);
        } catch (error) {
          // if not parsable, message, then next loop
          myDebugging?console.log('JSON candidate still not parsable'):"";
          // go to next loop
          continue;
        }

        // check response type
        if (candidateJSON.type == 'URL_UPDATED') {

          displayArray.push([JSON.stringify(candidateJSON.type), JSON.stringify(candidateJSON.url)])
          myDebugging?console.log('candidateJSON: ' + candidateJSON):"";
          
        } else if (candidateJSON.status == 'PERMISSION_DENIED') {
          // here was tested error if in GSC service account is not Owner

          displayArray.push([JSON.stringify(candidateJSON.status), JSON.stringify(candidateJSON.message)])
          myDebugging?console.log('candidateJSON: ' + candidateJSON):"";

        } else if (candidateJSON.quota_limit_value == '200') {

          // here was tested error if quota limit exceeded
          displayArray.push(['RATE_LIMIT_EXCEEDED', 'quota_limit_value:' + JSON.stringify(candidateJSON.quota_limit_value)])
          myDebugging?console.log('candidateJSON: ' + candidateJSON):"";

          // if we see quota exceed, roll back count of this batch, and quit the circle
          fs.writeFileSync('Index.txt', (batchIndexLast - howMuchUrls).toString());
          break;
        }

        ++resultCounter;
      }
    }

    // End report
    myExtractJSON(body);
    console.log(displayArray);
    console.info('Task Done. URLs sent: ', resultCounter);
  });
});