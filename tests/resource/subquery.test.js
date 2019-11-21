'use strict';

var Promise = require('bluebird'),
    request = require('request'),
    expect = require('chai').expect,
    rest = require('../../lib'),
    test = require('../support');

describe('Resource(with subquery false or true)', function() {
  beforeEach(function() {
    test.models.User = test.db.define('users', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      username: {
        type: test.Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: test.Sequelize.STRING,
        unique: { msg: 'must be unique' },
        validate: { isEmail: true }
      }
    }, {
      underscored: true,
      timestamps: false
    });

    test.models.Hobby = test.db.define('hobby', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: test.Sequelize.STRING }
    }, {
      underscored: true,
      timestamps: false
    });

    test.models.User.belongsToMany(test.models.Hobby, {
      as: 'hobbies',
      through: 'user_hobbies',
      timestamps: false
    });
    test.models.Hobby.belongsToMany(test.models.User, {
      as: 'users',
      through: 'user_hobbies',
      timestamps: false
    });

    const createUsersWithHobbies = (test) => {
      
      const userList = Array(100).fill().map(
        (v, i) => ({ username: 'username_' + i, email: 'arthur_' + i + '@gmail.com' })
      );
      const hobbyList = [
        { name: 'reading' },
        { name: 'bowling' },
        { name: 'running' },
        { name: 'swimming' },
        { name: 'coding' }
      ];

      return Promise.all([
        test.models.User.bulkCreate(userList),
        test.models.Hobby.bulkCreate(hobbyList),
      ]).then(function(){
        return Promise.all([
          test.models.User.findAll(),
          test.models.Hobby.findAll(),
        ]).then(function(results){
          const users = results[0];
          const hobbies = results[1];
          return Promise.all(
            users.map((u, i) => u.setHobbies(hobbies))
          );
        });
      });
    };

    test.initResource = (subQuery) => {
      rest.initialize({ app: test.app, sequelize: test.Sequelize });
        const userResource = rest.resource({
          model: test.models.User,
          endpoints: ['/users', '/users/:id'],
          include: [
            {
              model: test.models.Hobby,
              as: 'hobbies',
            },
          ],
        });

        userResource.attributes = [
          'username',
          'id',
          'email',
        ];
        
        userResource.list.fetch.before(function(req, res, context) {
          context.options = {
            subQuery: subQuery,
          };
          return context.continue;
        });
    };
    
    return Promise.all([ test.initializeDatabase(), test.initializeServer() ])
      .then(function() {
        return createUsersWithHobbies(test);
      });
  });

  afterEach(function() {
    return test.clearDatabase()
      .then(function() { test.closeServer(); });
  });

    
  it('returns the correct number of records with subquery true', function(done) {
    test.initResource(true);

    request.get({ url: test.baseUrl + '/users?count=10' }, function(err, response, body) {
      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-range']).to.equal('items 0-9/100');
      var records = JSON.parse(body);
      expect(records.length).to.equal(10);
      records.forEach(r => {
        expect(r.hobbies.length).to.equal(5);
      });
      done();
    });
      
  });

  it('Expect bad behavior: returns the wrong number of records with subquery false', function(done) {
    test.initResource(false);
    request.get({ url: test.baseUrl + '/users?count=10' }, function(err, response, body) {
      expect(response.headers['content-range']).to.not.equal('items 0-9/100');
      done();
    });
      
  });
      

});
