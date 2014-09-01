// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var port = process.env.OPENSHIFT_NODEJS_PORT ||  process.env.OPENSHIFT_INTERNAL_PORT || 3000;
var ipaddr = process.env.OPENSHIFT_NODEJS_IP || process.env.OPENSHIFT_INTERNAL_IP || "127.0.0.1";

var AES = require("crypto-js/aes");
var SHA256 = require("crypto-js/sha256");

server.listen( port, ipaddr, function() {
    console.log((new Date()) + ' Server is listening on port ' + port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom
var roomhash = SHA256(new Date().getTime().toString()).toString();

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

function toObject(arr) {
	  var rv = {};
	  for (var i = 0; i < arr.length; ++i)
	    if (arr[i] !== undefined) rv[i] = arr[i];
	  return rv;
	}

function toCSV(arr) 
{
	var rv = "";
    for (var i = 0; i < arr.length; ++i)
   	{
    	if (i > 1)
	    	rv = rv + ",";
    	rv = rv + arr[i];    	
   	}
	return rv;
}

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      sentTo: data.sentTo,
      message: data.message
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      userlist: usernames,
      roomhash: roomhash
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
      userlist: usernames
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers,
        userlist: usernames
       });
    }
  });
});
