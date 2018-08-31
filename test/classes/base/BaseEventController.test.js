'use strict';

const {assert} = require('chai');
const BaseEventController = require('../../../classes/base/BaseEventController');

describe('BaseEventController', () => {

    let controller = new BaseEventController;

    beforeEach(() => {
        controller._construct();
    });

    describe('Events', () => {

        let types = [['Pre', 'pre'], ['On', 'on'], ['After', 'after']];

        for (let type of types) {

            describe(`${type[0]} events`, () => {

                it(`add ${type[1]} event listener`, (done) => {
                    controller[type[1]]('event')
                        .then(() => {
                            assert.containsAllDeepKeys(
                                controller[`${type[1]}EventsGlobal`],
                                ['event'],
                                'event in global events'
                            );
                        })
                        .then(done, done)
                });

                it(`add noName ${type[1]} event when run without params`, (done) => {
                    controller[type[1]]()
                        .then(() => {
                            assert.containsAllDeepKeys(
                                controller[`${type[1]}EventsGlobal`],
                                ['noNameEvent'],
                                'noNameEvent in global events'
                            );
                        })
                        .then(done, done)
                });

                it(`remove ${type[1]} all listeners`, (done) => {
                    controller[type[1]]('event', () => {})
                        .then(() => controller[type[1]]('event'))
                        .then(() => controller[`removeAllListeners${type[0]}`]('event'))
                        .then(() => {
                            assert.doesNotHaveAnyDeepKeys(
                                controller[`${type[1]}EventsGlobal`],
                                ['event'],
                                'base not in global events'
                            );
                        })
                        .then(done, done)
                });

                it(`remove ${type[1]} listener by function`, (done) => {
                    let listener = () => {};
                    controller[type[1]]('event', listener)
                        .then(() => controller[`removeListener${type[0]}`]('event', listener))
                        .then(() => {
                            assert.doesNotHaveAnyDeepKeys(
                                controller[`${type[1]}EventsGlobal`],
                                ['event'],
                                `event not in ${type[1]}EventsGlobal`
                            );
                        })
                        .then(done, done);

                });

                it(`remove ${type[1]} listeners by handler`, (done) => {
                    let handler = Symbol();
                    controller[type[1]]('event', () => 1, handler)
                        .then(() => controller[type[1]]('event', () => 2, handler))
                        .then(() => controller[`removeListeners${type[0]}ByHandler`]('event', handler))
                        .then(() => {
                            assert.doesNotHaveAnyDeepKeys(
                                controller[`${type[1]}EventsGlobal`],
                                ['event'],
                                `event not in ${type[1]}EventsGlobal`
                            );
                        })
                        .then(done, done);

                });

                it(`emit ${type[1]} event sync`, (done) => {
                    let a = Symbol(), b = Symbol();
                    controller[type[1]]('event', () => {
                        a = b;
                    })
                        .then(() => {
                            return controller.emit('event');
                        })
                        .then(() => {
                            assert.equal(a, b, 'a equal b');
                        })
                        .then(done, done)
                });

                it(`emit ${type[1]} event with params`, (done) => {
                    let a = Symbol(), b = Symbol();
                    controller[type[1]]('event', (aParam, bParam) => {
                        assert.equal(aParam, a, 'param a equal a');
                        assert.equal(bParam, b, 'param b equal b');
                        done();
                    })
                        .then(() => {
                            return controller.emit('event', a, b);
                        })
                });

                it(`emit "newListener${type[0]}" when add new ${type[1]} listener`, (done) => {
                    let a;
                    let b = Symbol();
                    controller[type[1]](`newListener${type[0]}`, () => {
                        a = b;
                    })
                        .then(() => controller[type[1]]())
                        .then(() => {
                            assert.equal(a, b, `"newListener${type[0]}" emitted`);
                        })
                        .then(() => done(), done);
                })

            })
        }

        describe('All', () => {

            it('emit "emit" event when emit with eventName and args', (done) => {
                let a = Symbol();
                let args = [Symbol(), Symbol()];
                controller.on('emit', (eventName, argsParam) => (
                    Promise.resolve()
                        .then(() => {
                            assert.equal(eventName, 'event', 'event name is "event"');
                            assert.equal(args, argsParam, 'params are equal');
                        })
                        .then(done, done)
                ))
                    .then(() => controller.emit('event', args));
            });

            it('failure "pre" event stops the emit', (done) => {
                let a, b;
                a = b = Symbol();
                controller.pre('event', () => {throw 'this stops the emit, its OK'})
                    .then(() => controller.on('event', () => {a = Symbol()}))
                    .then(() => controller.after('event', () => {a = Symbol()}))
                    .then(() => controller.emit('event'))
                    .then(() => assert.equal(a, b, 'a does not changed - equal b'))
                    .then(done, done);
            });

            it('ctrlEmit should return result of controlled function', (done) => {
                let a, b = Symbol();
                controller.ctrlEmit(() => b)
                    .then((r) => {
                        assert.equal(r, b, 'controlled function returns arg equal b');
                    })
                    .then(done, done);
            });

        })
    });


    describe('Middleware', () => {

        let types = [['Pre', 'pre'], ['On', 'on']];

        for (let type of types) {

            describe(`${type[0]} middleware`, () => {

                it(`add ${type[1]} middleware`, (done) => {
                    controller[`middleware${type[0]}`]('event', () => {})
                        .then(() => {
                            assert.containsAllDeepKeys(
                                controller[`middleware${type[0]}Global`],
                                ['event'],
                                'base in global middleware'
                            );
                        })
                        .then(done, done)
                });

                it(`add noName ${type[1]} event middleware when run without params`, (done) => {
                    controller[`middleware${type[0]}`]()
                        .then(() => {
                            assert.containsAllDeepKeys(
                                controller[`middleware${type[0]}Global`],
                                ['noNameEvent'],
                                `noNameEvent in middleware${type[0]}Global`
                            );
                        })
                        .then(done, done)
                });

                it(`remove ${type[1]} all middleware`, (done) => {
                    controller[`middleware${type[0]}`]('event', () => {})
                        .then(() => controller[type[1]]('event'))
                        .then(() => controller[`removeAllMiddleware${type[0]}`]('event'))
                        .then(() => {
                            assert.doesNotHaveAnyDeepKeys(
                                controller[`middleware${type[0]}Global`],
                                ['event'],
                                `event not in middleware${type[0]}Global`
                            );
                        })
                        .then(done, done)
                });

                it(`remove ${type[1]} middleware by function`, (done) => {
                    let listener = () => {};
                    controller[`middleware${type[0]}`]('event', listener)
                        .then(() => controller[`removeMiddleware${type[0]}`]('event', listener))
                        .then(() => {
                            assert.doesNotHaveAnyDeepKeys(
                                controller[`middleware${type[0]}Global`],
                                ['event'],
                                `event not in middleware${type[0]}Global`
                            );
                        })
                        .then(done, done);

                });

                it(`remove ${type[1]} middleware by handler`, (done) => {
                    let handler = Symbol();
                    controller[`middleware${type[0]}`]('event', () => 1, handler)
                        .then(() => controller[type[1]]('event', () => 2, handler))
                        .then(() => controller[`removeMiddleware${type[0]}ByHandler`]('event', handler))
                        .then(() => {
                            assert.doesNotHaveAnyDeepKeys(
                                controller[`middleware${type[0]}Global`],
                                ['event'],
                                `event not in middleware${type[0]}Global`
                            );
                        })
                        .then(done, done);

                });

                it(`emit ${type[1]} middleware with params`, (done) => {
                    let a = Symbol(), b = Symbol();
                    controller[`middleware${type[0]}`]('event', () => {
                        return [b];
                    })
                        .then(() => controller[type[1]]('event', (arg) => Promise.resolve()
                            .then(() => {
                                assert.equal(arg, b, 'arg in event equal middleware returns arg');
                            })
                            .then(done, done)
                        ))
                        .then(() => controller.emit('event'));
                });

                it(`emit "newMiddleware${type[0]}" when add new ${type[1]} listener`, (done) => {
                    let a;
                    let b = Symbol();
                    controller[`${type[1]}`](`newMiddleware${type[0]}`, () => {
                        a = b;
                    })
                        .then(() => controller[`middleware${type[0]}`]())
                        .then(() => {
                            assert.equal(a, b, `"newMiddleware${type[0]}" emitted`);
                        })
                        .then(() => done(), done);
                })

            });
        }
    });
});
