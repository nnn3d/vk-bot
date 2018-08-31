

const MongoClient = require('mongodb').MongoClient;
const pf = require('./helpers/promiseFactory');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'bot486809653';
const selfId = 475932064;
const botId = 486809653;

const chats = [
    2000015033,
    2000004837,
    2000017383,
    2000011301,
    2000004294,
]

// Use connect method to connect to the server
MongoClient.connect(url, function(err, client) {
    console.log("Connected successfully to server");

    const db = client.db(dbName);
    pf.dcbp(fn => db.collection('anticaptchabotchats').find({
            selfChatId: { $in: chats },
            selfId,
            botId,
        }).toArray(fn))
        .then(result => {
            console.log(result)
            console.log(result.map(r => r.botChatId))
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
