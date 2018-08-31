'use strict';

class EventInfo {

    /**
     *
     * @param {String} eventName
     * @param {Function} listener
     * @param {{handler: Object|Function, repeatTimes: Number}} options
     */
    constructor(eventName, listener, {
        handler = {},
        repeatTimes = Infinity
    } = {}) {
        this.eventName = eventName;
        this.listener = listener;
        this.handler = handler;
        this.repeatTimes = repeatTimes;
    }

    get bindListener() {
        return this.listener.bind(this.handler);
    }
}

module.exports = EventInfo;