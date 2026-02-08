// @ts-nocheck
import _ from "underscore";
import { v4 as uuidv4 } from "uuid";

type Proto = Record<string | symbol, any>;
type MixinId = string;
type MixinCreator<M extends object, R extends object> = (model: M) => R & M;

const uuid = uuidv4();

const memory = new WeakMap();

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
  mixinCreator: MixinCreator,
  model: M,
  proto
) {
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

function addProxyMixin<M, R>(
  mixinId: MixinId,
  mixinCreator: MixinCreator,
  model: M
): M & R {
  if (!memory.has(model)) {
    memory.set(model, {});
  }

  const mixinMap = memory.get(model);
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
      get(obj, prop, receiver) {
        if (prop in mixin) {
          return mixin[prop];
        }
        return Reflect.get(obj, prop, receiver);
      },
    };
    // console.debug("as.js: addProxyMixin", mixinId, model);
    mixinMap[mixinId] = new Proxy(model, handler);
    memory.set(model, mixinMap);
  }
  return memory.get(model)[mixinId];
}

function asProps<M extends object, R extends object>(
  mixin: R,
  propSpecs: PropSpecs,
  model: M
) {
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
export { addMixin, addProxyMixin, asProps, mineAsYours };

// Default export for convenience
export default {
  addMixin,
  addProxyMixin,
  asProps,
  mineAsYours,
};
