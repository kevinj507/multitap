# The Auth Model

> A field guide to authentication **and** access control, written from
> Multitap's implementation but meant to be read by anyone starting a new
> project and unsure how to "do auth."

If you've just wired up Clerk (or Auth0, or NextAuth, or a Google sign-in
button) and you're still confused about what to do next, this document is for
you. The thing you installed answered one question. There's a second question
it didn't touch, and the second one is the part you have to design yourself.

---

## 1. The whole confusion, in one sentence

**Authentication tells you *who someone is*. Authorization tells you *what
they're allowed to do*. Clerk does the first. You build the second.**

People get stuck because the auth vendor's onboarding is so smooth that it
feels like the job is done. You drop in `<SignIn />`, a user object appears,
and... now what? The user object doesn't know that graph `x7k2` belongs to
Alice, that Bob was invited as a viewer, or that a stranger with the link
should be able to read but not edit. *None of that lives in Clerk.* It lives
in your database and your route handlers, and it's yours to design.

So the mental split to hold onto:

| Question | Name | Who answers it | Where it lives in Multitap |
|---|---|---|---|
| "Who is this request from?" | **Authentication** (authN) | A pluggable provider (Clerk, or nothing) | `src/auth/index.js`, `clerk.js`, `none.js`, `middleware.js` |
| "Can this person do this thing to this resource?" | **Authorization** (authZ) | **Your own code** | `src/auth/access.js`, `require.js`, every route handler |

The rest of this document walks through both, but spends most of its time on
the second one — because that's the part no library hands you.

---

## 2. Authentication: keep it narrow and swappable

The single most useful design decision Multitap made: **authentication is a
plugin with a tiny interface, and the rest of the app never imports it.**

The adapter (`src/auth/index.js`) is chosen once at boot from an
`AUTH_PROVIDER` env var. Each adapter implements the same small contract:

```
verify(req)        -> { providerUserId, email, displayName }  or  null
middlewares()      -> any framework middleware the provider needs
publishableKey()   -> the key the browser SDK needs (or undefined)
```

That's the *entire* surface area authentication exposes to the app. `verify()`
answers exactly one question — "who is this?" — and returns `null` when the
answer is "nobody / anonymous." There are two real adapters:

- **`none`** (the default): every request is anonymous. `verify()` returns
  `null`, no middleware is mounted, no SDK loads. This is the self-hosted,
  single-tenant mode. *Auth-off is a first-class mode, not a broken state.*
- **`clerk`**: reads Clerk's session JWT and returns the user's id/email/name.

Why this matters for *your* project: **the identity provider is a detail you
should be able to rip out.** If you bury `clerk.user.id` checks throughout your
route handlers, you've welded your business logic to a vendor. Instead, funnel
every provider through one `verify()` boundary that produces a plain,
provider-agnostic "who is this" answer, and write all your access logic against
*that*. Multitap's access predicates (next section) never mention Clerk —
they operate on a generic `user` row and database state. You could swap Clerk
for raw OAuth, magic links, or SAML by writing one new adapter, and not a
single access check would change.

### The middleware that resolves identity

One middleware, `verifyAuth` (`src/auth/middleware.js`), runs on every request
and attaches `req.user` (the identity) — or leaves it `null`. Three things
worth copying:

1. **It resolves identity from more than one source.** A browser sends a Clerk
   session JWT; a script/agent sends an app-issued bearer token (more in §8).
   `verifyAuth` checks the agent-token path first, then falls back to the
   provider. The discriminator is a token *prefix* (`gt_`) — app tokens start
   with it, Clerk JWTs don't — so the two credential types never collide.
2. **It never makes an access decision.** `verifyAuth` only answers "who," then
   always calls `next()`. It does not 403. It does not 401 a logged-out user.
   An anonymous request sails right through with `req.user = null`. Whether
   anonymous is *allowed* is a question for the access layer, per-route — not
   something the identity middleware should presume.
3. **It soft-fails to anonymous.** If the provider or DB hiccups, it logs and
   degrades to `req.user = null` rather than 500-ing every request. A transient
   identity failure shouldn't take down read access to public resources.

> The one hard 401 it *does* throw: a bearer token that's present but
> invalid/revoked. A forgotten credential should fail loudly, not silently
> degrade to "anonymous" and leave the operator wondering why their script's
> writes vanished.

---

## 3. Authorization: the model you actually design

This is the heart of it. Authentication gave you a `user` (or `null`). Now you
decide what they can do. Multitap copied **Google Docs' mental model**, which
is worth internalizing because it's the model most people already have in their
heads:

> A document has **one owner**. The owner can grant **specific people** named
> access. And there's a **general "anyone with the link" setting** that governs
> everyone else. Your effective access is the most generous of whatever applies
> to you.

Translated into the three inputs every access decision reads:

- **`graph.owner_user_id`** — the single owner. Full control. (= Google Docs
  "owner".)
- **`graph.anon_role`** — the general-access tier: `none` / `viewer` /
  `editor`. What *anyone who isn't the owner or a named member* gets. (=
  "Anyone with the link can view/edit" vs "Restricted".)
- **`member.role`** — an explicit per-person grant: `viewer` / `editor`,
  layered on top of the general tier. (= "Share with bob@…".)

> **Creating a graph — the orphan guard.** `owner_user_id` is stamped at
> creation from the authenticated caller. On an **accounts-enabled** instance an
> *unauthenticated* `POST /api/graphs` is **refused (`401`)** rather than
> silently creating an owner-less graph the caller can never find in "My
> graphs" — unless it opts in with `{"allow_anonymous": true}` (what the web UI
> sends for a signed-out user, who then auto-claims the graph on sign-in).
> Authenticated callers and no-auth instances are unaffected. Enforced in
> `src/routes/graphs.js`, gated on `authEnabled()` (`src/auth/index.js`).

And the three **capability levels** those inputs resolve to
(`src/auth/access.js`):

| Capability | Means | Who gets it |
|---|---|---|
| `canRead` | view the graph + its contents | owner, any member, or anon if tier ≥ `viewer` |
| `canEdit` | create/update/delete content | owner, `editor` members, or anon if tier = `editor` |
| `canManage` | change settings, share/unshare, change the tier, rotate the link, delete | **owner only** |

The predicates themselves are tiny and worth reading in full — the entire
authorization *policy* of the app is ~25 lines:

```js
export function canRead(user, graph, member) {
  if (!graph.owner_user_id) return true;          // legacy: URL-bearer
  if (user && graph.owner_user_id === user.id) return true;  // owner
  if (member) return true;                         // viewer or editor
  const anon = graph.anon_role || 'none';          // everyone else
  return anon === 'viewer' || anon === 'editor';
}

export function canEdit(user, graph, member) {
  if (!graph.owner_user_id) return true;
  if (user && graph.owner_user_id === user.id) return true;
  if (member && member.role === 'editor') return true;
  return (graph.anon_role || 'none') === 'editor';
}

// Owner-only on purpose: even an editor can't reshare, kick, retier, or delete.
export function canManage(user, graph) {
  if (!graph.owner_user_id) return true;
  if (!user) return false;
  return graph.owner_user_id === user.id;
}
```

Two design choices here that you should make deliberately in your own app:

- **Access is the *union* of layers, not a single role column.** A `viewer`
  member of an `editor`-tier graph can still edit (the open tier wins); a named
  `editor` of a `none`-tier graph can still edit (their explicit grant wins).
  There's no "what's my one role" — there's "what can I do," computed from all
  the layers that apply. This is why Google Docs feels intuitive and why a
  single `role` enum on the user usually isn't enough.
- **`manage` is deliberately *not* `edit + something`.** An editor can change
  content all day but cannot change *who else has access* or destroy the
  resource. Resharing, kicking members, flipping the access tier, rotating the
  link, and deletion are all owner-only. Separating "edit the thing" from
  "control access to the thing" prevents a collaborator from quietly widening
  the blast radius.

---

## 4. The link *is* the access surface

Multitap has no `/invite/<token>` URLs, no per-recipient links, no "accept
invitation" page. **There is exactly one URL per graph — `/g/<id>` — and it
serves everyone.** What you *get* when you open it depends on the access model,
not on which link you were handed.

The id is a 16-character random string from a 31-char alphabet (~2⁷⁹
possibilities — unguessable in practice). That unguessability is the privacy
floor: **the URL itself is a bearer token.** If you can produce the id, you've
cleared the first gate; the access model decides the rest:

| `anon_role` | A stranger opening `/g/<id>` gets… |
|---|---|
| `none` | **403.** Must be the signed-in owner or a named member. ("Restricted.") |
| `viewer` | **Read-only.** Anyone with the link can view. *(Multitap's default for new graphs — friendly-by-default for a collaboration tool.)* |
| `editor` | **Full edit.** Anyone with the link can change content. |

Consequences worth understanding before you copy this:

- **One link, tier set centrally.** You don't manage a pile of per-person
  links. You set the door's general setting once (`anon_role`) and hand out the
  same address to everyone. Specific people who need more than the general tier
  get an explicit member grant on top (§7).
- **Revocation = rotate the id.** Because the URL is the credential, "un-share
  with everyone who has the old link" is implemented as *changing the id*
  (`POST /…/rotate-id`, owner-only). Every previously shared link 404s at once;
  the database cascades the new id to all child rows. There's no per-link
  revocation list because there are no per-link tokens.
- **The trade-off you're accepting:** a bearer-URL model means a leaked link is
  leaked access (up to the tier you set). That's the same trade-off as a Google
  Doc "anyone with the link" share or an unguessable S3 URL. If your data can't
  tolerate that, you want `none` as the default tier and explicit members only
  — which this same model supports, just by changing the default.

---

## 5. Where access is enforced: the server, every time

This is the part the user who commissioned this doc most wanted spelled out,
because it's the most common and most dangerous misunderstanding:

> **The UI graying out a button is not access control. The API rejecting the
> request is access control. Build the second one; the first is just a
> courtesy.**

Here's the concrete flow in Multitap, and it's the flow you want in your app
too. Watch what happens when a read-only viewer tries to edit:

1. The viewer opens `/g/<id>`. The server returns the graph annotated with
   `viewer_can_edit: false` (computed server-side from `canEdit`).
2. The browser uses that hint to enter **read-only mode** — it hides edit
   affordances, disables dragging nodes (`cy.autoungrabify(true)`), and shows a
   "you're viewing read-only" banner. This is *purely UX.* It exists so the
   user isn't baited into edits that will fail.
3. Suppose the hint is stale, the user disabled JS, or someone's poking the API
   with `curl`. They issue the write anyway.
4. The write hits `requireGraph('edit')` (`src/auth/require.js`) **before any
   handler logic runs.** That middleware re-loads the graph from the database,
   re-loads the caller's membership, re-runs `canEdit`, and returns **403**.
   The optimistic edit dies at the boundary. Nothing is persisted.

```
Browser (optimistic) ───► PATCH /api/graphs/x7k2/tasks/9 ───► requireGraph('edit')
   "looks editable, I'll try"                                        │
                                                                     ├─ load graph row
                                                                     ├─ load caller membership
                                                                     ├─ canEdit(user, graph, member)?
                                                                     │     └─ false ─► 403, handler never runs
                                                                     └─ true ─► handler writes, bumps version
```

The principle, stated generally:

- **Every protected route is gated server-side, against live data.** In
  Multitap, the gate is a middleware (`requireGraph(level)`) that loads the
  resource (404 if missing), runs the predicate (403 if denied), and only then
  attaches `req.graph` and calls the handler. Routes pick the level they need:
  GET → `read`, write verbs → `edit`, and settings/share/delete → `manage`.
- **The client's idea of its own permissions is advisory.** `viewer_can_edit`
  is sent *for UX*, never trusted for enforcement. The frontend even has a
  fallback: if any write unexpectedly 403s, it re-probes the graph and drops
  into the locked-out state. The server is the single source of truth; the
  client merely tries to stay in sync with it.
- **Check at the boundary, on the real request.** Not in a `useEffect`, not in
  a route guard component, not by hiding a menu item. Those are all bypassable
  with the browser devtools open. The only check that counts is the one between
  the request and the database write.

If you take one thing from this document: **a user can always send the request
your UI tried to prevent. Assume they will. Put the real check on the server.**

---

## 6. What "anonymous" means (it depends on the deployment)

"Anonymous" isn't one thing — it depends on whether auth is on:

- **`AUTH_PROVIDER=none` (self-hosted, single-tenant):** *everyone* is
  anonymous. `req.user` is always `null`. Access falls entirely to `anon_role`
  (default `viewer`), and graphs created this way are owner-less, which makes
  them fully open by the legacy rule below. This is the right mode for "my
  team's internal tool behind a VPN" — no login friction, the network is the
  boundary.
- **`AUTH_PROVIDER=clerk` (multi-tenant):** an anonymous visitor is simply
  someone who isn't signed in. They get exactly what `anon_role` grants on each
  graph they visit, and nothing more — they can't own, can't be a named member,
  can't manage. Signing in upgrades them to an identity that *can* hold
  ownership and memberships.

**The legacy / owner-less rule.** A graph with `owner_user_id IS NULL` (created
before auth existed, or created anonymously on an auth-on deployment) behaves
as pure URL-bearer: anyone with the id can do anything, including manage. This
is Multitap's backward-compatibility seam — it preserves the pre-auth contract
forever rather than orphaning old data. A signed-in user can *claim* an
owner-less graph (`POST /…/claim`, succeeds only while owner is still null),
which pulls it into the owned-graph model. The lesson if you're adding auth to
an existing no-auth app: **decide explicitly what happens to pre-auth data**, and
make that rule visible in the access predicates rather than a silent default.

---

## 7. Granting specific people access

The general tier (`anon_role`) handles "everyone with the link." For "this
specific person gets more than that," there are named members — and a neat
trick for inviting people who don't have an account yet:

- **`graph_members`** — a real grant: `(graph_id, user_id, role)`. Created when
  the owner invites someone whose email already maps to a user.
- **`pending_members`** — `(graph_id, email, role)` for an invitee with *no
  account yet*. It sits dormant until that email signs in. On their first
  authenticated request, `verifyAuth` runs `claimPendingByEmail`, which
  converts every matching pending row into a real `graph_members` row inside one
  transaction (idempotent; the pending rows are deleted as they convert).

This is how Multitap invites people by email **without sending email** or
building an accept-invite flow. The invite waits in the database; the act of
signing in with that email address *is* the acceptance. If your app has no
transactional email set up yet, this pattern gets you "share with a coworker
who hasn't joined" for free.

(Changing the general tier is non-destructive to members: flipping a graph from
"anyone can view" back to "restricted" doesn't delete anyone's explicit grant —
narrowing the door doesn't revoke the keys you handed out individually.)

---

## 8. Machine identity is its own credential — and deliberately weaker

Browsers aren't the only clients. Multitap is driven by a Claude Code agent
that writes to graphs over the API with no browser session. That agent
authenticates with an **app-issued bearer token** (`agent_tokens`), and the
design choices around it are worth copying for any "API key" / "service token"
feature:

- **It's a distinct credential type, recognizable by prefix** (`gt_…`). The
  prefix is what lets one middleware route browser JWTs and agent tokens down
  different identity paths without ambiguity.
- **Only the hash is stored.** The plaintext is shown once at mint and never
  again. A database leak doesn't leak usable tokens. Revocation is a
  soft-delete (`revoked_at`) so a leaked token dies on its next use with no
  grace period, and you keep the audit trail.
- **It resolves to a user and inherits that user's access** — an agent token
  can do whatever its owner can do *to graphs*.
- **…but it's deliberately weaker than the human session.** An agent token
  **cannot mint or revoke tokens** (the `/api/me/agent_tokens` write routes
  require a *browser* session, not just any authenticated request). So a leaked
  agent token's blast radius is "can mess with this user's graphs," **not** "can
  escalate to full account takeover and spawn more credentials." Scoping a
  machine credential below the human credential that created it is a small
  decision that contains a lot of damage.

The general principle: **not all authenticated identities are equal.** "Is this
request authenticated?" and "what is *this kind* of authenticated caller allowed
to do?" are different questions. A service token should usually be able to do
*less* than the human who created it.

---

## 9. Who controls the model

Worth stating plainly because it's an access decision in itself: **only the
owner can change a graph's access model.** Changing the general tier, inviting
or kicking members, rotating the link, and deleting the graph all require
`canManage`, which is owner-only. An `editor` — even one with full content
access — cannot widen access, can't add collaborators, can't lock others out.

This keeps the answer to "who decided this resource is shared the way it is?"
to exactly one person. If you let editors reshare, you lose the ability to
reason about who exposed what.

---

## 10. A checklist for your own project

If you're standing at the start of a new project with Clerk installed and this
document open, here's the transferable core:

1. **Separate the two questions.** Have one narrow boundary that answers "who is
   this?" (your auth provider, behind an adapter) and a *separate* layer that
   answers "what can they do?" (your code). Don't let provider concepts leak
   into your access logic.
2. **Make auth-off a real mode.** Being able to run with no provider (everyone
   anonymous) keeps your access layer honest — it forces "anonymous" to be a
   first-class case you handled on purpose, not an afterthought.
3. **Model access as layers, computed into capabilities.** Owner + general tier
   + explicit grants → `canRead` / `canEdit` / `canManage`. Effective access is
   the union. Resist collapsing it to a single `role` column too early.
4. **Split "edit the thing" from "control access to the thing."** Make the
   second one owner-only.
5. **Enforce on the server, at the boundary, against live data — every route.**
   The UI's read-only mode is a courtesy to the user, never a security control.
   Assume the request your UI tried to prevent will arrive anyway.
6. **Decide your link/sharing model explicitly.** Unguessable-URL-as-bearer is
   simple and matches "anyone with the link"; per-recipient tokens are more
   controllable but more machinery. Pick one knowingly, and know how you'll
   *revoke*.
7. **Give machine clients their own, weaker credential.** Hash at rest, show
   once, revoke instantly, and scope it below the human who created it.
8. **Decide what happens to pre-auth / anonymously-created data** before you
   ship auth, and encode that rule where the access checks can see it.

---

### Where the real code lives (Multitap)

| Concern | File |
|---|---|
| Provider selector (the swappable boundary) | `src/auth/index.js` |
| Clerk / no-auth adapters | `src/auth/clerk.js`, `src/auth/none.js` |
| Identity resolution middleware | `src/auth/middleware.js` |
| The access policy (the 3 predicates) | `src/auth/access.js` |
| Per-route enforcement gate | `src/auth/require.js` |
| Where gates are wired to routes | `src/app.js` |
| Owner-only management routes | `src/routes/graphs.js` |
| Members + invite-by-email | `src/routes/members.js`, `src/auth/pending_members.js` |
| Agent (machine) tokens | `src/auth/agent_tokens.js`, `src/routes/me.js` |
| Schema for all of the above | `db/schema.sql` |
| Frontend read-only UX (the *courtesy* layer) | `public/app.js` (`applyReadOnlyState`, `authedFetch`) |
