// Integration tests for the MongoDB backend (config/mongo.js) against a real
// mongod, covering the exact surface models/*.js rely on.
//
// These require the adapter DIRECTLY rather than through config/database.js:
// the dispatcher deliberately forces NeDB under NODE_ENV=test, so going through
// it here would silently test the wrong backend.
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let mongo;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB = 'speack3_adapter_test';
    mongo = require('../config/mongo');
    await mongo.connect();
}, 180000);

afterAll(async () => {
    if (mongo) await mongo.connection.close(false);
    if (mongod) await mongod.stop();
});

beforeEach(async () => {
    await mongo.messages.remove({}, { multi: true });
    await mongo.groups.remove({}, { multi: true });
    await mongo.users.remove({ email: { $ne: null } }, { multi: true });
});

describe('document ids', () => {
    // The whole migration hinges on this: JWTs carry userId as a bare string and
    // group.members[] / message.recipient store plain id strings. If inserts
    // started producing ObjectIds, every lookup by id would quietly return null.
    it('generates string ids that can be looked up as strings', async () => {
        const inserted = await mongo.users.insert({
            username: 'ana', email: 'ana@example.com', password: 'x'
        });

        expect(typeof inserted._id).toBe('string');
        expect(inserted._id).toMatch(/^[0-9a-f]{16}$/);

        const found = await mongo.users.findOne({ _id: inserted._id });
        expect(found).not.toBeNull();
        expect(found.username).toBe('ana');
    });

    it('returns the inserted document, as callers read _id straight after create', async () => {
        const doc = await mongo.groups.insert({ name: 'equipo', members: ['u1'] });
        expect(doc.name).toBe('equipo');
        expect(doc._id).toBeDefined();
    });
});

describe('find cursor', () => {
    beforeEach(async () => {
        // Insert out of chronological order so sorting is actually exercised.
        await mongo.messages.insert({ recipient: 'u1', body: 'b', createdAt: new Date(2026, 0, 2) });
        await mongo.messages.insert({ recipient: 'u1', body: 'a', createdAt: new Date(2026, 0, 1) });
        await mongo.messages.insert({ recipient: 'u2', body: 'c', createdAt: new Date(2026, 0, 3) });
    });

    it('is awaitable directly, without an explicit toArray()', async () => {
        const all = await mongo.messages.find({});
        expect(Array.isArray(all)).toBe(true);
        expect(all).toHaveLength(3);
    });

    it('filters by query', async () => {
        const mine = await mongo.messages.find({ recipient: 'u1' });
        expect(mine).toHaveLength(2);
    });

    it('supports chained sort/limit/skip', async () => {
        const sorted = await mongo.messages.find({}).sort({ createdAt: 1 });
        expect(sorted.map((m) => m.body)).toEqual(['a', 'b', 'c']);

        const firstTwo = await mongo.messages.find({}).sort({ createdAt: 1 }).limit(2);
        expect(firstTwo.map((m) => m.body)).toEqual(['a', 'b']);

        const afterFirst = await mongo.messages.find({}).sort({ createdAt: 1 }).skip(1);
        expect(afterFirst.map((m) => m.body)).toEqual(['b', 'c']);
    });

    it('returns an empty array when nothing matches', async () => {
        expect(await mongo.messages.find({ recipient: 'nobody' })).toEqual([]);
    });
});

describe('update', () => {
    it('applies $set without dropping untouched fields', async () => {
        const g = await mongo.groups.insert({ name: 'viejo', members: ['u1'] });
        await mongo.groups.update({ _id: g._id }, { $set: { name: 'nuevo' } });

        const after = await mongo.groups.findOne({ _id: g._id });
        expect(after.name).toBe('nuevo');
        expect(after.members).toEqual(['u1']);
    });

    it('applies $addToSet and $pull, used for group membership', async () => {
        const g = await mongo.groups.insert({ name: 'g', members: ['u1'] });

        await mongo.groups.update({ _id: g._id }, { $addToSet: { members: 'u2' } });
        expect((await mongo.groups.findOne({ _id: g._id })).members).toEqual(['u1', 'u2']);

        // $addToSet must stay idempotent, or re-adding a member would duplicate.
        await mongo.groups.update({ _id: g._id }, { $addToSet: { members: 'u2' } });
        expect((await mongo.groups.findOne({ _id: g._id })).members).toEqual(['u1', 'u2']);

        await mongo.groups.update({ _id: g._id }, { $pull: { members: 'u1' } });
        expect((await mongo.groups.findOne({ _id: g._id })).members).toEqual(['u2']);
    });

    it('only touches one document by default, like NeDB', async () => {
        await mongo.messages.insert({ recipient: 'u1', delivered: false });
        await mongo.messages.insert({ recipient: 'u1', delivered: false });

        await mongo.messages.update({ recipient: 'u1' }, { $set: { delivered: true } });

        const delivered = await mongo.messages.find({ delivered: true });
        expect(delivered).toHaveLength(1);
    });

    it('updates every match when multi is set', async () => {
        await mongo.messages.insert({ recipient: 'u1', delivered: false });
        await mongo.messages.insert({ recipient: 'u1', delivered: false });

        await mongo.messages.update({ recipient: 'u1' }, { $set: { delivered: true } }, { multi: true });

        expect(await mongo.messages.find({ delivered: true })).toHaveLength(2);
    });
});

describe('remove', () => {
    it('deletes a single matching document', async () => {
        const m = await mongo.messages.insert({ body: 'borrame' });
        await mongo.messages.remove({ _id: m._id });
        expect(await mongo.messages.findOne({ _id: m._id })).toBeNull();
    });
});

describe('unique indexes', () => {
    // config/nedb.js declared these; losing them on Mongo would let duplicate
    // accounts through whenever two registrations race past the pre-check.
    it('rejects a duplicate email', async () => {
        await mongo.users.insert({ username: 'uno', email: 'dup@example.com', password: 'x' });
        await expect(
            mongo.users.insert({ username: 'dos', email: 'dup@example.com', password: 'x' })
        ).rejects.toThrow();
    });

    it('rejects a duplicate username', async () => {
        await mongo.users.insert({ username: 'repetido', email: 'a@example.com', password: 'x' });
        await expect(
            mongo.users.insert({ username: 'repetido', email: 'b@example.com', password: 'x' })
        ).rejects.toThrow();
    });
});
