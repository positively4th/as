# positively4th.as — state description

## Purpose of the package

A small, dependency-light (`underscore`, `uuid`) mixin library for JavaScript/TypeScript.
It lets a plain object ("model") be composed with independent, orthogonal behaviors
("mixins") without inheritance — no class hierarchy, no `extends` chain, no diamond
problem. Each mixin is added under its own `mixinId`, so two unrelated mixins can be
layered on the same model without colliding, even if they happen to use the same method
names internally.

## Fundamental design principles

- **Behavior lives in mixins; state lives in the model.** A mixin creator reads/writes
  the model's own fields, but never carries data of its own. This is a convention, not
  enforced by the type system — it holds because every mixin creator in this codebase
  (and in known consumers, e.g. coacheshub) is written that way, not because anything
  stops you from doing otherwise.
- **mixinId-based namespacing avoids name collisions.** Contrast with PHP traits, which
  require explicit `insteadof`/`as` conflict resolution, or classes, which share one flat
  method namespace.
- **Structural typing over nominal.** A mixin creator's type (`MixinCreator<M, R>`)
  declares exactly the slice of the model it needs — never "the whole class" — so a
  narrow behavior never demands more information than it actually uses.
- **Mixin behavior mirrors class prototype methods, not instance state.** On
  `addMixinV3`'s proxy, mixin methods are detectable via `in` and callable, but excluded
  from `Object.keys`/`JSON.stringify`/`for...in` — deliberately matching how a real
  class's prototype methods behave relative to instance fields.
- **Idempotent by default, loud on misuse.** Applying the same mixin twice to the same
  model is a harmless cache hit. Feeding a mixin's own output back into itself under the
  same `mixinId` is almost certainly a bug, so `addMixinV3` throws instead of silently
  rebuilding it.
- **Mixin-owned behavior is protected.** Writing to a key that collides with a
  mixin-provided property throws, instead of silently succeeding with no observable
  effect (which would otherwise corrupt the model with a value nothing can ever read
  back through the mixin).

## Reference: how to use

**`addMixinV3(mixinId, mixinCreator, model)`** — the recommended entry point.
`mixinCreator: (model: M) => R` returns behavior only; `addMixinV3` returns a `Proxy`
typed `M & R`, so the model's own state and the mixin's methods are both visible through
it.

**`addMixin(mixinId, mixinCreator, model, proto)`** — the older, prototype-mutating
variant. Kept for compatibility; not recommended for new mixins. Mutates
`model.__proto__`, has no `has`/`set` trap guarantees, and silently no-ops (rather than
throwing) if a mixin is re-applied to its own output.

**`asProps(target, propSpecs, model)`** — generates `get`/`set` accessor functions from a
spec object onto `target` (conventionally the private `my` object). Each `propSpecs`
entry is `"r" | "w" | "rw"`, or `{ rights, default?: (model) => value }` for a default
value factory.

**`mineAsYours(keys, my, yours)`** — copies the given keys from a private `my` object to
a public `yours` object, rewriting any accessor that would return `my` (for fluent
chaining) to return `yours` instead, so callers never see the private object.

Canonical mixin shape:

```ts
function createXxxee(model: Model): XxxeePublic {
  const my = as.asProps({} as XxxeePrivate, xxxeePropSpecs, model);
  my.somePrivateHelper = () => /* ... */; // never exposed
  const yours = {} as XxxeePublic;
  as.mineAsYours(publicKeys, my, yours);
  return yours;
}
const asXxxee = (model: Model) => as.addMixinV3("xxxee", createXxxee, model);
```

Exported types: `MixinId`, `MixinCreator<M, R>`, `PropRights`, `PropSpec<M>`,
`PropSpecs<M>`, `PropAccessor<V>`, `PropRW<V, Self>`.

## List of ad hoc stuff

- `asProps`'s `"w"`-only rights case is a known wart: it binds a `set` function whose
  `this` is the **model**, so it returns the model, not the mixin — inconsistent with the
  `"rw"` case's setter branch, which returns the mixin for fluent chaining. There's a
  `//Todo: Remove this stupid case?` comment in the source acknowledging this.
- `asProps`'s first parameter is named `mixin`, but every real call site actually passes
  what's conventionally the private `my` object — a naming mismatch left over from before
  the `my`/`yours` split existed.
- `addMixinV3` (Proxy) and `addMixin` (prototype) disagree on self-reapplication:
  `addMixinV3` throws, `addMixin` silently returns a cached no-op via its own
  self-injection trick. Not reconciled — `addMixin` is legacy and not being actively
  extended.
- No `ownKeys`/`getOwnPropertyDescriptor` trap on `addMixinV3`'s proxy. This is
  deliberate, not an oversight: mixins are meant to be non-enumerable behavior, like
  class prototype methods, so `Object.keys`/`JSON.stringify` correctly show only model
  state as a result.
- No `set` trap protection exists on `addMixin` (the prototype variant) at all — that
  guard only exists on `addMixinV3`.
- `// @ts-nocheck` at the top of `src/as.ts` means the implementation itself is never
  type-checked — only the exported signatures are, and only insofar as something actually
  imports and uses them. Internal correctness relies entirely on the test suite.
- `mineAsYours`'s `my`/`yours` substitution is an exact `===` identity check
  (`res === my ? yours : res`), not a structural one — a method that returns some other
  object shaped like `my` (but not literally `my`) won't get substituted.

## Todo list

- Add a `CHANGELOG.md` — flagged during the `3.0.0` work, not yet created.
- Decide `addMixin`'s long-term status: keep as-is (documented divergence), formally
  deprecate (`@deprecated`), or eventually remove. Discussed, no decision made.
- Give `addMixinV3`'s thrown errors a distinguishable `.name`/type instead of plain
  `Error` with only a message, so consumers can catch/distinguish "already applied" vs
  "cannot set" without regex-matching `.message`.
- Consider whether `asProps`'s types can either fix or at least honestly reflect the
  `"w"`-only inconsistency — `PropRW` currently assumes `"rw"`-consistent behavior.
- Push this session's 4 commits to `origin/master` once reviewed — currently local-only
  on the `asV3` checkout.
- `npm publish 3.0.0` once pushed — blocked earlier by a broken/expired npm auth token
  (`npm whoami` returned 401); unresolved.
- Check coacheshub (pinned to `^2.0.3`, a known real consumer) against `3.0.0` before or
  as part of any upgrade there — `revisionee.ts`/`idcanvasitemmapee.ts` expose generic
  method names (`get`/`set`/`filter`/`remove`) that are the most exposed surface if a
  model ever gains a same-named data field.
