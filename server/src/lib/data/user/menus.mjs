const fullMenus = [
    {
        title: 'Market',
        icon: 'rocket',
        children: [
            {
                title: 'Quote',
                icon: 'rocket',
                children: [
                    {
                        pid: 3,
                        title: 'Quote Manage',
                        icon: 'UnorderedListOutlined',
                        pathname: '/market/quote/Manage',
                    },
                    {
                        pid: 8,
                        title: 'My Watch List',
                        icon: 'UnorderedListOutlined',
                        pathname: '/market/quote/MyWatchList',
                    },
                ]
            }
        ],
    },
    {
        title: 'Virtual Account',
        icon: 'rocket',
        children: [
            {
                pid: 10,
                title: 'My Accounts',
                icon: 'UnorderedListOutlined',
                pathname: '/virtualAccount/Manage',
            },
            {
                pid: 11,
                title: 'Trade',
                icon: 'UnorderedListOutlined',
                pathname: '/virtualAccount/Trade',
            },
            {
                pid: 12,
                title: 'View',
                icon: 'UnorderedListOutlined',
                pathname: '/virtualAccount/View',
            },
        ],
    },
    {
        title: 'Articles',
        icon: 'rocket',
        children: [
            {
                pid: 5,
                title: 'Article Manage',
                icon: 'UnorderedListOutlined',
                pathname: '/article/Manage',
            },
            {
                pid: 6,
                title: 'Articles',
                icon: 'UnorderedListOutlined',
                pathname: '/article/List',
            },
        ],
    },
    {
        title: 'System',
        icon: 'rocket',
        children: [
            {
                pid: 1,
                title: 'User Management',
                icon: 'UnorderedListOutlined',
                pathname: '/user/List',
            },
            {
                pid: 2,
                title: 'Invitation Management',
                icon: 'UnorderedListOutlined',
                pathname: '/user/Invitations',
            },
        ],
    },
    {
        title: 'Test',
        icon: 'rocket',
        children: [
            {
                pid: 7,
                title: 'Crawler Tester',
                icon: 'UnorderedListOutlined',
                pathname: '/test/CrawlerTest',
            },
            {
                pid: 8,
                title: 'Schedular Tester',
                icon: 'UnorderedListOutlined',
                pathname: '/test/SchedularTest',
            },
            {
                pid: 9,
                title: 'Message Test',
                icon: 'UnorderedListOutlined',
                pathname: '/test/MessageTest',
            },
        ],
    }
];


let filter = (fullMenus, permissions) => {
    let search = (menus, permissionIds) => {
        let rs = [];
        for (let i = 0; i < menus.length; i++) {
            let menu = menus[i];
            if (menu.pid && permissionIds.includes(menu.pid)) {
                rs.push(menu);
            } else if (menu.children) {
                let endpoint = search(menu.children, permissionIds);
                if (endpoint && endpoint.length) {
                    let clonedMenu = Object.assign({}, menu);
                    clonedMenu.children = endpoint;
                    rs.push(clonedMenu);
                }
            }
        }
        return rs;
    };

    return search(fullMenus, permissions);
};

const ROLES_OF_PERMITS = {
    'admin': [1, 2, 3, 5, 7, 9],
    'user': [6, 8, 10, 11,12],
    'stansberrymember': [6],
};


export function getPermissions(roles) {
    let permissions = [];
    for (const role of roles) {

        const permitsOfRole = ROLES_OF_PERMITS[role];
        if (permitsOfRole) {
            permissions = permissions.concat(permitsOfRole);
        }
    }
    return filter(JSON.parse(JSON.stringify(fullMenus)), permissions);
}
