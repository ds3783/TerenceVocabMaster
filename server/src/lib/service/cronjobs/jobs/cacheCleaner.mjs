import NestiaWeb from "nestia-web";
import path from "path";
import fs from "fs";

const LOG_PREFIX = '[CACHE_CLEANER] ';
export default [
    {
        name:'Cache Cleaner',
        cron: '0 * * * *',
        work: function () {
            NestiaWeb.logger.info(LOG_PREFIX + 'Check cache files.');
            let cacheDir = NestiaWeb.manifest.get('cacheDir');
            let cachePath = path.join(process.cwd(), cacheDir);

            function checkAndUnlink(root) {
                let files = fs.readdirSync(root);
                let expires = Date.now() - 60 * 60 * 1000;
                for (const file of files) {
                    let filePath = path.join(root, file);
                    let fStat = fs.lstatSync(filePath);
                    if (fStat.isDirectory()) {
                        NestiaWeb.logger.info(LOG_PREFIX + 'Check dir:' + file);
                        checkAndUnlink(path.join(root, file));
                    } else {
                        if (fStat.mtimeMs < expires * 2) {
                            NestiaWeb.logger.info(LOG_PREFIX + 'Remove expired cache file:' + file);
                            fs.unlinkSync(filePath);
                        } else if (fStat.atimeMs && fStat.atimeMs < expires) {
                            NestiaWeb.logger.info(LOG_PREFIX + 'Remove expired cache file:' + file);
                            fs.unlinkSync(filePath);
                        }
                    }


                }
            }

            if(fs.existsSync(cachePath)){
                checkAndUnlink(cachePath);
            }

        }
    }
]