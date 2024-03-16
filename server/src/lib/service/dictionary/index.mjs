import NestiaWeb from "nestia-web";
import * as claude from "../../ai/claude.mjs";


const CACHE_CATEGORY = 'DICTIONARY_EN2ZH';
const PROMPT_TEST_VALID = 'Is following phrase valid English, answer use only YES or NO. Phrase: ${word}';
const PROMPT_EN2ZH_DICT = 'Assume you are an English-Chinese dictionary,give the English phonetic symbols for following phrase, and explain it in Simplified Chinese, and give an example in English.\\nUse format \\"Pronunciation: [...] Translation: ... Explanation: ...  Example: ...\\"\\nPhrase: ${word}';

export async function getDictionaryForEng2Chi(text) {
    let result = await claude.getCache(CACHE_CATEGORY, text);

    function formatResult(result) {
        NestiaWeb.logger.info('format AI response', result);
        let resultArr = result.split('\n');
        let pronunciation = '', translation = [], explanation = [], example = [];
        let state = '';
        for (const line of resultArr) {
            if (line.startsWith('Pronunciation:')) {
                pronunciation = line.replace('Pronunciation:', '').trim();
                state = 'Pronunciation';
            } else if (line.startsWith('Translation:')) {
                translation.push(line.replace('Translation:', '').trim());
                state = 'Translation';
            } else if (line.startsWith('Explanation:')) {
                explanation.push(line.replace('Explanation:', '').trim());
                state = 'Explanation';
            } else if (line.startsWith('Example:')) {
                example.push(line.replace('Example:', '').trim());
                state = 'Example';
            } else {
                if (line) {
                    switch (state) {
                        case 'Pronunciation':
                            pronunciation += line;
                            break;
                        case 'Translation':
                            translation.push(line.trim());
                            break;
                        case 'Explanation':
                            explanation.push(line.trim());
                            break;
                        case 'Example':
                            example.push(line.trim());
                            break;
                    }

                }
            }
        }
        let resultObj = {
            pronunciation: pronunciation.trim(),
            translation: translation.join('\n').trim(),
            explanation: explanation.join('\n').trim(),
            example: example.join('\n').trim()
        };
        NestiaWeb.logger.info('format result', resultObj);
        return resultObj;
    }

    if (result) {
        NestiaWeb.logger.info('get result from cache', text, result);
        return formatResult(result);
    } else {
        NestiaWeb.logger.info('begin check valid', text);
        let valid = await claude.request(PROMPT_TEST_VALID.replaceAll('${word}', text));
        NestiaWeb.logger.info('check valid result', text, valid);
        valid = /YES/i.test(valid);
        if (!valid) {
            return null;
        }
        let result = await claude.request(PROMPT_EN2ZH_DICT.replaceAll('${word}', text), {
            category: CACHE_CATEGORY,
            key: text
        });
        NestiaWeb.logger.info('get explanation from ai:', text, valid);
        return formatResult(result);
    }

}
