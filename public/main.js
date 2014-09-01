$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $passwordInput = $('.passwordInput'); // Input for password
  var $sendToInput = $('.inputSendTo'); // Input for target user
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username = "";
  var sessionkey = "";
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var roomhash = "";
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "you are the only one logged in right now";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // do STASH authentication
  function doStashLogin() {

	  $.ajax({
		  type: "POST",
		  url: "https://api.stash.my/v0/session/start",
		  data: {"email": cleanInput($usernameInput.val().trim()), "passphrase": cleanInput($passwordInput.val().trim())},
		  success: function(data) {

			  if (data.ERROR == "1")
			  {
				  alert("Login error - " + data.MESSAGE);
				  return;
			  }
			  sessionkey = data.SESSIONKEY;
			  setUsername();
		  },
		  fail: function() {
			  alert('fail');
		  },
		  dataType: "json"
		});	  
	  
  }
  
  // stash this message for recipient
  function stashMessage(message) {

	  // see https://code.google.com/p/crypto-js/#Quick-start_Guide
	  var ciphertext = encodeURIComponent(CryptoJS.AES.encrypt(message, roomhash.substr(4,6)));
	  
	  $.ajax({
		  type: "POST",
		  url: "https://api.stash.my/v0/messages/send/text",
		  data: {"sessionId": sessionkey, "recipientEmail": $("#sendTo option:selected").text(), "message": ciphertext},
		  success: function(data) {

			  if (data.ERROR == "1")
			  {
				  alert("Message send error - " + data.MESSAGE);
				  return;
			  }

			  // display locally
		      addChatMessage({
		          username: username,
		          sentTo: $("#sendTo option:selected").text(),
		          message: message
		        });
			  
			  // tell server to execute 'new message' and send along the stash message id
		      socket.emit('new message', {
		    	  sentTo: $("#sendTo option:selected").text(),
		    	  message: data.MESSAGEID
		      });

		  },
		  fail: function() {
			  alert('fail');
		  },
		  dataType: "json"
		});	  
	  
  }

  // get message intended for me
  function getStashMessage(objMessage) {

	  $.ajax({
		  type: "GET",
		  url: "https://api.stash.my/v0/messages/"+objMessage.message+"/get",
		  data: {"sessionId": sessionkey},
		  xSentFrom: objMessage.username,
		  xSentTo: objMessage.sentTo,
		  success: function(data) {

			  if (data.ERROR == "1")
			  {
				  alert("Message retrieve error - " + data.MESSAGE);
				  return;
			  }

			  // decode
			  asctext = CryptoJS.AES.decrypt(unescape(data.RESULT.MESSAGE), roomhash.substr(4,6));

			  // display locally
		      addChatMessage({
		          username: this.xSentFrom,
		          sentTo: this.xSentTo,
		          message: asctext.toString(CryptoJS.enc.Utf8)
		        });
			  
		  },
		  fail: function() {
			  alert('fail');
		  },
		  dataType: "json"
		});	  
	  
  }


  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // populates the "send to" combo box with all users on the chat
  function updateUserCombo(objusers) 
  {
	  // get the current selected value
	  var selectbox = $('#sendTo');
	  var currvalue = $("#sendTo option:selected").text();

	  // clear the list of values
	  $('#sendTo option').remove();
	  
	  // populate user drop-down now
	  for(var propt in objusers)
	  {
		    //alert(propt + ': ' + objusers[propt]);
		    $('<option/>').val(objusers[propt]).html(objusers[propt]).appendTo('#sendTo');
	  }
	  
	  //set the selected value
/*	  if ((currvalue !== undefined) && (currvalue != ""))
		  for(var i = 0, j = selectbox.options.length; i < j; ++i) 
		  {
	        if(selectbox.options[i].innerHTML === currval) 
	        {
	        	selectbox.selectedIndex = i;
alert("DEBUG - found item " + i);
	        	break;
		    }
		  }*/

  
  }
  
  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      stashMessage(message);	// stash the message for delivery

    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }


  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      //$currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
    	
    	if (cleanInput($usernameInput.val().trim()).length == 0)
   		{
    		$usernameInput.focus();
   		}
    	else if (cleanInput($passwordInput.val().trim()).length == 0)
   		{
    		$passwordInput.focus();    		
   		}
    	
        if (username) {
        	sendMessage();
        	socket.emit('stop typing');
        	typing = false;
        } else {

        	doStashLogin();
        	//setUsername();
        }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    //$currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to StashChat powered by socket.IO and STASH!";
    log(message, {
      prepend: true
    });
    // Display the logged in as message
    var message = "You are logged in as " + username;
    log(message, {
      prepend: false
    });
    //alert('Got room hash: ' + data.roomhash);
    roomhash = data.roomhash;
    addParticipantsMessage(data);
    updateUserCombo(data.userlist);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
	  // is it for me ??
	  if (data.sentTo == username)
		  getStashMessage(data);
		  //addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
    updateUserCombo(data.userlist);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
    updateUserCombo(data.userlist);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });
});