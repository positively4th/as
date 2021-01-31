var _ = require('underscore');
var uuid = require('uuid').v4();

function MixinProto(proto={}) {
    _.extendOwn(this, proto);
    this[uuid] = uuid;
    return this;
}

function inject (model, mixinId, mixin, proto={}) {

    if (!model[uuid] || model[uuid] !== uuid) {
        var p = new MixinProto(proto);
        p.constructor = model.__proto__.constructor;
        p.__proto__ = model.__proto__;

        model.__proto__ = p;

/*
        if (proto) {
            var _proto = _.extendOwn({}, proto);
            _proto.__proto__ = p.__proto__;
            p.__proto__ = _proto; 
        }
*/
    }
    
    model.__proto__[mixinId] = mixin;
}


function addMixin(mixinId, mixinCreator, model, proto) {
  if (model[mixinId]) {
    return model[mixinId];
  }

  var mixin = mixinCreator(model);

  _(mixin).each(function (prop, key) {
    if (_(prop).isFunction()) {
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

function asProps(mixin, propSpecs, model) {
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

    var r,w,rights, useDef;
  _(propSpecs).each(function (spec, key) {
      
      if (typeof spec === 'string') {
	  rights = spec;
	  useDef = false;
      } else {
	  rights = spec.rights;
	  useDef = spec.hasOwnProperty('default');
      }	  

      r = rights.indexOf('r') >= 0;
      w = rights.indexOf('w') >= 0;
      
      if (r && w) {
	  mixin[key] = getSet.bind(model, key);
      } else if (w) { //Todo: Remove this stupid case?
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

  function helper (f) {
    return function () {
      var res = f.apply(my, arguments);
      if (res === undefined) {
        return;
      }
      return res === my ? yours : res;
    };
  }

  yours = yours || {};
  _(fs).each(function (f) {
    yours[f] = helper(my[f]);
  });
  return yours;
};

module.exports = {
  addMixin: addMixin,
  asProps: asProps,
  mineAsYours: mineAsYours
};
