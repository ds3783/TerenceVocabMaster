import NestiaWeb from 'nestia-web';
import express from 'express';
import {generateNewInvitations, getInvitations, getUsers, setUserRoles} from "../../../lib/service/user/admin.mjs";
import {roles, systemRoles} from "../../../lib/data/user/rolePathPermissions.mjs";
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

const router = express.Router();


router.get('/listRoles', async function (req, res) {
    let defaultRoles = Array.from(roles);

    let result = defaultRoles.filter((role) => {
        return !systemRoles.includes(role);
    });
    res.send({
        roles: result,
        internalRoles: systemRoles,
    });
});

router.post('/setUserRoles', async function (req, res) {
    let uid = req.body.id;
    let roles = req.body.roles;

    try {
        await setUserRoles(uid, roles, req);
    } catch (e) {
        NestiaWeb.logger.fatal(`Error update user roles ${JSON.stringify({user: uid, roles: roles})}`, e);
        res.status(400).send('Something wrong happened, please contact administrator.');
        return;
    }
    res.send({
        result: true
    });
});

router.post('/generateInvitations', async function (req, res) {
    let type = req.body.type;
    let amount = req.body.amount;
    let emailList = req.body.email_list;
    let roles = req.body.roles;

    let newInvitations = [];
    try {
        newInvitations = await generateNewInvitations(type, amount, emailList, roles);
    } catch (e) {
        NestiaWeb.logger.fatal(`Error generate new tokens ${JSON.stringify({
            type: type,
            amount: amount,
            emailList: emailList
        })}`, e);
        res.status(400).send('Something wrong happened, please contact administrator.');
        return;
    }
    res.set('Content-Type', 'text/plain;charset=utf-8');
    res.send(newInvitations.join('\n'));
});


router.get('/userList', async function (req, res) {
    try {
        let conditions = [];
        if (req.query.name) {
            conditions.push({
                column: 'name',
                operator: '=',
                value: req.query.name
            });
        }
        if (req.query.email) {
            conditions.push({
                column: 'email',
                operator: '=',
                value: req.query.email
            });
        }
        if (req.query.id) {
            conditions.push({
                column: 'id',
                operator: '=',
                value: req.query.id * 1
            });
        }
        if (!conditions.length) {
            conditions = null;
        }

        let result = await getUsers(conditions, req.query.offset, req.query.limit, req.query.sort, req.query.order);
        res.set('X-Total-Count', '' + (result.count || 0));
        res.send(result.data);
    } catch (e) {
        NestiaWeb.logger.error(e);
        res.status(500).send(e.message || 'Unknown error');
    }
});

router.get('/invitationList', async function (req, res) {
    try {
        let conditions = [];
        if (req.query.code) {
            conditions.push({
                column: 'code',
                operator: '=',
                value: req.query.code
            });
        }
        if (req.query.email) {
            conditions.push({
                column: 'email',
                operator: '=',
                value: req.query.email
            });
        }
        if (req.query.min_date) {
            conditions.push({
                column: 'create_time',
                operator: '>=',
                value: dayjs(req.query.min_date, 'DD/MM/YYYY')
            });
        }
        if (req.query.max_date) {
            conditions.push({
                column: 'create_time',
                operator: '>=',
                value: dayjs(req.query.max_date, 'DD/MM/YYYY')
            });
        }
        if (!conditions.length) {
            conditions = null;
        }

        let result = await getInvitations(conditions, req.query.offset, req.query.limit, req.query.sort, req.query.order);
        res.set('X-Total-Count', '' + (result.count || 0));
        res.send(result.data);
    } catch (e) {
        NestiaWeb.logger.error(e);
        res.status(500).send(e.message || 'Unknown error');
    }
});


export default router;
