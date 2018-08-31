'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');

module.exports = class FriendsControl extends ModuleEventController {

    constructor({
        periodToCheck = 2e5,
        unique = true,
        maxFriends = 9500,
        countAdditionalAccounts = 3,
    } = {}) {
        super();
        this.periodToCheck = periodToCheck;
        this.unique = unique;
        this.maxFriends = maxFriends;
        this.countAdditionalAccounts = countAdditionalAccounts;
    }

    _init(bot) {
        this.bot = bot;
        if (this.bot.clusterMode && this.bot.clusterMode.instanceNum !== 0) return;
        let promises = [];
        this.accounts = [];
        this.bot.additionalAccounts.slice(0, this.countAdditionalAccounts).concat(this.bot.vk).map(vk => {
            let account = { vk, friends: [] };
            promises.push(account.vk.api.friends.get({ count: 10000 })
                .then(res => account.friends = res.items)
                .then(() => this.accounts.push(account)));
        });
        return promiseFactory.allAsync(promises).then(() => {
            this.checkFriendsInterval = setInterval(() => this._checkAll(), this.periodToCheck);
            return this._checkAll(true);
        });
    }

    _final() {
        clearInterval(this.checkFriendsInterval);
    }

    _checkAll(viewed = false) {
        promiseFactory.allAsync(this.accounts.map(account => this._deleteRequests(account)))
            .then(() => {
                let result = Promise.resolve();
                this.accounts.map(account => result = result.then(() => this._checkFriends(account, viewed)));
                return result;
            });
    }

    _deleteRequests(account) {
        return this.bot.ctrlEmit(() => {
            return account.vk.api.friends.getRequests({ out: 1 })
                .then(({items}) => {
                    return promiseFactory.allAsync(items.map(
                        userId => account.vk.api.friends.delete({user_id: userId})
                            .then(res => {
                                if (res.success && account.friends.includes(userId))
                                    account.friends.splice(account.friends.indexOf(userId), 1);
                            })
                    ));
                });
        }, 'deleteBotRequests', account.vk.selfId);
    }

    _checkFriends(account, viewed) {
        if (account.friends.length >= this.maxFriends) return;
        return this.bot.ctrlEmit(() => {
            let result = Promise.resolve();
            return account.vk.collect.friends.getRequests({
                need_viewed: viewed ? 1 : 0,
            })
                .then((items) => {
                    for (let userId of items) {
                        if (!this.unique || !this.accounts.filter(acc => acc.friends.includes(userId)).length)
                            result = result.then(() => this._addFriend(account, userId));
                    }
                    return result;
                })
        }, 'checkBotFriends', account.vk.selfId);
    }

    _addFriend(account, userId) {
        if (account.friends.length >= this.maxFriends) return;
        return account.vk.api.friends.add({ user_id: userId })
            .catch(() => 0)
            .then(result => {
                if (result === 2 && !account.friends.includes(userId)) {
                    account.friends.push(userId);
                }
            });
    }

};
