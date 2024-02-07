export function validateUserName(user) {
    if (typeof user !== 'string') {
        return false;
    }
    user = user.trim();
    if (user.length === 0 || user.length > 64) {
        return false;
    }
    return /^[_\-.0-9a-z]+$/.test(user);
    
}

export function validateEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    email = email.trim();
    if (email.length === 0 || email.length > 64) {
        return false;
    }
    let split = email.split('@');
    if (split.length !== 2) {
        return false;
    }
    let name = split[0];
    let domain = split[1];
    if (!name || !/^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]+$/.test(name)) {
        return false;
    }
    if (/\.\./.test(name) || /^\./.test(name) || /\.$/.test(name)) {
        return false;
    }


    if (!domain || !/^[A-Za-z0-9\-.]+$/.test(domain)) {
        return false;
    }
    return !(!/\./.test(domain) || /\.\./.test(domain) || /^\./.test(domain) || /\.$/.test(domain));
    
}