import NestiaWeb from 'nestia-web';
import fs from 'fs';


let FE_MAPPING_FILE = 'views/version-mapping.json';

let FE_FILE_MAPPING = {
    mapping: {},
    mtime: 0,
    feRoot: '',
};

function getFeMapping() {
    if (!fs.existsSync(FE_MAPPING_FILE)) {
        NestiaWeb.logger.info('FE mapping file missing, skip load.');
        return;
    }
    let fstat = fs.statSync(FE_MAPPING_FILE);

    let feRoot;
    try {
        feRoot = NestiaWeb.manifest.get('feRoot', true);
    } catch (e) {
        feRoot = '';
    }
    if (fstat.mtime.getTime() !== FE_MAPPING_FILE.mtime || feRoot !== FE_FILE_MAPPING.feRoot) {
        NestiaWeb.logger.info('FE mapping file or feRoot changed.');
        let content = fs.readFileSync(FE_MAPPING_FILE);
        let jsonObj = JSON.parse(content);
        for (let page in jsonObj) {
            if (!jsonObj.hasOwnProperty(page)) {
                continue;
            }
            let pageConfig = jsonObj[page];
            if (pageConfig['css']) {
                pageConfig['css'] = feRoot + '/' + pageConfig['css'];
            }
            if (pageConfig['js']) {
                pageConfig['js'] = feRoot + '/' + pageConfig['js'];
            }
        }
        FE_FILE_MAPPING.mapping = jsonObj;
        FE_FILE_MAPPING.mtime = fstat.mtime.getTime();
        FE_FILE_MAPPING.feRoot = feRoot;
        NestiaWeb.logger.info('FE mapping file reloaded.')
    }
}


fs.watchFile(FE_MAPPING_FILE, (curr, prev) => {
    getFeMapping();
});

//all context is built here
function buildRenderContext() {
    getFeMapping();

    return {
        get FE_FILE_MAPPING() {
            return FE_FILE_MAPPING.mapping;
        }
    };
}

export default {
    buildRenderContext
};
