// Require helpers first so NODE_ENV/JWT secrets are set before the app loads.
const { registerUser } = require('./helpers');
const request = require('supertest');
const { app } = require('../server');

// Create a group owned by `admin`, optionally seeding extra member ids.
async function createGroup(admin, members = []) {
    return request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Test Group', members: members.length ? members : [admin.id] });
}

describe('POST /api/groups', () => {
    it('creates a group with the creator as admin and initialized settings', async () => {
        const admin = await registerUser(app);
        const res = await createGroup(admin);

        expect(res.status).toBe(201);
        const group = res.body.group;
        expect(group).toBeDefined();
        expect(group.admin).toBe(admin.id);
        expect(group.members).toContain(admin.id);
        // settings must always be present so consumers can read it safely.
        expect(group.settings).toBeDefined();
        expect(group.settings.memberCanAddOthers).toBe(false);
        expect(group.settings.onlyAdminCanPost).toBe(false);
    });

    it('requires authentication', async () => {
        const res = await request(app)
            .post('/api/groups')
            .send({ name: 'No Auth', members: ['x'] });
        expect(res.status).toBe(401);
    });
});

describe('PUT /api/groups/:id/members (add)', () => {
    it('grows the members array when the admin adds a member (guards $addToSet)', async () => {
        const admin = await registerUser(app);
        const newcomer = await registerUser(app);

        const created = await createGroup(admin);
        const groupId = created.body.group._id;
        const before = created.body.group.members.length;

        const res = await request(app)
            .put(`/api/groups/${groupId}/members`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ members: [newcomer.id] });

        expect(res.status).toBe(200);
        expect(res.body.group.members).toContain(newcomer.id);
        expect(res.body.group.members.length).toBe(before + 1);
    });

    it('does not duplicate an already-present member ($addToSet semantics)', async () => {
        const admin = await registerUser(app);
        const created = await createGroup(admin);
        const groupId = created.body.group._id;
        const before = created.body.group.members.length;

        // admin.id is already a member -> adding it again must be a no-op.
        const res = await request(app)
            .put(`/api/groups/${groupId}/members`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ members: [admin.id] });

        expect(res.status).toBe(200);
        expect(res.body.group.members.length).toBe(before);
    });

    it('forbids a non-admin from adding members', async () => {
        const admin = await registerUser(app);
        const outsider = await registerUser(app);
        const created = await createGroup(admin);
        const groupId = created.body.group._id;

        const res = await request(app)
            .put(`/api/groups/${groupId}/members`)
            .set('Authorization', `Bearer ${outsider.token}`)
            .send({ members: [outsider.id] });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /api/groups/:id/members/:memberId (remove)', () => {
    it('shrinks the members array when the admin removes a member (guards $pull)', async () => {
        const admin = await registerUser(app);
        const member = await registerUser(app);

        const created = await createGroup(admin, [admin.id, member.id]);
        const groupId = created.body.group._id;
        const before = created.body.group.members.length;
        expect(created.body.group.members).toContain(member.id);

        const res = await request(app)
            .delete(`/api/groups/${groupId}/members/${member.id}`)
            .set('Authorization', `Bearer ${admin.token}`);

        expect(res.status).toBe(200);

        // Re-fetch to confirm the member is actually gone.
        const fetched = await request(app)
            .get(`/api/groups/${groupId}`)
            .set('Authorization', `Bearer ${admin.token}`);
        expect(fetched.status).toBe(200);
        expect(fetched.body.group.members).not.toContain(member.id);
        expect(fetched.body.group.members.length).toBe(before - 1);
    });

    it('forbids a non-admin from removing members', async () => {
        const admin = await registerUser(app);
        const member = await registerUser(app);
        const created = await createGroup(admin, [admin.id, member.id]);
        const groupId = created.body.group._id;

        const res = await request(app)
            .delete(`/api/groups/${groupId}/members/${member.id}`)
            .set('Authorization', `Bearer ${member.token}`);

        expect(res.status).toBe(403);
    });
});
