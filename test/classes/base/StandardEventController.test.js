'use strict';

const {assert} = require('chai');
const StandardEventController = require('../../../classes/base/StandardEventController');

describe('StandardEventController', () => {

    let controller = new StandardEventController;

    beforeEach(() => {
        controller = new StandardEventController;
        controller.global.reset();
    });

    it('every class object has same "global"', (done) => {
        let controller2 = new StandardEventController;
        controller2.global.on('event')
            .then(() => {
                assert.containsAllDeepKeys(
                    controller.global.onEventsGlobal,
                    ['event'],
                    'event in global events'
                );
            })
            .then(done, done)
    });

    it('extends class objects has no same "global"', (done) => {
        class TestStandardEventController extends StandardEventController {}
        let controller2 = new TestStandardEventController;
        controller2.global.on('event')
            .then(() => {
                console.log(StandardEventController.global);
                console.log(TestStandardEventController._globalEvents);
            })
            .then(() => {
                assert.doesNotHaveAnyDeepKeys(
                    controller.global.onEventsGlobal,
                    ['event'],
                    'event in global events'
                );
            })
            .then(done, done)
    });

    it('should emit pre from global when emit pre from object', (done) => {
        let a, b = Symbol();
        controller.global.pre('event', () => {
            a = b;
        })
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit on from global when emit on from object', (done) => {
        let a, b = Symbol();
        controller.global.on('event', () => {
            a = b;
        })
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit after from global when emit after from object', (done) => {
        let a, b = Symbol();
        controller.global.after('event', () => {
            a = b;
        })
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit middleware pre from global when emit middleware pre from object', (done) => {
        let a, b = Symbol();
        controller.global.middlewarePre('event', () => {
            a = b;
        })
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit middleware on from global when emit middleware on from object', (done) => {
        let a, b = Symbol();
        controller.global.middlewareOn('event', () => {
            a = b;
        })
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit pre from global before emit pre from object', (done) => {
        let a, b;
        a = b = Symbol();
        controller.global.pre('event', () => {
            a = null;
        })
            .then(() => controller.pre('event', () => {
                a = b;
            }))
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit on from global before emit on from object', (done) => {
        let a, b;
        a = b = Symbol();
        controller.global.on('event', () => {
            a = null;
        })
            .then(() => controller.on('event', () => {
                a = b;
            }))
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit after from global before emit after from object', (done) => {
        let a, b;
        a = b = Symbol();
        controller.global.after('event', () => {
            a = null;
        })
            .then(() => controller.after('event', () => {
                a = b;
            }))
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit middleware pre from global before emit middleware pre from object', (done) => {
        let a, b;
        a = b = Symbol();
        controller.global.middlewarePre('event', () => {
            a = null;
        })
            .then(() => controller.middlewarePre('event', () => {
                a = b;
            }))
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });

    it('should emit middleware on from global before emit middleware on from object', (done) => {
        let a, b;
        a = b = Symbol();
        controller.global.middlewareOn('event', () => {
            a = null;
        })
            .then(() => controller.middlewareOn('event', () => {
                a = b;
            }))
            .then(() => controller.emit('event'))
            .then(() => {
                assert.strictEqual(a, b, 'a equal b after event');
            })
            .then(done, done);
    });



});