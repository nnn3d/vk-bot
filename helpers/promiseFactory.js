'use strict';

module.exports = {

    /**
     *
     * @param {Iterable.<Promise|Function>} promises
     * @param {Boolean} catchError
     * @returns {Promise<Array>}
     */
     allAsync(promises = [], catchError = true) {
        let eventsCount = 0;
        return new Promise((resolve) => {
            let releaseFunction = function (num, promiseResult) {
                result[num] = promiseResult;
                if (--eventsCount === 0) {
                    resolve(result);
                }
            };
            for (let promise of promises) {
                eventsCount++
            }
            if (eventsCount === 0) return resolve([]);
            let num = 0;
            let result = [];
            for (let promise of promises) {
                let n = num;
                this.funToPromise(promise)
                    .then(releaseFunction.bind(this, n),
                        (err) => {
                            if (catchError) console.error(err);
                            return releaseFunction(n, err);
                        });
                num++;
            }
        });
    },

    /**
     *
     * @param {Iterable.<Promise|Function>} promises
     * @returns {Promise}
     */
     allAsyncAnd(promises = []) {
        let eventsCount = 0;
        return new Promise((resolve, reject) => {
            let releaseFunction = function () {
                if (--eventsCount === 0) {
                    resolve();
                }
            };
            for (let promise of promises) {
                eventsCount++
            }
            if (eventsCount === 0) return resolve();
            for (let promise of promises) {
                this.funToPromise(promise).then(releaseFunction, reject);
            }
        });
    },

    /**
     *
     * @param {Iterable.<Promise|Function>} promises
     * @param {Boolean} catchError
     * @returns {Promise<Array>}
     */
    allSync(promises = [], catchError = true) {
        let result = [];
        let releaseFunction = function (promiseResult) {
            result.push(promiseResult);
        };
        let resultPromise = Promise.resolve();
        for (let promise of promises) {
            resultPromise = resultPromise
                .then(() => this.funToPromise(promise))
                .then(releaseFunction,
                    (err) => {
                        if (catchError) console.error(err);
                        return releaseFunction(err);
                    });
        }
        return resultPromise.then(() => result);
    },

    /**
     *
     * @param {Function|Promise} fun
     * @param {...*} args
     * @returns {Promise}
     */
     funToPromise(fun, ...args) {
        if (fun instanceof Function) return Promise.resolve().then(() => fun(...args));
        else return Promise.resolve().then(() => fun);
    },

    callbackToPromise(fun, ...args) {
         return new Promise((resolve, reject) => {
             // let timeout = setTimeout(reject, 600000, new Error('callbackToPromise out of time (600s)'));
             fun(...args, (...result) => {
                 // clearTimeout(timeout);
                 resolve(result);
             })
         })
    },

    defaultCBToPromise(fun, ...args) {
         return this.callbackToPromise(fun, ...args)
             .then(result => {
                 if (result[0]) throw result[0];
                 return result[1];
             });
    },

    cbp(fun, ...args) {
         return this.callbackToPromise(fun, ...args);
    },

    dcbp(fun, ...args) {
         return this.defaultCBToPromise(fun, ...args);
    },
};
