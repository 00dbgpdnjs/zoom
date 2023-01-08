//유저용 소스파일 ;frontend

//*socket IO: 사용자가 이용 중에 서버가 끊겨도 socket IO는 클라이언트단에서 재연결을 계속 시도함

// io()는 알아서 socket.io를 실행하고 있는 서버를 찾음
const socket = io()

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute"); // 음소거
const cameraBtn = document.getElementById("camera");
const cameraSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

//stream = video + audio
let myStream;
let muted = false;//디폴트가 소리 나는 상태가 되도록
let cameraOff = false;
let roomName; // 현재 있는 방 이름
let myPeerConnection;

async function getCameras() {
    try {
        //모든 장치와 미디어 장치 알려줌. 컴퓨터에 연결되거나 모바일이 가지고 있는 장지
        const devices = await navigator.mediaDevices.enumerateDevices();
        //console.log(devices);
        const cameras = devices.filter(device => device.kind == "videoinput");
        //console.log(cameras);
        // 다른 카메라로 바꾸고 싶을 때 option 중에서 선택할 수 있도록.
        //videotracks의 첫 번째 트랙 가져옴
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            // UI에서 사용자가 쓰고 있는 카메라가 토글박스에서 체크되어있게
            if(currentCamera.label == camera.label){
                option.selected = true;
            }
            cameraSelect.appendChild(option);
        })
    } catch(e) {
        console.log(e);
    }
}

async function getMedia(deviceId) {
    //getMedia()과 같이 인자(deviceId) 없이 호출할 때는 셀프 모드 카메라가 디폴트
    const initialConstrains = { 
        audio: true,
        video: { facingMode: "user" },
    };
    //getMedia(cameraSelect.value) 즉 deviceId와 함께 호출할 때
    const cameraConstrains = { 
        audio: true,
        video: { deviceId: { exact: deviceId } },
    };
    try {
        // getUserMedia: 유저의 카메라와 오디오
        myStream = await navigator.mediaDevices.getUserMedia(
            //얻고 싶은거
            // audio: true,
            // video: true,
            deviceId ? cameraConstrains : initialConstrains
        );
        //console.log(myStream);
        //stream을 myFace에 넣어주기 -> 그래야 사이트에 stream/녹화화면이 보임
        myFace.srcObject = myStream;
        //getCameras()가 한번만 실행되도록 @getMedia();는 한번만 콜되니까. 안그러면 사용자가 카메라를 고를때마다 토글박스의 선택지가 배가됨
        if (!deviceId) {
            await getCameras(); 
        }        
    } catch (e) { // error
        console.log(e);
    }
}

//getMedia();

function handleMuteClick() {
    //console.log(myStream.getAudioTracks());//오디오 트랙에 내가 쓰는 마이크 모델명도 나옴
    myStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled)); // 현재 값의 반대로 설정
    if(!muted) {
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}

function handleCameraClick() {
    //console.log(myStream.getVideoTracks());
    myStream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled)); // 현재 값의 반대로 설정
    if(cameraOff) {
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    //console.log(cameraSelect.value);
    await getMedia(cameraSelect.value);
    //peer에게 보낼 camera도 업뎃
    if(myPeerConnection) {
        //console.log(myPeerConnection.getSenders());
        const videoTrack = myStream.getVideoTracks()[0];
        // sender: 다른 브라우저로 보내진 비디오,오디오 데이터 컨트롤
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video");
        //console.log(videoSender);
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
cameraSelect.addEventListener("input", handleCameraChange);



// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection(); // 사용자를 서로 연결
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    //console.log(input.value);
    //initCall: 우리 media를 가져가서 연결을 만들어줌
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit)


// Socket Code


// peer B가 방에 참가하면 peer A에서만 실행되는 코드
// firefox가 방에 참가하면 알림을 받는게 brave니까 brave가 peer A
// ;brave가 offer을 만드는 주체
// *offer: 다른 브라우저가 참가할 수 있도록 초대장 만듬
socket.on("welcome", async () => {
    //console.log("someone joined");
    //3.
    const offer = await myPeerConnection.createOffer();//offer과 우리가 누구, 어디있는지 등이 있음
    //console.log(offer);
        
    //4. serLocalDescription 만들기
    // : 우리가 offer를 가지면, 그 offer로 연결 구성
    myPeerConnection.setLocalDescription(offer); // peer A에게 이 description 알려줌
    console.log("sent the offer");
    //5. peer B에게 offer전송
    socket.emit("offer", offer, roomName);
});


// peer B에서만 실행됨
socket.on("offer", async (offer) => {
    console.log("received the offer");
    //console.log(offer); 
    //6. peer B [멀리떨어진@remote]의 description 세팅
    myPeerConnection.setRemoteDescription(offer);
    // 7. (peer A가 offer를 만들었으니, peer B가) answer 생성
    const answer = await myPeerConnection.createAnswer();
    //console.log(answer);
    // 8. peer B에 answer 세팅
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

socket.on("answer", answer => {
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer);
});
// => 두 브라우저는 모두 localDescription과 remoteDescription을 가지게 됨

socket.on("ice", (ice) => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
})



// RTC Code

function makeConnection() {
    //<signaling process>
    //1. ex) peerConnection을 brave 브라우저와 firefox에 만들기
    myPeerConnection = new RTCPeerConnection({
        iceServers: [ // stun서버 - 공용주소 알아내기위해(폰과 컴퓨터)
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
    //ice Candidate: 브라우저가 서로 소통할 수 있게 해줌
    myPeerConnection.addEventListener("icecandidate", handleIce);
    // 마지막. addstream event 등록
    myPeerConnection.addEventListener("addstream", handleAddStream);
    //2. 우리 카메라에서 오는 이 stream의 데이터 stream를 가져다가 연결을 만듬 ;영상,오디오 연결을 통해 전달
    //-> 그 peer-to-peer 연결 [stream] 안에다가 영상트랙과 오디오트랙 넣어야함
    //console.log(myStream.getTracks());
    myStream
        .getTracks()
        .forEach((track) => myPeerConnection.addTrack(track, myStream));
}


function handleIce(data) {
    //console.log("got ice candidate");
    //console.log(data);    
    //console.log("sent candidate");
    // 각 브라우저의 자신의 모든 candidate를 다른 브라우저에게 보내줘야함
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data){
    // console.log("got an stream from my peer");
    // console.log("Peer's Stream", data.stream);
    // console.log("My Stream", myStream);
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}


/*socketIO
const welcome = document.getElementById("welcome")
const form = welcome.querySelector("form");
const room = document.getElementById("room");

let roomName;

room.hidden = true;

// function backendDone(){
//     console.log("backend done");
// }

// function backendDone(msg){
//     console.log(`The backend says: `, msg);
// }

function addMessage(message){
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    // 백엔드로 메시지 보냄
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${value}`);
    }); 
    input.value = "";
}

function handleNicknameSubmit(event) {
    event.preventDefault();
    const input = room.querySelector("#name input");
    socket.emit("nickname", input.value);
}

function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    msgForm.addEventListener("submit", handleMessageSubmit);
    nameForm.addEventListener("submit", handleNicknameSubmit);
}

function handleRoomSubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    // 1st: 메시지를 보내는게 아닌 room이라는 이벤트 만듦
    // 나머지 인자들: payload/메시지/인자 들
    // cf) websocket은 메시지만 보낼 수 있고 object를 보낼 수 없어서 object를 string으로 변환시켜서 string으로 전송할 수 있었음. socket IO는 자동으로 해줌
    //원하는 만큼 전송 가능
    //socket.emit("enter_room", { payload: input.value }, 5, "hello", true);
    // last arg: 콜백 - 서버로부터 실행되는 fn ;프론트엔드에 있는 함수를 백엔드가 실행시켜줌
    //비용이 크고 오래 걸리는 작업을 할 때 front-end에 작업 완료를 알리고 싶을 때
    // socket.emit("enter_room", { payload: input.value }, 
    //     //() => console.log("server is done!") // c001   
    // );     
    socket.emit(
        "enter_room",
        input.value,
        //backendDone
        showRoom // 서버에서 호출해줘야 실행됨
    );    
    roomName = input.value;
    input.value = "";
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", (user, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${user} arrived!`);
})
socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${left} left!`);
})

socket.on("new_message", addMessage);
//socket.on("room_change", console.log); // 2nd=  (msg) => console.log(msg)
socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    if(room.length === 0) {
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});  */



/* << web socket >>

//hello;
// alter("hi");

const messageList = document.querySelector("ul");
const nickForm = document.querySelector("#nick");
const messageForm = document.querySelector("#message");

// frontend에서 backend로 연결하는 방법 ;@ 누군가 홈페이지에 들어왔을 때 백엔드가 알도록[소켓이 얻어지도록]
//websocket: 브라우저와 서버사이의 연결
// ;정확히는 app.js의 socket은 서버로의 연결을 뜻함
// frontend도 소켓을 가지고 있으므로 frontend에서 backend로 메세지를 보낼 수 있음
//const socket = new WebSocket("http://localhost:3000") // 이거는 에러남 -> @ 내 서버[홈피]는 http 프로토콜이 아니라 ws or wss 임
//const socket = new WebSocket("ws://localhost:3000") // 폰에는 localhost:3000가 없어서 이렇게 하면 안됨
// 새로고침 할 때 이 코드가 작동
const socket = new WebSocket(`ws://${window.location.host}`) // windosw.location.host : 우리 위치 ;localhost:3000

function makeMessage(type, payload){
    const msg = { type, payload };
    // object 타입인 msg를 string으로 바꿔서 리턴
    return JSON.stringify(msg);
}

// socket이 open되었다면, 브라우저에 연결되었다고 로그를 출력
socket.addEventListener("open", () => {
    console.log("Connected to Server");
});

//메시지 받기
socket.addEventListener("message", (message) => {
    //console.log("Just got this: ", message, " from the Server")
    // console.log("New message: ", message.data, " from the Server");
    //console.log("New message: ", message.data);
    const li = document.createElement("li");
    li.innerText = message.data;
    messageList.append(li);
});
// backend도 frontend로 다양한 유형의 메세지를 보낼 수 있음
// ex) 누군가 방에 참가했음을 알리는 메세지
// 따라서 front-end는 서버로부터 받은 메세지를 parse해야함

// 터미널에서 ctrl + c 를 해서 서버가 죽으면 [서버 연결 끊기면]
socket.addEventListener("close", () => {
    console.log("Disconnected from Server");
});

// 10초 후에 보내게 하려고
// setTimeout(() => {
//     socket.send("hello from the browser!");
// }, 10000);

function handleSubmit(event) {
    event.preventDefault();
    const input = messageForm.querySelector("input");
    //console.log(input.value);
    //socket.send(input.value);
    // send()의 인자로는 object타입은 안되고, string만 가능하기 때문
    // string을 보내기 전에 object를 만들고, 그 object를 string으로 만듦
    socket.send(makeMessage("new_message", input.value));
    const li = document.createElement("li");
    li.innerText = `You: ${message.data}`;
    messageList.append(li);
    input.value = "";
}

function handleNickSubmit(event) {
    event.preventDefault();
    const input = nickForm.querySelector("input");
    //socket.send(input.value); // 이렇게 send 해버리면 서버 쪽에서 chat 타입 메세지와 구별이 안되서 다른 사용자들에게 chat으로 전송함
    // socket.send({
    //     type: "nickname",
    //     payload: input.value,
    // });
    socket.send(makeMessage("nickname", input.value));
    input.value = "";
}

messageForm.addEventListener("submit", handleSubmit);
nickForm.addEventListener("submit", handleNickSubmit); */