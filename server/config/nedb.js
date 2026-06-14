// Simple NeDB wrapper
const Datastore = require('nedb-promises');
const path = require('path');

const dbPath = path.join(__dirname, '../data');

// Under tests, keep every datastore purely in memory so runs stay isolated and
// never touch server/data/*.db. Jest sets NODE_ENV=test automatically.
const isTest = process.env.NODE_ENV === 'test';

const storeOptions = (fileName) => (
    isTest
        ? { inMemoryOnly: true, autoload: true }
        : { filename: path.join(dbPath, fileName), autoload: true }
);

const collections = {
    users: Datastore.create(storeOptions('users.db')),
    messages: Datastore.create(storeOptions('messages.db')),
    groups: Datastore.create(storeOptions('groups.db'))
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
