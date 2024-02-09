const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os');


// Get the home directory
const homeDirectory = os.homedir();
const keyPath = '~/keys/filelocker.key';


// Load the public key from a file or use the generated private key
let key = fs.readFileSync(path.resolve(keyPath.replace(/~/, homeDirectory)));
// key=Buffer.from(key,'hex');

// Load the encrypted data from the file
const encryptedData = fs.readFileSync('local.encrypted', 'binary');

// Create a decipher object
const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));

// Use the private key for decryption
// Update and finalize the decipher
let decryptedData = decipher.update(encryptedData, 'binary', 'utf8');
decryptedData += decipher.final('utf8');

// Display the decrypted data
fs.writeFileSync('local.decrypted.js', decryptedData);
const manifest = require("./local.decrypted.js");
module.exports = manifest;
