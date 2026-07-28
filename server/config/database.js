// Single entry point for the data layer. Picks the backend at startup:
//
//   MONGODB_URI set  -> MongoDB (used in production, e.g. Render + Atlas, where
//                       the container filesystem is ephemeral and a file-based
//                       store would lose every account on redeploy/restart).
//   otherwise        -> NeDB file store (local development).
//
// Tests always use NeDB (in-memory) so the suite needs no running database and
// stays isolated, even if MONGODB_URI happens to be exported in the shell.
//
// Both modules expose the identical surface (users/messages/groups + connect +
// connection), so nothing downstream needs to know which one is active.
const isTest = process.env.NODE_ENV === 'test';
const useMongo = Boolean(process.env.MONGODB_URI) && !isTest;

module.exports = useMongo
    ? require('./mongo')
    : require('./nedb');
