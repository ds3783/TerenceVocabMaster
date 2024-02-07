import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";

const SQLS = {
    GET_USER_BY_EMAIL: 'SELECT * FROM users WHERE email = ?',
    GET_USER_TOKEN_BY_UID_TYPE: 'SELECT * FROM users_oauth_tokens WHERE user_id = ? AND type = ?',
    UPDATE_TOKEN: 'UPDATE users_oauth_tokens SET token = ? , user_info = ? WHERE id = ?',
    CREATE_TOKEN: 'INSERT INTO users_oauth_tokens(token,user_info,user_id,type) VALUES (?,?,?,?)',
};

const DISCORD = {
    GET_TOKEN: 'https://discord.com/api/v8/oauth2/token',
    GET_USER: 'https://discord.com/api/v8/users/@me',
    INVITE_TO_SERVER: 'https://discord.com/api/v8/guilds/${guild.id}/members/${user.id}',
};

const LOG_PREFIX = '[OAUTH_LOGIN] ';

export async function discordLogin(code) {
    let discordToken = await NestiaWeb.ajax.request({
        url: DISCORD.GET_TOKEN,
        method: 'POST',
        data: {
            'client_id': NestiaWeb.manifest.get('user.oauth.discord.client_id'),
            'client_secret': NestiaWeb.manifest.get('user.oauth.discord.client_secret'),
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': NestiaWeb.manifest.get('user.oauth.discord.oauth_url'),
        },
        reqContentType: 'form',
        resContentType: 'json'
    });
    /*
    * token should be like
    * {
      "access_token": "6qrZcUqja7812RVdnEKjpzOL4CvHBFG",
      "token_type": "Bearer",
      "expires_in": 604800,
      "refresh_token": "D43f5y0ahjqew82jZ4NViEr2YafMKhue",
      "scope": "identify"
    } */
    discordToken = discordToken.data;

    NestiaWeb.logger.info(LOG_PREFIX, 'got Token for code', discordToken, code);

    let userInfo = await NestiaWeb.ajax.request({
        url: DISCORD.GET_USER,
        method: 'GET',
        headers: {
            'Authorization': discordToken.token_type + ' ' + discordToken.access_token,
        },
        resContentType: 'json'
    });
    userInfo = userInfo.data;
    NestiaWeb.logger.info(LOG_PREFIX, 'got User for code', userInfo, code);
    /*
    * userInfo should be like
    * {
  id: '854968055078453308',
  username: '开飞机的贝塔',
  avatar: '90badfb64590ed16f05c7f3e8c76eb68',
  discriminator: '5343',
  public_flags: 0,
  flags: 0,
  banner: null,
  banner_color: null,
  accent_color: null,
  locale: 'zh-CN',
  mfa_enabled: false,
  email: 'ds3783@163.com',
  verified: true
}*/

    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let users;
    try {
        conn = await DataBase.borrow(dbName);
        //update db mail send time and send times and token

        users = await DataBase.doQuery(conn, SQLS.GET_USER_BY_EMAIL, [
            userInfo.email
        ]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    if (!users.length) {
        throw new Error(`Email ${userInfo.email} has not been registered yet!`);
    }

    let user = users[0];

    try {
        conn = await DataBase.borrow(dbName);
        //update db mail send time and send times and token

        let tokens = await DataBase.doQuery(conn, SQLS.GET_USER_TOKEN_BY_UID_TYPE, [
            user.id,
            'discord'
        ]);

        let token;
        if (tokens.length) {
            token = tokens[0];
        } else {
            token = {
                user_id: user.id,
                type: 'discord'
            };
        }
        token.token = JSON.stringify(discordToken);
        token.user_info = JSON.stringify(userInfo);
        if (token.id) {
            await DataBase.doQuery(conn, SQLS.UPDATE_TOKEN, [
                token.token,
                token.user_info,
                token.id,
            ]);
        } else {
            await DataBase.doQuery(conn, SQLS.CREATE_TOKEN, [
                token.token,
                token.user_info,
                token.user_id,
                'discord'
            ]);
        }

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

    NestiaWeb.logger.info(LOG_PREFIX, 'invite user to server', discordToken);
    let inviteUrl = DISCORD.INVITE_TO_SERVER.replace(/\${guild.id}/g, NestiaWeb.manifest.get('user.oauth.discord.server_id'));
    inviteUrl = inviteUrl.replace(/\${user.id}/g, userInfo.id);
    try {
        let guildJoin = await NestiaWeb.ajax.request({
            url: inviteUrl,
            method: 'PUT',
            headers: {
                'Authorization': 'Bot ' + NestiaWeb.manifest.get('user.oauth.discord.bot_token'),
            },
            resContentType: 'text',
            reqContentType: 'json',
            data: {
                access_token: discordToken.access_token
            }
        });

        switch (guildJoin.status) {
            case 201:
                NestiaWeb.logger.info(LOG_PREFIX, 'invitation result: SUCCESS!');
                break;
            case 204:
                NestiaWeb.logger.info(LOG_PREFIX, 'invitation result: user already in server');
                break;
            default:
                NestiaWeb.logger.info(LOG_PREFIX, 'invitation result: Unknown', guildJoin);
                break;
        }

    } catch (e) {
        NestiaWeb.logger.info(LOG_PREFIX, 'Error when invite user to discord server:', e);
    }

    return user;
}
