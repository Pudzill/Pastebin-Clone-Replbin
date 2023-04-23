// Variables 
const serverSecretKey = process.env['secret']; // pastes encryption key here. if your not the pudzilla, replace me!!
const moderatorPassword = process.env['moderator']; // moderation account password here. if your not the pudzilla, replace me!!
const origin = 'https://replbin-pastebin-clone.pudzilla.repl.co'; // replace with the url of your site. if your not on this site, replace me!!

// Require the cool stuff
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const crypto = require('crypto-js');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const BadWordsFilter = require('bad-words');
const { check, validationResult } = require('express-validator');
const filter = new BadWordsFilter();
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(__dirname));

// restrict to main server
function checkRequestOrigin(req, res, next) {
  const allowedOrigin = origin;
  const requestOrigin = req.headers.origin;

  if (requestOrigin === allowedOrigin) { // check if request origin matches allowed origin
    next();
  } else {
    const idReplCoPattern = /\.id\.repl\.co$/; // use a regular expression to test if request origin ends with '.id.repl.co'
    if (idReplCoPattern.test(requestOrigin)) {
      next();
    } else {
      res.status(403).send('Access denied. You are not authorized to use this endpoint.');
    }
  }
}

// rate limiting
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutesy
  max: 10,
  message: 'Too many requests, please try again later.'
});

app.use('/create', apiLimiter);

// function to remove expired pastes
function removeExpiredPastes() {
  const pastes = require('./pastes.json');
  const now = new Date().getTime();
  let updated = false;

  for (const key in pastes) { // loop around and delete
    if (pastes[key].expiry && pastes[key].expiry <= now) {
      delete pastes[key];
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync('./pastes.json', JSON.stringify(pastes));
  }
}

// main
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// view pastes
app.get('/view/:id', (req, res) => {
  res.sendFile(__dirname + '/view.html');
});

// check for bad words
async function isContentInappropriate(text) {
  try {
    // check for bad words using purgomalum api
    const badWordsResponse = await axios.get('https://www.purgomalum.com/service/containsprofanity', {
      params: {
        text: text,
      },
    });

    if (badWordsResponse.data === true) {
      console.log("API")
      return true;
    }

    // check for bad words using bad-words library
    if (filter.isProfane(text)) {
      console.log("Library")
      return true;
    }

    // more checks go here

    return false;
  } catch (error) {
    console.error('Error checking for inappropriate content:', error);
    return false;
  }
}

// create a paste
app.post('/create', checkRequestOrigin, [
  check('content').trim().escape(),
  check('encryptionKey').optional().trim().escape(),
  check('expiry').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  removeExpiredPastes(); // remove expired pastes everytime this is run
  const pastes = require('./pastes.json'); // get json
  const pasteId = new Date().getTime(); // get current time as paste ID
  let content = req.body.content; // get paste content from request body
  const encryptionKey = req.body.encryptionKey || null; // get encryption key from request body, if exists
  const expiry = req.body.expiry || null; // get paste expiry date from request body, if exists
  const isInappropriate = await isContentInappropriate(content);

  if (isInappropriate) {
    res.status(400).send('Your paste contains inappropriate language and cannot be created.');
  } else {
    content = crypto.AES.encrypt(content, serverSecretKey).toString(); // encrypt paste content with server secret key
    
    if (encryptionKey) { // if encryption key exists
      const encryptedEncryptionKey = crypto.AES.encrypt(encryptionKey, serverSecretKey).toString(); // encrypt encryption key with server secret key
      pastes[pasteId] = { // create new paste object with encrypted content, encryption key and expiry date
        content: content,
        encryptionKey: encryptedEncryptionKey,
        expiry: expiry
      };
    } else { // if encryption key doesn't exist
      pastes[pasteId] = { // create new paste object with encrypted content and expiry date only
        content: content,
        expiry: expiry
      };
    }
  
    fs.writeFileSync('./pastes.json', JSON.stringify(pastes)); // write updated paste data to json file
    res.json({ id: pasteId }); // respond with new paste ID as JSON
  }
});

// moderator page send
app.get('/moderator', (req, res) => {
  res.sendFile(__dirname + '/moderator.html');
});

// login moderator call
app.post('/moderator/login', [
  check('password').trim().escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (req.body.password === moderatorPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

// get all pastes if password matches. moderator api function thingie
app.get('/pastes', (req, res) => {
  if (req.query.password === moderatorPassword) { // if password in query matches moderator password
    const pastes = require('./pastes.json'); // get all pastes from json
    res.json(pastes); // respond with all pastes as JSON
  } else { // if password doesn't match
    res.status(401).json({ success: false, error: 'Incorrect password' }); // respond with 401 unauthorized status and error message as JSON
  }
});

// delete a paste by ID if password matches. moderator api function thingie
app.delete('/paste/:id', [
  check('password').trim().escape(),
  check('reason').optional().trim().escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (req.body.password === moderatorPassword) { // if password in request body matches moderator password
    const pastes = require('./pastes.json'); // get all pastes from json
    const pasteId = req.params.id; // get paste ID from request params
    const deletionReason = req.body.reason; // get deletion reason from request body

    if (pastes[pasteId]) { // if paste with given ID exists
      pastes[pasteId] = { // mark paste as deleted with reason
        deleted: true,
        deletionReason
      };
      fs.writeFileSync('./pastes.json', JSON.stringify(pastes)); // write updated paste data to json file
      res.json({ success: true }); // respond with success message as JSON
    } else { // if paste with given ID doesn't exist
      res.status(404).json({ success: false, error: 'Paste not found' }); // respond with 404 not found status and error message as JSON
    }
  } else { // if password doesn't match
    res.status(401).json({ success: false, error: 'Incorrect password' }); // respond with 401 unauthorized status and error message as JSON
  }
});

// raw view for pastes
app.get('/view/:id/raw', async (req, res) => {
  const pastes = require('./pastes.json'); // get all pastes from json
  const pasteId = req.params.id; // get paste ID from request params

  if (pastes[pasteId]) { // if paste with given ID exists
    if (pastes[pasteId].deleted || pastes[pasteId].expiryDate) { // if paste has been marked as deleted or expired
      res.status(410).send('Paste deleted. Reason: ' + pastes[pasteId].deletionReason);
    } else {
      let decryptedContent = crypto.AES.decrypt(pastes[pasteId].content, serverSecretKey).toString(crypto.enc.Utf8); // decrypt content with the serversecretkey

      if (pastes[pasteId].encryptionKey) { // if paste has encryption key
        const userKey = req.query.encryptionKey || ''; // get encryption key from query params, or use empty string if not provided
        
        const decryptedEncryptionKey = crypto.AES.decrypt(pastes[pasteId].encryptionKey, serverSecretKey).toString(crypto.enc.Utf8); // decrypt the encryptionKey with the serversecretkey

        if (decryptedEncryptionKey === userKey) { // if the decrypted encryption key matches the user-provided key
          const encryptedContent = crypto.AES.encrypt(decryptedContent, decryptedEncryptionKey); // re-encrypt the content with the user-provided key
          decryptedContent = crypto.AES.decrypt(encryptedContent, decryptedEncryptionKey).toString(crypto.enc.Utf8); // decrypt the re-encrypted content with the user-provided key
        } else {
          return res.status(403).send('Incorrect encryption key provided'); // if the user-provided key doesn't match, return a 403 Forbidden status
        }
      }

      if (decryptedContent) {  // if decryption was successful
        res.set('Content-Type', 'text/plain'); // set response content type to plain text
        res.send(decryptedContent); // send decrypted content as response
      } else {
        res.status(500).send('Error: Decryption failed.'); // if decryption failed, return a 500 Internal Server Error status
      }
    }
  } else {
    res.status(404).send('Paste not found'); // if paste with given ID doesn't exist, return a 404 Not Found status
  }
});


// get a paste by ID. the main api thingie that makes this site work 
app.get('/paste/:id', (req, res) => {
  removeExpiredPastes(); // remove expired pastes everytime this is run
  const pastes = require('./pastes.json'); // get all pastes from json
  const pasteId = req.params.id; // get paste ID from request params
  let decryptedContent = null; // initialize decrypted content to null
  let decryptedEncryptionKey = null; // initialize decrypted encryption key to null

  if (pastes[pasteId]) { // if paste with given ID exists
    if (pastes[pasteId].deleted || pastes[pasteId].expiryDate) { // if paste has been marked as deleted or expired
      res.status(410).json({ error: 'Paste deleted', reason: pastes[pasteId].deletionReason }); // respond with 410 gone status and deletion reason as JSON
    } else { // if paste is not deleted or expired
      // decrypt content with the serversecretkey
      decryptedContent = crypto.AES.decrypt(pastes[pasteId].content, serverSecretKey).toString(crypto.enc.Utf8);

      if (pastes[pasteId].encryptionKey) { // if paste has encryption key
        // decrypt the encryptionKey with the serversecretkey
        decryptedEncryptionKey = crypto.AES.decrypt(pastes[pasteId].encryptionKey, serverSecretKey).toString(crypto.enc.Utf8);
        decryptedContent = crypto.AES.encrypt(decryptedContent, decryptedEncryptionKey).toString(); // re-encrypt the content with the user-provided key
      }

      res.json({ // respond with decrypted content and encryption key (if exists) as JSON
        content: decryptedContent,
        encryptionKey: decryptedEncryptionKey
      });
    }
  } else { // if paste with given ID doesn't exist
    res.status(404).json({ error: 'Paste not found' }); // respond with 404 not found status and error message as JSON
  }
});


app.listen(3000, () => {
  console.log('Server running on port 3000');
});
