'use strict';

const BaseEventController = require('./BaseEventController');

class GlobalEventController extends BaseEventController {

    get eventNames() {
        let eventNames = super.eventNames;
        eventNames.reset = 'reset';
        return eventNames;
    }

    /**
     *
     * @param  {String} eventName    name of base
     * @param  {function(Array, BaseEventController?): (Array)} listener listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     * @returns {Promise.<*>}
     */
    middlewarePre(eventName = 'noNameEvent', listener = (r) => r, listenerObject = {}, options = {}) {
        return super.middlewarePre(eventName, listener, listenerObject, options);
    }

    /**
     *
     * @param  {String} eventName    name of base
     * @param  {function(Array, BaseEventController?): (Array)} listener listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     * @returns {Promise.<*>}
     */
    middlewareOn(eventName = 'noNameEvent', listener = (r) => r, listenerObject = {}, options = {}) {
        return super.middlewareOn(eventName, listener, listenerObject, options);
    }

    /**
     *
     * @returns {Promise.<*>}
     */
    reset() {
        return this.ctrlEmit(() => this._construct(), this.eventNames.reset);
    }

}

module.exports = GlobalEventController;