import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import _3Party from "../3party/index.mjs";


const SQLS = {
    GET_USER_OAUTH: 'SELECT * FROM users_oauth_tokens where user_id = ? AND `type` = ? ',
};

export async function sendInstantMessage(userId, content, platform) {
    if (!_3Party.Discord.getInitializeState()){
        return;
    }
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let oauth = null;
    try {
        conn = await DataBase.borrow(dbName);

        //update db mail send time and send times and token
        oauth = await DataBase.doQuery(conn, SQLS.GET_USER_OAUTH, [
            userId, platform.toLowerCase()
        ]);
        oauth = oauth[0];
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

    if (!oauth) {
        throw new Error('Invalid user:' + userId);
    }


    let userInfo = JSON.parse(oauth.user_info);
    let userObj = await _3Party.Discord.getUserById(userInfo);
    await _3Party.Discord.sendMessage(userObj, content);
}