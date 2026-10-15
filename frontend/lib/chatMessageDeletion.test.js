const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const conversationId = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';
const source = fs.readFileSync(path.join(__dirname, '../app/api/chat/conversations/[id]/messages/[messageId]/route.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });

async function handler({ authenticated = true, member = true, sender = 'alice', missing = false, dbError = null } = {}) {
  const operations = [];
  const db = {
    from(table) {
      const operation = { table, deleting: false, filters: [] };
      operations.push(operation);
      return {
        select() { return this; },
        eq(column, value) { operation.filters.push([column, value]); return this; },
        delete() { operation.deleting = true; return this; },
        async maybeSingle() {
          if (dbError) return { data: null, error: dbError };
          if (table === 'conversation_members') return { data: member ? { id: 'membership' } : null, error: null };
          return { data: missing ? null : { id: messageId, conversation_id: conversationId, sender_id: sender }, error: null };
        },
      };
    },
  };
  const policy = await import('./chatMessagePolicy.ts');
  const json = (body, options = {}) => ({ body, status: options.status ?? 200 });
  const imports = {
    'next/server': { NextResponse: { json } },
    '@/lib/api-error': { apiError: (code, message, status) => json({ error: { code, message } }, { status }) },
    '@/lib/chatMessagePolicy': policy,
    '@/lib/server/supabaseServer': {
      getUserFromRequest: async () => ({ user: authenticated ? { id: 'alice' } : null }),
      getSupabaseAdmin: () => db,
    },
  };
  const exports = {};
  vm.runInNewContext(outputText, { exports, console: { error() {} }, require: (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } });
  const response = await exports.DELETE({}, { params: Promise.resolve({ id: conversationId, messageId }) });
  return { response, operations };
}

test('delete handler rejects unauthenticated users, nonmembers and other senders before any deletion', async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ member: false }, 403], [{ sender: 'bob' }, 403]]) {
    const { response, operations } = await handler(options);
    assert.equal(response.status, status);
    assert.equal(operations.some((operation) => operation.deleting), false);
  }
});

test('delete handler scopes the actual mutation to message, conversation and authenticated sender', async () => {
  const { response, operations } = await handler();
  assert.equal(response.status, 200);
  assert.deepEqual(operations.find((operation) => operation.deleting).filters, [
    ['id', messageId], ['conversation_id', conversationId], ['sender_id', 'alice'],
  ]);
  assert.deepEqual(operations[0].filters, [['conversation_id', conversationId], ['user_id', 'alice']]);
});

test('deletion retries succeed after removal and database errors remain safe failures', async () => {
  assert.equal((await handler({ missing: true })).response.status, 200);
  const { response } = await handler({ dbError: { message: 'private SQL diagnostic' } });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.doesNotMatch(JSON.stringify(response.body), /private SQL/);
});
