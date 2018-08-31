'use strict';

const BaseEventController = require('./BaseEventController');
const GlobalEventController = require('./GlobalEventController');
const promiseFactory = require('../../helpers/promiseFactory');

class StandardEventController extends BaseEventController {

    /**
     *
     */
    constructor() {
        super();
    }

    _emitPre(eventName, ...args) {
        let promiseEvents = [];
        return this._getEventsToEmit(this.global.preEventsGlobal, eventName)
            .then((events) => events.forEach((eventInfo) => {
                promiseEvents.push(
                    promiseFactory.funToPromise(eventInfo.bindListener, ...args, this)
                        .catch((err) => {throw `emit pre failed: ${err}`})
                );
            }))
            .then(() => promiseEvents.push(super._emitPre(eventName, ...args)))
            .then(() => Promise.all(promiseEvents));
    }

    _emitOn(eventName, ...args) {
        let promiseEvents = [];
        return this._getEventsToEmit(this.global.onEventsGlobal, eventName)
            .then((events) => events.forEach((eventInfo) => {
                promiseEvents.push(promiseFactory.funToPromise(eventInfo.bindListener, ...args, this));
            }))
            .then(() => promiseEvents.push(super._emitOn(eventName, ...args)))
            .then(() => promiseFactory.allAsync(promiseEvents));
    }



    _emitAfter(eventName, ...args) {
        let promiseEvents = [];
        let result = args[args.length - 1];
        args = args.slice(0, args.length - 1);
        return this._getEventsToEmit(this.global.afterEventsGlobal, eventName)
            .then((events) => events.forEach((eventInfo) => {
                promiseEvents.push(promiseFactory.funToPromise(eventInfo.bindListener, ...args, this, result));
            }))
            .then(() => promiseEvents.push(super._emitAfter(eventName, ...args, result)))
            .then(() => promiseFactory.allAsync(promiseEvents));
    }

    _emitMiddlewarePre(eventName, args) {
        return this._getEventsToEmit(this.global.middlewarePreGlobal, eventName).then((events) => {
            let result = Promise.resolve(args);
            events.forEach((eventInfo) => {
                result = result
                    .then((args) => (
                        promiseFactory.funToPromise(eventInfo.bindListener, args, this)
                    ))
                    .then((newArgs) => {
                        if (Array.isArray(newArgs)) {
                            args = newArgs;
                        }
                        return args;
                    }, () => args);
            });
            return result;
        })
            .then((args) => super._emitMiddlewarePre(eventName, args));
    }

    _emitMiddlewareOn(eventName, args) {
        return this._getEventsToEmit(this.global.middlewareOnGlobal, eventName).then((events) => {
            let result = Promise.resolve(args);
            events.forEach((eventInfo) => {
                result = result
                    .then((args) => (
                        promiseFactory.funToPromise(eventInfo.bindListener, args, this)
                    ))
                    .then((newArgs) => {
                        if (Array.isArray(newArgs)) {
                            args = newArgs;
                        }
                        return args;
                    }, () => args);
            });
            return result;
        })
            .then((args) => super._emitMiddlewareOn(eventName, args));
    }

    /**
     *
     * @returns {GlobalEventController}
     */
    static get global() {
        if (!this._globalEvents) {
            this._globalEvents = {};
        }
        if (!this._globalEvents[this.name]) {
            return this._globalEvents[this.name] = new GlobalEventController;
        }
        return this._globalEvents[this.name];
    }

    /**
     *
     * @returns {GlobalEventController}
     */
    get global() {
        return this.constructor.global;
    }

}

module.exports = StandardEventController;
