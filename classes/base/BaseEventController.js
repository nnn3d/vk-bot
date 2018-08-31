'use strict';

const EventInfo = require('./EventInfo');
const promiseFactory = require('../../helpers/promiseFactory');

class BaseEventController {

    /**
     *
     */
	constructor() {
	    this._construct();
        // this.emit(this.eventNames.create);
    }

    _construct() {
        this.preEventsGlobal = this._createGlobal({
            order: 'Pre',
            type: 'Listener',
        });
        this.onEventsGlobal = this._createGlobal({
            order: 'On',
            type: 'Listener',
        });
        this.afterEventsGlobal = this._createGlobal({
            order: 'After',
            type: 'Listener',
        });
        this.middlewarePreGlobal = this._createGlobal({
            order: 'Pre',
            type: 'Middleware',
        });
        this.middlewareOnGlobal = this._createGlobal({
            order: 'On',
            type: 'Middleware',
        });
        this.eventEmit = false;
        this.emitLogs = false;
    }

    /**
     *
     * @param {Object} [hiddenInfo]
     * @return {Object}
     * @private
     */
    _createGlobal(hiddenInfo = {}) {
	    let obj = {};
	    Object.keys(hiddenInfo).map(key => {
	        obj[key] = {
	            value: hiddenInfo[key],
                writable: false,
                enumerable: false,
                configurable: false,
            }
        });
	    return Object.create({}, obj);
    }

	/**
	 * push base listenerPromise into events array
	 * @param  {Object} eventsGlobal
	 * @param  {EventInfo} eventInfo   Set of events
	 * @return {Boolean}	true if done, false if not
     * @protected
	 */
	_pushEventListener(eventsGlobal, eventInfo) {
        if (!eventsGlobal || !eventInfo) return false;
        if (!eventsGlobal[eventInfo.eventName]) {
            eventsGlobal[eventInfo.eventName] = new Set();
        }
        eventsGlobal[eventInfo.eventName].add(eventInfo);
		return true;
	}

    /**
     *
     * @param {Object} eventsGlobal
     * @param {String} eventName
     * @returns {Set<EventInfo>}
     * @protected
     */
	_getEvents(eventsGlobal, eventName) {
        // if (!eventsGlobal || !eventName ) return new Set;
        // if (!eventsGlobal[eventName]) {
        //     return new Set;
        // }
        return eventsGlobal[eventName] || new Set;
    }

    /**
     *
     * @param {Object} eventsGlobal
     * @param {String} eventName
     * @returns {Promise<Set<EventInfo>>}
     * @protected
     */
    _getEventsToEmit(eventsGlobal, eventName) {
	    let events = this._getEvents(eventsGlobal, eventName);
	    return Promise.resolve(events);
    }

    /**
     *
     * @param {Object} eventsGlobal
     * @param {String} eventName
     * @param {EventInfo} eventInfo
     * @returns {Promise}
     * @protected
     */
    _removeEventInfo(eventsGlobal, eventName, eventInfo) {
        let events = this._getEvents(eventsGlobal, eventName);
        let emitEventName = this.eventNames[`remove${eventsGlobal.type}${eventsGlobal.order}`];
        if (events.has(eventInfo) && eventName !== emitEventName) {
            return this.ctrlEmit(() => {
                let result = events.delete(eventInfo);
                if (events.size === 0) {
                    delete eventsGlobal[eventName];
                }
                return result;
            }, emitEventName, eventInfo);
        }
        return Promise.resolve(false);
    }

    /**
     *
     * @param {Object} eventsGlobal
     * @param {String} eventName
     * @param {Function} listener
     * @returns {Promise}
     * @protected
     */
    _removeListener(eventsGlobal, eventName, listener) {
        let events = this._getEvents(eventsGlobal, eventName);
        for (let eventInfo of events) {
            if (eventInfo.listener === listener) {
                return this._removeEventInfo(eventsGlobal, eventName, eventInfo);
            }
        }
        return Promise.resolve(false);
    }

    /**
     *
     * @param {Object} eventsGlobal
     * @param {String} eventName
     * @param {Function} handler
     * @returns {Promise}
     * @protected
     */
    _removeListenersByHandler(eventsGlobal, eventName, handler) {
        let events = this._getEvents(eventsGlobal, eventName);
        let removePromises = [];
        for (let eventInfo of events) {
            if (eventInfo.handler === handler) {
                removePromises.push(this._removeEventInfo(eventsGlobal, eventName, eventInfo));
            }
        }
        return promiseFactory.allAsync(removePromises);
    }

    /**
     *
     * @param {Object} eventsGlobal
     * @param {String} eventName
     * @returns {Promise}
     * @protected
     */
    _removeAllListeners(eventsGlobal, eventName) {
        let promiseEvents = [];
        this._getEvents(eventsGlobal, eventName).forEach((eventInfo) => {
            promiseEvents.push(this._removeEventInfo(eventsGlobal, eventName, eventInfo));
        });
        return promiseFactory.allAsync(promiseEvents);
    }

    /**
     *
     * @param {String} eventName
     * @param {...*} args
     * @returns {Promise.<*>}
     * @protected
     */
	_emitPre(eventName, ...args) {
	    let promiseEvents = [];
	    return this._getEventsToEmit(this.preEventsGlobal, eventName).then((events) => events.forEach(function (eventInfo) {
            promiseEvents.push(promiseFactory.funToPromise(eventInfo.bindListener, ...args));
        }))
            .then(() => Promise.all(promiseEvents))
            .catch((err) => {throw `emit pre failed: ${err}`});
    }

    /**
     *
     * @param {String} eventName
     * @param {...*} args
     * @returns {Promise.<*>}
     * @protected
     */
    _emitOn(eventName, ...args) {
        let promiseEvents = [];
        return this._getEventsToEmit(this.onEventsGlobal, eventName).then((events) => events.forEach(function (eventInfo) {
            promiseEvents.push(promiseFactory.funToPromise(eventInfo.bindListener, ...args));
        }))
            .then(() => promiseFactory.allAsync(promiseEvents))
            .catch((err) => {throw `emit on failed: ${err}`});
    }

    /**
     *
     * @param {String} eventName
     * @param {...*} args
     * @returns {Promise.<*>}
     * @protected
     */
    _emitAfter(eventName, ...args) {
        let promiseEvents = [];
        return this._getEventsToEmit(this.afterEventsGlobal, eventName).then((events) => events.forEach(function (eventInfo) {
            promiseEvents.push(promiseFactory.funToPromise(eventInfo.bindListener, ...args));
        }))
            .then(() => promiseFactory.allAsync(promiseEvents))
            .catch((err) => {throw `emit after failed: ${err}`});
    }

    /**
     *
     * @param {String} eventName
     * @param {Array} args
     * @returns {Promise<Array>}
     * @protected
     */
    _emitMiddlewarePre(eventName, args) {
        return this._getEventsToEmit(this.middlewarePreGlobal, eventName).then((events) => {
            let result = Promise.resolve(args);
            events.forEach(function (eventInfo) {
                result = result
                    .then((args) => (
                        promiseFactory.funToPromise(eventInfo.bindListener, args)
                    ))
                    .then((newArgs) => {
                        if (Array.isArray(newArgs)) {
                            args = newArgs;
                        }
                        return args;
                    }, () => args);
            });
            return result;
        });
    }

    /**
     *
     * @param {String} eventName
     * @param {Array} args
     * @returns {Promise<Array>}
     * @protected
     */
    _emitMiddlewareOn(eventName, args) {
        return this._getEventsToEmit(this.middlewareOnGlobal, eventName).then((events) => {
            let result = Promise.resolve(args);
            events.forEach(function (eventInfo) {
                result = result
                    .then((args) => (
                        promiseFactory.funToPromise(eventInfo.bindListener, args)
                    ))
                    .then((newArgs) => {
                        if (Array.isArray(newArgs)) {
                            args = newArgs;
                        }
                        return args;
                    }, () => args);
            });
            return result;
        });
    }

    /**
     *
     * @param {String} eventName
     * @param {...*} args
     * @returns {Promise.<*>}
     */
    emit(eventName = this.eventNames.noNameEvent, ...args) {
        return this.ctrlEmit(() => {}, eventName, ...args);
    }

    /**
     *
     * @param {Function} controlledFunction
     * @param {String} eventName
     * @param {...*} args
     * @returns {Promise.<*>}
     */
    ctrlEmit(controlledFunction = () => {}, eventName = this.eventNames.noNameEvent, ...args) {
        let result, afterArgs;
        let emitFn = (eventName, ...args) => {
            return this._emitMiddlewarePre(eventName, args)
            .then((args) => this._emitPre(eventName, ...args).then(() => args))
            .then((args) => this._emitMiddlewareOn(eventName, args))
            .then((args) => {
                afterArgs = args;
                return promiseFactory.allAsync([
                    () => this._emitOn(eventName, ...args),
                    () => controlledFunction(...args)
                ]);
            })
            .then((args) => result = args[1])
            .then(() => this._emitAfter(eventName, ...afterArgs, result))
            .then(() => result)
            .catch(err => {
                if (err instanceof Error) {
                    console.error(`emit '${eventName}' error`, this.constructor.name, err);
                } else if (typeof err === 'string' && err.length > 0 && this.emitLogs) {
                    console.log(`emit '${eventName}' stops: `, err);
                }
                return null;
            });
        };
        if (eventName !== this.eventNames.emit && this.eventEmit) {
            return this.ctrlEmit(emitFn, this.eventNames.emit, eventName, ...args);
        }
        return emitFn(eventName, ...args);
    }

    /**
     *
     * @returns {{create: string, emit: string, noNameEvent: string, newListenerPre: string, newListenerOn: string, newListenerAfter: string, newMiddlewarePre: string, newMiddlewareOn: string, removeListenerPre: string, removeListenerOn: string, removeListenerAfter: string, removeMiddlewarePre: string, removeMiddlewareOn: string}}
     */
    get eventNames() {
        let eventNames = {
            create: 'create',
            emit: 'emit',
            noNameEvent: 'noNameEvent',
            newListenerPre: 'newListenerPre',
            newListenerOn: 'newListenerOn',
            newListenerAfter: 'newListenerAfter',
            newMiddlewarePre: 'newMiddlewarePre',
            newMiddlewareOn: 'newMiddlewareOn',
            removeListenerPre: 'removeListenerPre',
            removeListenerOn: 'removeListenerOn',
            removeListenerAfter: 'removeListenerAfter',
            removeMiddlewarePre: 'removeMiddlewarePre',
            removeMiddlewareOn: 'removeMiddlewareOn'
        };
        return eventNames;
    }

    static get eventNames() {
        return this.prototype.eventNames;
    }

	/**
	 * add 'pre' base listener, which checks, and must return true to run 'on' base
	 * @param  {String} eventName    name of base
	 * @param  {function(*): Promise} listenerPromise listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     * @returns {Promise.<*>}
	 */
	pre(eventName = this.eventNames.noNameEvent, listenerPromise = () => {}, listenerObject = {}, options = {}) {
	    options = Object.assign({handler: listenerObject}, options);
	    let eventInfo = new EventInfo(eventName, listenerPromise, options);
		return this.ctrlEmit((eventInfo) => {
                this._pushEventListener(this.preEventsGlobal, eventInfo);
            },
            this.eventNames.newListenerPre,
            eventInfo
        );
	}

    /**
     * add 'on' base listener
     * @param  {String} eventName    name of base
     * @param  {function(*): Promise} listenerPromise listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     * @returns {Promise.<*>}
     */
	on(eventName = this.eventNames.noNameEvent, listenerPromise = () => {}, listenerObject = {}, options = {}) {
	    options = Object.assign({handler: listenerObject}, options);
        let eventInfo = new EventInfo(eventName, listenerPromise, options);
        return this.ctrlEmit((eventInfo) => {
                this._pushEventListener(this.onEventsGlobal, eventInfo);
            },
            this.eventNames.newListenerOn,
            eventInfo
        );
    }

    /**
     * add 'after' base listener
     * @param  {String} eventName    name of base
     * @param  {function(*): Promise} listenerPromise listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     * @returns {Promise.<*>}
     */
    after(eventName = this.eventNames.noNameEvent, listenerPromise = () => {}, listenerObject = {}, options = {}) {
        options = Object.assign({handler: listenerObject}, options);
        let eventInfo = new EventInfo(eventName, listenerPromise, options);
        return this.ctrlEmit((eventInfo) => {
                this._pushEventListener(this.afterEventsGlobal, eventInfo);
            },
            this.eventNames.newListenerAfter,
            eventInfo
        );
    }


    /**
     *
     * @param  {String} eventName    name of base
     * @param  {function(Array): (Array)} listener listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     * @returns {Promise.<*>}
     */
    middlewarePre(eventName = this.eventNames.noNameEvent, listener = (r) => r, listenerObject = {}, options = {}) {
        options = Object.assign({handler: listenerObject}, options);
        let eventInfo = new EventInfo(eventName, listener, options);
        return this.ctrlEmit((eventInfo) => {
                this._pushEventListener(this.middlewarePreGlobal, eventInfo);
            },
            this.eventNames.newMiddlewarePre,
            eventInfo
        );
    }

    /**
     *
     * @param  {String} eventName    name of base
     * @param  {function(Array): (Array)} listener listener function, which run on base, and must return Promise
     * @param  {Object|Function} listenerObject
     * @param  {{repeatTimes: Number}} options
     */
    middlewareOn(eventName = this.eventNames.noNameEvent, listener = (r) => r, listenerObject = {}, options = {}) {
        options = Object.assign({handler: listenerObject}, options);
        let eventInfo = new EventInfo(eventName, listener, options);
        return this.ctrlEmit((eventInfo) => {
                this._pushEventListener(this.middlewareOnGlobal, eventInfo);
            },
            this.eventNames.newMiddlewareOn,
            eventInfo
        );
    }

    /**
     *
     * @returns {Array}
     */
    eventNamesPre() {
        return Object.keys(this.preEventsGlobal);
    }

    /**
     *
     * @returns {Array}
     */
    eventNamesOn() {
        return Object.keys(this.onEventsGlobal);
    }

    /**
     *
     * @returns {Array}
     */
    eventNamesAfter() {
        return Object.keys(this.afterEventsGlobal);
    }

    /**
     *
     * @returns {Array}
     */
    middlewareNamesPre() {
        return Object.keys(this.middlewarePreGlobal);
    }

    /**
     *
     * @returns {Array}
     */
    middlewareNamesOn() {
        return Object.keys(this.middlewareOnGlobal);
    }

    /**
     *
     * @param {String} eventName
     * @returns {number}
     */
    listenerCountPre(eventName) {
        return this._getEvents(this.preEventsGlobal, eventName).size;
    }

    /**
     *
     * @param {String} eventName
     * @returns {number}
     */
    listenerCountOn(eventName) {
        return this._getEvents(this.onEventsGlobal, eventName).size;
    }

    /**
     *
     * @param {String} eventName
     * @returns {number}
     */
    listenerCountAfter(eventName) {
        return this._getEvents(this.afterEventsGlobal, eventName).size;
    }

    /**
     *
     * @param {String} eventName
     * @returns {number}
     */
    middlewareCountPre(eventName) {
        return this._getEvents(this.middlewarePreGlobal, eventName).size;
    }

    /**
     *
     * @param {String} eventName
     * @returns {number}
     */
    middlewareCountOn(eventName) {
        return this._getEvents(this.middlewareOnGlobal, eventName).size;
    }

    /**
     *
     * @param {String} eventName
     * @returns {Set<EventInfo>}
     */
    listenersPre(eventName) {
        return this._getEvents(this.preEventsGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Set<EventInfo>}
     */
    listenersOn(eventName) {
        return this._getEvents(this.onEventsGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Set<EventInfo>}
     */
    listenersAfter(eventName) {
        return this._getEvents(this.afterEventsGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Set<EventInfo>}
     */
    middlewaresPre(eventName) {
        return this._getEvents(this.middlewarePreGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Set<EventInfo>}
     */
    middlewaresOn(eventName) {
        return this._getEvents(this.middlewareOnGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Promise}
     */
    removeAllListenersPre(eventName) {
        return this._removeAllListeners(this.preEventsGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Promise}
     */
    removeAllListenersOn(eventName) {
        return this._removeAllListeners(this.onEventsGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Promise}
     */
    removeAllListenersAfter(eventName) {
        return this._removeAllListeners(this.afterEventsGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Promise}
     */
    removeAllMiddlewarePre(eventName) {
        return this._removeAllListeners(this.middlewarePreGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @returns {Promise}
     */
    removeAllMiddlewareOn(eventName) {
        return this._removeAllListeners(this.middlewareOnGlobal, eventName);
    }

    /**
     *
     * @param {String} eventName
     * @param {Object|Function} handler
     * @returns {Promise}
     */
    removeListenersPreByHandler(eventName, handler) {
        return this._removeListenersByHandler(this.preEventsGlobal, eventName, handler);
    }

    /**
     *
     * @param {String} eventName
     * @param {Object|Function} handler
     * @returns {Promise}
     */
    removeListenersOnByHandler(eventName, handler) {
        return this._removeListenersByHandler(this.onEventsGlobal, eventName, handler);
    }

    /**
     *
     * @param {String} eventName
     * @param {Object|Function} handler
     * @returns {Promise}
     */
    removeListenersAfterByHandler(eventName, handler) {
        return this._removeListenersByHandler(this.afterEventsGlobal, eventName, handler);
    }

    /**
     *
     * @param {String} eventName
     * @param {Object|Function} handler
     * @returns {Promise}
     */
    removeMiddlewarePreByHandler(eventName, handler) {
        return this._removeListenersByHandler(this.middlewarePreGlobal, eventName, handler);
    }

    /**
     *
     * @param {String} eventName
     * @param {Object|Function} handler
     * @returns {Promise}
     */
    removeMiddlewareOnByHandler(eventName, handler) {
        return this._removeListenersByHandler(this.middlewareOnGlobal, eventName, handler);
    }

    /**
     *
     * @param {String} eventName
     * @param {Function} listener
     * @returns {Promise}
     */
    removeListenerPre(eventName, listener) {
        return this._removeListener(this.preEventsGlobal, eventName, listener);
    }

    /**
     *
     * @param {String} eventName
     * @param {Function} listener
     * @returns {Promise}
     */
    removeListenerOn(eventName, listener) {
        return this._removeListener(this.onEventsGlobal, eventName, listener);
    }

    /**
     *
     * @param {String} eventName
     * @param {Function} listener
     * @returns {Promise}
     */
    removeListenerAfter(eventName, listener) {
        return this._removeListener(this.afterEventsGlobal, eventName, listener);
    }

    /**
     *
     * @param {String} eventName
     * @param {Function} listener
     * @returns {Promise}
     */
    removeMiddlewarePre(eventName, listener) {
        return this._removeListener(this.middlewarePreGlobal, eventName, listener);
    }

    /**
     *
     * @param {String} eventName
     * @param {Function} listener
     * @returns {Promise}
     */
    removeMiddlewareOn(eventName, listener) {
        return this._removeListener(this.middlewareOnGlobal, eventName, listener);
    }

}

module.exports = BaseEventController;
