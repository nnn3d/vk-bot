

const MongoClient = require('mongodb').MongoClient;
const pf = require('./helpers/promiseFactory');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'bot-158645511';
const selfId = 486809653;
const botId = 158645511;

// Use connect method to connect to the server
MongoClient.connect(url, function(err, client) {
    console.log("Connected successfully to server");

    const db = client.db(dbName);
    let vipChats, collections, mapChats, maps = {}, avChats = [];
    pf.dcbp(fn => db.collection('chatvipstatuses').find({ time: { $gt: Date.now() } }).toArray(fn))
        .then(result => {
            // vipChats = result.map(info => info.chatId).concat([2000000002, 2000000011]);
            vipChats = result.map(info => info.chatId);
            console.log('find', vipChats.length, 'vip chats');
            return pf.dcbp(fn => db.listCollections().toArray(fn));
        })
        .then(result => {
            collections = result.map(info => info.name).filter(name => name !== 'system.indexes' && name !== 'gameuserinfos');
            console.log('find collections', collections);
        })
        .then(() => pf.dcbp(fn => db.collection('groupschats').find({
            selfChatId: { $in: vipChats },
            selfId,
            botId,
        }).toArray(fn)))
        .then(result => {
            mapChats = result;
            console.log('get chat maps', mapChats.length);
            mapChats.map(info => {
                maps[info.selfChatId] = info.botChatId;
                avChats.push(info.selfChatId);
            });
            // for (let chatId of Object.keys(maps)) {
            //     for (let botChatId of Object.keys(maps)) {
            //         if (chatId === maps[botChatId]) throw `duplicate chatId ${chatId}`;
            //     }
            // }

        })
        .then(() => {
            return pf.allSync(collections.map(name => {
                console.log('start remove not vip info from collection', name);
                return pf.dcbp(fn => db.collection(name).remove({ chatId: { $nin: avChats, $exists: true } }, fn))
                    .then(r => console.log('end remove not vip info from collection', name));
            }));
        })
        .then(() => {
            return pf.allSync(collections.map(name => () => {
                console.log('start move info in collection', name);
                return pf.allSync(Object.keys(maps).map(chatId => {
                    return pf.dcbp(fn => db.collection(name).updateMany({ chatId: +chatId }, { $set: { chatId: +chatId + 4e9 } }, fn))
                        .then(result => console.log('move info in collection', name, 'from chat', chatId, 'to chat', (+chatId + 4e9), 'count', result.result.n));
                })).then(() => console.log('end move info in collection', name))
            }))
        })
        .then(() => {
            return pf.allSync(collections.map(name => () => {
                console.log('start move info in collection', name);
                return pf.allSync(Object.keys(maps).map(chatId => {
                    return pf.dcbp(fn => db.collection(name).updateMany({ chatId: +chatId + 4e9 }, { $set: { chatId: +maps[chatId] } }, fn))
                        .then(result => console.log('move info in collection', name, 'from chat', chatId, 'to chat', +maps[chatId], 'count', result.result.n));
                })).then(() => console.log('end move info in collection', name))
            }))
        })
        .then(() => {
            console.log('DONE');
            client.close();
        })
        .catch(error => {
            console.error(error);
            client.close();
        });

    // client.close();
});
