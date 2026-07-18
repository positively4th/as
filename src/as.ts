// @ts-nocheck
import _ from "underscore";
import { v4 as uuidv4 } from "uuid";

type Proto = Record<string | symbol, any>;
type MixinId = string;
type MixinCreator<M extends object, R extends object> = (model: M) => R;

type PropRights = "r" | "w" | "rw";
type PropSpec<M extends object> =
  | PropRights
  | { rights: PropRights; default?: (model: M) => any };
type PropSpecs<M extends object> = Record<string, PropSpec<M>>;

type PropAccessor<V> = () => V;
type PropRW<V, Self> = {
  (): V;
  (value: V): Self;
};

const uuid = uuidv4();

const bareMixins = new WeakMap(); // bare/raw model -> { mixinId: proxy }
const initializedMixinIds = new WeakMap(); // proxy -> the mixinId it was created for

function MixinProto(proto: Proto = {}) {
  _.extendOwn(this, proto);
  this[uuid] = uuid;
  return this;
}

function inject<M extends object, R extends object>(
  model: M,
  mixinId: MixinId,
  mixin: M,
  proto = {}
) {
  if (!model[uuid] || model[uuid] !== uuid) {
    var p = new MixinProto(proto);
    p.constructor = model.__proto__.constructor;
    p.__proto__ = model.__proto__;

    model.__proto__ = p;
  }

  model.__proto__[mixinId] = mixin;
}

function addMixin<M extends object, R extends object>(
  mixinId: MixinId,
  mixinCreator: MixinCreator<M, R>,
  model: M,
  proto
): R {
  if (model[mixinId]) {
    return model[mixinId];
  }

  var mixin = mixinCreator(model);

  _.each(mixin, function (prop, key) {
    if (_.isFunction(prop)) {
      mixin[key] = prop.bind(model);
    } else {
      mixin[key] = prop;
    }
  });
  inject(model, mixinId, mixin, proto);
  //The mixin is injected in the mixin itself to allow code like ...asMixinName(asMixinName(model))
  inject(mixin, mixinId, mixin, proto);
  return mixin;
}

function addMixinV3<M extends object, R extends object>(
  mixinId: MixinId,
  mixinCreator: MixinCreator<M, R>,
  model: M
): M & R {
  if (initializedMixinIds.get(model) === mixinId) {
    throw new Error(
      `addMixinV3: mixin "${mixinId}" has already been applied to this value`
    );
  }

  if (!bareMixins.has(model)) {
    bareMixins.set(model, {});
  }

  const mixinMap = bareMixins.get(model);
  if (!mixinMap[mixinId]) {
    var mixin = mixinCreator(model);

    _.each(mixin, function (prop, key) {
      if (_.isFunction(prop)) {
        mixin[key] = prop.bind(model);
      } else {
        mixin[key] = prop;
      }
    });

    const handler = {
      // Mixins add behavior, not state (see asProps/mineAsYours) — like a
      // class's prototype methods, they're detectable via `in` but stay out
      // of Object.keys/JSON.stringify/for...in, which reflect model state only.
      get(obj, prop, receiver) {
        if (Object.prototype.hasOwnProperty.call(mixin, prop)) {
          return mixin[prop];
        }
        return Reflect.get(obj, prop, receiver);
      },
      has(obj, prop) {
        return (
          Object.prototype.hasOwnProperty.call(mixin, prop) ||
          Reflect.has(obj, prop)
        );
      },
      set(obj, prop, value, receiver) {
        if (Object.prototype.hasOwnProperty.call(mixin, prop)) {
          throw new Error(
            `addMixinV3: cannot set "${prop}" — it is a mixin-provided property`
          );
        }
        return Reflect.set(obj, prop, value, receiver);
      },
    };
    var proxy = new Proxy(model, handler);
    mixinMap[mixinId] = proxy;
    bareMixins.set(model, mixinMap);
    initializedMixinIds.set(proxy, mixinId);
  }
  return bareMixins.get(model)[mixinId];
}

function asProps<M extends object, R extends object>(
  mixin: R,
  propSpecs: PropSpecs<M>,
  model: M
): R {
  propSpecs = propSpecs || {};

  function getSet(key, val) {
    if (val === undefined) {
      return this[key];
    }
    this[key] = val;
    return mixin;
  }

  function get(key) {
    return this[key];
  }

  function set(key, val) {
    this[key] = val;
    return this;
  }

  var r, w, rights, useDef;
  _.each(propSpecs, function (spec, key) {
    if (typeof spec === "string") {
      rights = spec;
      useDef = false;
    } else {
      rights = spec.rights;
      useDef = spec.hasOwnProperty("default");
    }

    r = rights.indexOf("r") >= 0;
    w = rights.indexOf("w") >= 0;

    if (r && w) {
      mixin[key] = getSet.bind(model, key);
    } else if (w) {
      //Todo: Remove this stupid case?
      mixin[key] = set.bind(model, key);
    } else if (r) {
      mixin[key] = get.bind(model, key);
    }
    if (useDef && !model.hasOwnProperty(key)) {
      model[key] = spec.default(model);
    }
  });
  return mixin;
}

function mineAsYours(fs, my, yours) {
  function helper(f) {
    return function () {
      var res = f.apply(my, arguments);
      if (res === undefined) {
        return;
      }
      return res === my ? yours : res;
    };
  }

  yours = yours || {};
  _.each(fs, function (f) {
    yours[f] = helper(my[f]);
  });
  return yours;
}

// Export as ES module
export { addMixin, addMixinV3, asProps, mineAsYours };
export type { PropSpecs, PropAccessor, PropRW };

// Default export for convenience
export default {
  addMixin,
  addMixinV3,
  asProps,
  mineAsYours,
};
