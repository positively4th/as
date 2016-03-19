var _ = require('underscore'); 
var uuid = require('uuid').v4; 

function MixinProto() {
    this[uuid] = uuid;
    return this;
}

function inject (model, mixinId, mixin) {
    if (!model[uuid] || model[uuid] === uuid) {
	var p = new MixinProto();
	p.__proto__ = model.__proto__;
	model.__proto__ = p;
    }
    model.__proto__[mixinId] = mixin;
}


function addMixin(mixinId, mixinCreator, model) {
//    console.log('addMixin', arguments);

    mixinId = mixinId;
    if (model[mixinId]) {
	return model[mixinId];
    }
    
    var mixin = mixinCreator(model);

//    console.log('mixin', mixin);

    _(mixin).each(function (prop, key) {
	if (_(prop).isFunction()) {
	    mixin[key] = prop.bind(model);
	} else {
	    mixin[key] = prop;
	}			    
    });
    inject(model, mixinId, mixin);
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
    
    var r,w;
    _(propSpecs).each(function (spec, key) {
	r = spec.indexOf('r') >= 0;
	w = spec.indexOf('w') >= 0;
	if (r && w) {
	    mixin[key] = getSet.bind(model, key);
	} else if (w) { //Todo: Remove this stupid case?
	    mixin[key] = set.bind(model, key);
	} else if (r) {
	    mixin[key] = get.bind(model, key);
	}
    });
    return mixin;
}


        
mineAsYours = function (fs, my, yours) {
    
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
