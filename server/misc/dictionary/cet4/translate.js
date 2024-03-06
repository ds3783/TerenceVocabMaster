// create write stream for dictionary cet-4
const fs = require('fs');
const path = require('path');
const destFile = path.join(__dirname, 'cet4.sql');
const writeStream = fs.createWriteStream(destFile, {flags: 'w'});


//iterate current directory for json files
const uuid = require('uuid');
const {v4: uuidv4} = uuid;
fs.readdir(__dirname, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    // Iterate through the files
    files.forEach((file) => {
        if (!/\.json$/.test(file)) {
            return;
        }
        // Get the full path of the file
        const filePath = file;
        const plainData = fs.readFileSync(filePath);
        const JSONData = JSON.parse(plainData.toString('utf8'));
        for (const word of JSONData) {
            let sql = `INSERT INTO vocabulary (id, category, word, phonetic, meaning) VALUES ('${uuidv4()}','CET-4', '${word.word.trim().replace(/'/,'\'\'')}', '${word.phonetic_symbol.replace(/'/,'\'\'')}', '${word.mean}');\n`;
            writeStream.write(sql);
        }
    });

    writeStream.end(()=>{
        writeStream.close();
    })
});
