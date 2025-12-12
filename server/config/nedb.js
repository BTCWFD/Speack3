// Simple NeDB wrapper
const Datastore = require('nedb-promises');
const path = require('path');

const dbPath = path.join(__dirname, '../data');

const collections = {
    users: Datastore.create({
        filename: path.join(dbPath, 'users.db'),
        autoload: true
    }),
    messages: Datastore.create({
        filename: path.join(dbPath, 'messages.db'),
        autoload: true
    }),
    groups: Datastore.create({
        filename: path.join(dbPath, 'groups.db'),
        autoload: true
    })
};

// Create indexes
collections.users.ensureIndex({ fieldName: 'email', unique: true });
collections.users.ensureIndex({ fieldName: 'username', unique: true });

module.exports = {
    users: collections.users,
    messages: collections.messages,
    groups: collections.groups,
    connect: () => {
        console.log('✅ NeDB Connected (File-based database)');
        return Promise.resolve();
    },
    connection: {
        readyState: 1,
        host: 'nedb-local',
        close: () => Promise.resolve()
    }
};
