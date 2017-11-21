var chai = require('chai');
var assert = chai.assert;
var _ = require('underscore');
var as = require('../src/as');
var uuid = require('uuid').v4;


/* --- user mixin module - start --- */
var userUUID = uuid();

var userPropSpecs = {
    "id": 'r',
    "username": 'rw',
    "password": 'rw',
    "dummyWO": 'w', //Todo: Remove this stupid case?
    "children": {
	"rights": 'rw',
	"default": function (model) { return []; }
    }
};  

function userCreator (model) {
    
    //Private functions
    var my = as.asProps({}, userPropSpecs, model);
    my.checkPassword = function (pwd) {
	return pwd === my.password();
    };

    //Public functions
    var yours = {};
    as.mineAsYours(_(userPropSpecs).keys(), my, yours);
    return yours;
}

var asUser = function (model) {
    return as.addMixin(userUUID, userCreator, model);
};

// module exports asUser

/* --- user mixin module - end --- */

describe('addMixin', function() {

    it('User Mixin', function (done) {
	var userModel = {
	    id: 'aId0',
	    username: 'aUsername0',
	    password: 'aPassword0',
	    dummyWO: 'aDummyWO0'
	    
	};
	var user = asUser(userModel);
	
	assert.equal(user.id(), 'aId0');
	assert.equal(user.username(), 'aUsername0');
	assert.equal(user.password(), 'aPassword0');
	assert.deepEqual(user.dummyWO(), userModel);

	userModel.id = 'aId1';
	userModel.username = 'aUsername1';
	userModel.password = 'aPassword1';
	userModel.dummyWO = 'aDummyWO1';
	assert.equal(user.id(), 'aId1');
	assert.equal(user.username(), 'aUsername1');
	assert.equal(user.password(), 'aPassword1');
	assert.equal(user.dummyWO(), userModel);

	user.id('aId2'); //no effect - readonly
	user.username('aUsername2');
	user.password('aPassword2');
	user.dummyWO('aDummyWO2');
	assert.equal(userModel.id, 'aId1');
	assert.equal(userModel.username, 'aUsername2');
	assert.equal(userModel.password, 'aPassword2');
	assert.equal(user.dummyWO(), userModel);
	
	done();
    });
    

    it('Should generate a default children array', function (done) {
	var userModel = {
	    id: 'aId0',
	    username: 'aUsername0',
	    password: 'aPassword0',
	    dummyWO: 'aDummyWO0'
	    
	};
	var user = asUser(userModel);
	
	assert.equal(user.id(), 'aId0');
	assert.equal(user.username(), 'aUsername0');
	assert.equal(user.password(), 'aPassword0');
	assert.deepEqual(user.dummyWO(), userModel);
	assert.deepEqual(user.children(), []);

	
	done();
    });
    
    it('Should generate keep supplied children array', function (done) {
	var userModel = {
	    id: 'aId0',
	    username: 'aUsername0',
	    password: 'aPassword0',
	    dummyWO: 'aDummyWO0',
	    children: ['c1', 'c2']
	};
	var user = asUser(userModel);
	
	assert.equal(user.id(), 'aId0');
	assert.equal(user.username(), 'aUsername0');
	assert.equal(user.password(), 'aPassword0');
	assert.deepEqual(user.dummyWO(), userModel);
	assert.deepEqual(user.children(), ['c1', 'c2']);

	
	done();
    });
    

});

	   

	   
