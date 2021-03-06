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

	$("#register-submit").click(function(e) {
		e.preventDefault();
		username = $("#username").val();
		if (username !== "") {
			localStorage.username = username;
			initCamera();	
		}
	});

	$("#take-pic").click(function(e) {
		trainingCb();
	});

	function initCamera() {
		$("#register-form").hide();
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
		} else if (data.type == "NEW_IMAGE") {
			var imageData = getDataURLFromRGB(data.content);
            		images.push({
                		hash: data.hash,
                		identity: data.identity,
                		image: imageData,
                		representation: data.representation
            		});
			localStorage.setItem("images_"+username, images.length);
			localStorage.setItem("images_"+username+"_"+images.length+"_hash", data.hash);
			localStorage.setItem("images_"+username+"_"+images.length+"_identity", data.identity);
			localStorage.setItem("images_"+username+"_"+images.length+"_image", imageData);
			localStorage.setItem("images_"+username+"_"+images.length+"_representation", data.representation);
        	} else if (data.type == "PROCESSED") {
		    tok++;
		} else if (images.length > 0 && data.type == "ANNOTATED") {
		    $(videoEl).hide();
		    $("#detectedFaces").html(
		        "<img src='" + data['content'] + "' width='430px'></img>"
		    );
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
	function trainingCb() {
	    if (training) 
	   	 training = false;
	     else
		 training = true;

	    if (socket != null) {
		var msg = {
		    'type': 'TRAINING',
		    'val': training
		};
		socket.send(JSON.stringify(msg));
	    }

		if (images.length > 0) {
			// Remove listener.
			$("#take-pic").remove();	
		}
	}

	function getDataURLFromRGB(rgb) {
	    var rgbLen = rgb.length;

	    var canvas = $('<canvas/>').width(96).height(96)[0];
	    var ctx = canvas.getContext("2d");
	    var imageData = ctx.createImageData(96, 96);
	    var data = imageData.data;
	    var dLen = data.length;
	    var i = 0, t = 0;

	    for (; i < dLen; i +=4) {
		data[i] = rgb[t+2];
		data[i+1] = rgb[t+1];
		data[i+2] = rgb[t];
		data[i+3] = 255;
		t += 3;
	    }
	    ctx.putImageData(imageData, 0, 0);

	    return canvas.toDataURL("image/png");
	}


});

