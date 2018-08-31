'use strict';

const applyProxy = require('../helpers/applyProxy');

module.exports = (proxy) => {
    return {
        construct(target, args) {
            return applyProxy(new target(args), proxy);
        }
    }
};