'use strict';

const ModuleEventController = require('./ModuleEventController');
const GlobalEventController = require('./GlobalEventController');

let globalEvents = new GlobalEventController;

class CoreModuleEventController extends ModuleEventController {

    /**
     *
     * @returns {GlobalEventController}
     */
    static get global() {
        return globalEvents;
    }
}

module.exports = CoreModuleEventController;