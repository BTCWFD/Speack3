// MongoDB backend exposing the exact same surface the models already use with
// NeDB (insert / findOne / find / update / remove + a chainable cursor), so
// models/*.js need no per-backend branching. Selected by config/database.js
// when MONGODB_URI is set; otherwise the NeDB file store is used.
//
// IMPORTANT: _id stays a STRING (as NeDB generated it) instead of an ObjectId.
// JWT payloads, group.members[] and message.recipient all store bare id strings
// and are compared directly, so switching to ObjectId would silently break every
// cross-reference. Mongo accepts any _id type, so we keep generating our own.
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// 16 hex chars, matching the shape of the ids NeDB produced.
const newId = () => crypto.randomBytes(8).toString('hex');

let client = null;
let db = null;

const requireDb = () => {
    if (!db) {
        throw new Error('MongoDB used before connect() completed');
    }
    return db;
};

// Mirrors NeDB's cursor: chainable *and* directly awaitable (NeDB resolves to an
// array without an explicit .toArray(), and Message.find() relies on that).
class Cursor {
    constructor(cursor) {
        this.cursor = cursor;
    }

    sort(spec) {
        this.cursor = this.cursor.sort(spec);
        return this;
    }

    limit(n) {
        this.cursor = this.cursor.limit(n);
        return this;
    }

    skip(n) {
        this.cursor = this.cursor.skip(n);
        return this;
    }

    then(onFulfilled, onRejected) {
        return this.cursor.toArray().then(onFulfilled, onRejected);
    }
}

class Collection {
    constructor(name) {
        this.name = name;
    }

    get raw() {
        return requireDb().collection(this.name);
    }

    // NeDB returns the inserted document (with its generated _id); callers rely
    // on that to read back user._id right after create().
    async insert(doc) {
        const toInsert = { _id: newId(), ...doc };
        await this.raw.insertOne(toInsert);
        return toInsert;
    }

    async findOne(query) {
        return this.raw.findOne(query);
    }

    find(query = {}) {
        return new Cursor(this.raw.find(query));
    }

    // NeDB's update defaults to a single document; with no $-operators it
    // replaces the doc rather than merging, so mirror both behaviours.
    async update(query, modifier, options = {}) {
        const hasOperators = Object.keys(modifier).some((key) => key.startsWith('$'));

        if (!hasOperators) {
            const result = await this.raw.replaceOne(query, modifier);
            return result.modifiedCount;
        }

        const result = options.multi
            ? await this.raw.updateMany(query, modifier)
            : await this.raw.updateOne(query, modifier);
        return result.modifiedCount;
    }

    async remove(query, options = {}) {
        const result = options.multi
            ? await this.raw.deleteMany(query)
            : await this.raw.deleteOne(query);
        return result.deletedCount;
    }
}

const collections = {
    users: new Collection('users'),
    messages: new Collection('messages'),
    groups: new Collection('groups'),
    products: new Collection('products'),
    orders: new Collection('orders'),
    deliverySlots: new Collection('deliverySlots')
};

module.exports = {
    users: collections.users,
    messages: collections.messages,
    groups: collections.groups,
    products: collections.products,
    orders: collections.orders,
    deliverySlots: collections.deliverySlots,

    connect: async () => {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        // The database name comes from the connection string; fall back to a
        // sensible default when the URI omits it (Atlas URIs often do).
        db = client.db(process.env.MONGODB_DB || undefined);

        // Same uniqueness guarantees the NeDB store declared.
        await collections.users.raw.createIndex({ email: 1 }, { unique: true });
        await collections.users.raw.createIndex({ username: 1 }, { unique: true });

        console.log(`✅ MongoDB Connected (${db.databaseName})`);
    },

    connection: {
        readyState: 1,
        get host() {
            return db ? db.databaseName : 'mongodb-disconnected';
        },
        // server.js calls close(false, callback) on SIGTERM.
        close: (force, callback) => {
            const done = client ? client.close() : Promise.resolve();
            return done.then(() => {
                if (typeof callback === 'function') callback();
            });
        }
    }
};
