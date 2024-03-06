const fs = require('fs');
const path = require('path');

//iterate current directory for json files
const uuid = require('uuid');
const {v4: uuidv4} = uuid;

const CATEGORY_MAPPING = {
    '1-初中-顺序.json': 'JUNIOR',
    '2-高中-顺序.json': 'SENIOR',
    '3-CET4-顺序.json': 'CET-4',
    '4-CET6-顺序.json': 'CET-6',
    '5-考研-顺序.json': 'POSTGRADUATE',
    '6-托福-顺序.json': 'TOEFL',
    '7-SAT-顺序.json': 'SAT',
}
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
        const destFileName = CATEGORY_MAPPING[file];
        if (!destFileName) {
            console.log('Invalid file name:', file);
            return;
        }
        console.log('Processing:', file);
        console.log('Dest:', destFileName);
        const destFile = path.join(__dirname, destFileName + '.sql');
        const writeStream = fs.createWriteStream(destFile, {flags: 'w'});

        // Get the full path of the file
        const filePath = file;
        const plainData = fs.readFileSync(filePath);
        const JSONData = JSON.parse(plainData.toString('utf8'));
        for (const word of JSONData) {
            let wordText=word.word.trim().replace(/'/g, '\'\'');
            let meaning= [];
            for (const translation of word.translations) {
                meaning.push(translation.type+'. '+translation.translation);
            }
            meaning = meaning.join('; ').replace(/'/g, '\'\'');
            let sql = `INSERT INTO vocabulary (id, category, word, phonetic, meaning) VALUES ('${uuidv4()}','${destFileName}', '${wordText}', '', '${meaning}');\n`;
            writeStream.write(sql);
        }
        writeStream.end(() => {
            writeStream.close();
        });
    });

    
});
