'use strict';

module.exports = (name = 'event') => {
    return {
        get(target, property) {
            let oldProperty = property;
            if (!property.startsWith(name)) {
                property = name + property[0].toUpperCase() + property.slice(1);
            }
            if ((property !== oldProperty && target[oldProperty])
                || !target[property] instanceof Function
                || !target['ctrlEmit'] instanceof Function) {
                return target[oldProperty];
            }
            let eventName = property[5].toLowerCase() + property.slice(6);
            return (...args) => target['ctrlEmit'](target[property].bind(target, ...args), eventName, ...args);
        }
    }
};