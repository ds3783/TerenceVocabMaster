const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os');

// Get the home directory
const homeDirectory = os.homedir();
const keyPath = '~/keys/filelocker.key';

// Load the public key from a file or use the generated private key
let key = fs.readFileSync(path.resolve(keyPath.replace(/~/, homeDirectory)));

//iterate current directory
fs.readdir('.', (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    // Iterate through the files
    files.forEach((file) => {
        if (!/\.plain\./.test(file)) {
            return;
        }
        // Get the full path of the file
        const filePath = file;

        // Check if it's a file or a directory
        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.error('Error getting file stats:', err);
                return;
            }

            if (!stats.isDirectory()) {
                const plainData = fs.readFileSync(filePath);
                const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.alloc(16, 0));
                let encrypted = cipher.update(plainData, 'utf-8', 'binary');
                encrypted += cipher.final('binary');
                let newFileName = file.replace(/\.plain\.js/g, '.encrypted');
                fs.writeFileSync(newFileName, encrypted,'binary');
                console.log(newFileName+' written!');
            }
        });
    });
});
