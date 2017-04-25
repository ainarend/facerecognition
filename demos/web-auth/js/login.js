// Cross broweser.
navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

window.URL = window.URL ||
    window.webkitURL ||
    window.msURL ||
    window.mozURL;

$(function() {
	
	var username = "";

     	var socket, socketName;
	var defaultTok = 1, defaultNumNulls = 20;
	var tok = defaultTok,
	    people = [], defaultPerson = -1,
	    images = [],
	    training = false;
     	var numNulls, sentTimes, receivedTimes;

	var videoEl = document.getElementById("videoel"); // To truely get the video.
	var vidReady = false;

	$("#login-submit").click(function(e) {
		e.preventDefault();
		username = $("#username").val();
		console.log(localStorage.getItem("username"));
		if (username !== "" && localStorage.getItem("username") == username) {
		console.log("click");
			initCamera();
			loadImages(username);		
		}
	});

	function initCamera() {
		$("#login-form").hide();
		$("#camera").show();
		$("#add-name").html(username);

		if (navigator.getUserMedia) {
         		var videoSelector = {video : true};
        		navigator.getUserMedia(videoSelector, webcamSuccessCb, function() {
             			alert("Error fetching video from webcam");
         		});
     		} else {
         		alert("No webcam detected.");
     		}

     		createSocket("ws:" + window.location.hostname + ":9000", "Local");		

	}

	
	function createSocket(address, name) {
	    socket = new WebSocket(address);
	    socketName = name;
	    socket.binaryType = "arraybuffer";
	    socket.onopen = function() {
		console.log("Connected to " + name);
		sentTimes = [];
		receivedTimes = [];
		tok = defaultTok;
		numNulls = 0

		socket.send(JSON.stringify({'type': 'NULL'}));
		sentTimes.push(new Date());

	    }
	    socket.onmessage = function(e) {
		//console.log(e);
		data = JSON.parse(e.data);
		console.log(data);
		if (data.type == "NULL") {
		    receivedTimes.push(new Date());
		    numNulls++;
		    if (numNulls == defaultNumNulls) {
		        sendState();
		        sendFrameLoop();
			addPersonCallback();
		    } else {
		        socket.send(JSON.stringify({'type': 'NULL'}));
		        sentTimes.push(new Date());
		    }
		} else if (data.type == "PROCESSED") {
		    tok++;
		} else if (images.length > 0 && data.type == "ANNOTATED") {
		    $(videoEl).hide();
		    $("#detectedFaces").html(
		        "<img src='" + data['content'] + "' width='430px'></img>"
		    );
		} else if (data.type == "IDENTITIES") {
		    var h = "";
		    var len = data.identities.length
		    if (len > 0) {
		        for (var i = 0; i < len; i++) {
		            var idIdx = data.identities[i];
		            if (idIdx != -1) {
		                h = "<h1>Signed in, " + people[idIdx] + "</h1>";
		            } else {
		                h = "<h2>Unknown, signed out.</h2>";
			    }
		        }
		    } else {
		        h = "<h2>Nobody detected, signed out.</h2>";
		    }
		    $("#status").html(h);
		}
	    }	
	    socket.onerror = function(e) {
		console.log("Error creating WebSocket connection to " + address);
		console.log(e);
	    }
	    socket.onclose = function(e) {
		if (e.target == socket) {
		    console.log("Disconnected.");
		}
	    }
	}

	function sendFrameLoop() {
    		if (socket == null || socket.readyState != socket.OPEN || !vidReady || numNulls != defaultNumNulls) {
        		return;
    		}

    		if (tok > 0) {
        		var canvas = document.createElement('canvas');
        		canvas.width = videoEl.width;
        		canvas.height = videoEl.height;
        		var cc = canvas.getContext('2d');
       			cc.drawImage(videoEl, 0, 0, videoEl.width, videoEl.height);
        		var apx = cc.getImageData(0, 0, videoEl.width, videoEl.height);

        		var dataURL = canvas.toDataURL('image/jpeg', 0.6)

        		var msg = {
            			'type': 'FRAME',
            			'dataURL': dataURL,
            			'identity': username
        		};
        		socket.send(JSON.stringify(msg));
        		tok--;
    		}
    		setTimeout(function() {requestAnimFrame(sendFrameLoop)}, 250);
	}
	
	function loadImages(username) {
		var numOfImages = localStorage.getItem("images_"+username);
		if (numOfImages > 0) {
			for(var i=1;i<numOfImages;i++) {
		    		images.push({
		        		hash: localStorage.getItem("images_"+username+"_"+i+"_hash"),
		        		identity: localStorage.getItem("images_"+username+"_"+i+"_identity"),
		        		image: localStorage.getItem("images_"+username+"_"+i+"_image"),
		        		representation: localStorage.getItem("images_"+username+"_"+i+"_representation")
		    		});
			}
		}
		
	}

	function addPersonCallback() {
	    //console.log(people);
	    defaultPerson = people.length;
	    people.push(username);

	    if (socket != null) {
		var msg = {
		    'type': 'ADD_PERSON',
		    'val': username
		};
		socket.send(JSON.stringify(msg));
	    }
	}

	function sendState() {
	    var msg = {
		'type': 'ALL_STATE',
		'images': images,
		'people': people,
		'training': training
	    };
	    socket.send(JSON.stringify(msg));
	}
	
	function webcamSuccessCb(stream) {
    		if (videoEl.mozCaptureStream) {
        		videoEl.mozSrcObject = stream;
    		} else {
        		videoEl.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
    		}
    		videoEl.play();
    		vidReady = true;
    		sendFrameLoop();
	}
});
