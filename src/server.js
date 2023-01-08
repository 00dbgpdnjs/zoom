import http from "http";
//import WebSocket from "ws"; // 이거 보다 더 좋은 socket IO를 쓸거임
// import { Server } from "socket.io";
// import { instrument } from "@socket.io/admin-ui"; // 서버 UI
import SocketIO from "socket.io";
import express from "express"; // views를 설정해주고 render하고, 나머지는 websocket에서 실시간으로 일어남
import { off } from "process";

const app = express();

// pug 페이지들을 렌더하기 위해 pug 설정
app.set("view engine", "pug");
app.set("views", __dirname + "/views");

app.use("/public", express.static(__dirname + "/public"));
//app.get("/", (req, res) => res.render("home")); // 1st : request, 2nd: response  ==> http protocol : 즉 페이지 요청하면 렌더링함
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/")); // home만 사용할거기 때문에 다른 url 입력하면 홈으로 리다이렉트

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer); // 아래 block commnet 대신

wsServer.on("connection", (socket) => {
    socket.on("join_room", (roomName) => {
        socket.join(roomName)
        socket.to(roomName).emit("welcome");
    })
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    });
    // 모두에게 알림
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    });
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice);
    })
});


/* socketIO
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"], // server url에 http://localhost:3000/ 입력
        credentials: true,
    },
});
instrument(wsServer, {
    auth: false,
})

// *브라우저가 제공하는 websocket API를 사용했을 때와 달리 socketIO를 사용하려면 서버와 clinet/브라우저에 설치해야함

//public room의 ID만 가져오기
//*모든 소켓은 private room이 있음 = 방 이름이 소켓 Id
function publicRooms() {
    const {
        sockets: {
            adapter: { sids, rooms},
        },
    } = wsServer; // ; wsServer.sockets.adapter.sids
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined) {
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countRoom(roomName){
    //? : roomName을 못 찾을 수도 있으니까
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
    //console.log(socket);
    // 1st: 원하는 이벤트
    // socket.on("enter_room", (a, b, c, d) => {
    //     console.log(a, b, c, d);
    // })
    // socket.on("enter_room", (msg, done) => {
    //     console.log(msg);
    //     // done()이 처리하기 오래 걸린다고 가정하기 위해
    //     // setTimeout(() => {
    //     //     //서버는 front-end 즉 app.js의 c001을 실행시킴,
    //     //     // 서버는 백엔드에서 done()을 호출하지만 front-end에서 실행됨
    //     //     done(); 
    //     // }, 10000);
    // });

    socket["nickname"] = "Anon";
    //소켓의 모든 event를 살피는 작은 스파이
    socket.onAny((event) => {
        //adapter : 다른 서버들 사이에 실시간 앱 동기화
        //console.log(wsServer.sockets.adapter);
        console.log(`Socket Event:${event}`);
    });
    socket.on("enter_room", (roomName, done) => {
        //console.log(roomName);
        //console.log(socket.id);
        // socket.join()로 새로운 방 생성 전 방들
        // join()으로 생성 안해도 디폴트로 1개의 방이 있음 : 유저와 서버 사이의 private room
        //console.log(socket.rooms); 
        socket.join(roomName); //방에 참가
        //console.log(socket.rooms); // join()으로 새로운 방을 포함한 모든 방
        // setTimeout(() => {
        //     // done()을 콜했을 때 백엔드가 done()를 실행하는 것이 아닌 프론트엔드/app.js의 backendDone()이 실행됨. app.js의 콜백이니까. 백엔드에서 실행하면 보안 문제 발생할 수 있으니까.
        //     //done();
        //     done("hello from the backend"); 
        // }, 10000);
        done();
        // "welcome" 이벤트를 roomName에 있는 자신을 제외한 모든 사람들에게 emit. 누군가가 들어왔다는 것을 알리기 위해
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        // 모든 방에 ;broadcast
        wsServer.sockets.emit("room_change", publicRooms());
    });
    // 클라이언트가 서버와 연결이 끊어지기 전에 굿바이 보냄
    socket.on("disconnecting", () => {
        //disconnecting은 떠나기 전이라서 room에 접근 가능
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1));
    });
    socket.on("disconnect", () => {
        //disconnecting에 하면 끊기기 직전에 실행되니까 publicRooms()에 퇴장할 방까지 포함됨.
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    // 소켓에 닉네임 저장
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname))
}); */

/* << web socket >>
// http server
// 1st : express app 으로부터 서버를 만듦
const server = http.createServer(app);

// websocket server
// 인자를 넣으면 같은 서버/포트 [ws://localhost:3000]에서 http서버, webSocket서버 둘 다 돌릴 수 있음 
// ;http서버 위에 websocket 서버 만듦
// ;서버는 http, ws 2개의 프로토콜을 이해할 수 있게 됨
const wss = new WebSocket.Server({ server });

//*socket: 백엔드에 연결된 사람의 정보; 서버와 브라우저 사이의 연결; 연결된 브라우저와의 연락라인. 이것을 이용하면 메세지 주고 받기 가능
// 정확히는 server.js의 소켓은 연결된 브라우저를 뜻함.
// 이 socket이 frontend와 실시간으로 소통할 수 있음
// function handleConnection(socket) {
//     console.log(socket);
// }

//fake DB
// brave 브라우저가 연결되면 brave의 소켓을 여기에 넣음
//받은 메시지를 다른 모든 소켓에 전달해줄 수 있도록
const sockets = [];

//cf) frontend의 eventLister(which event, callback)
//1st: 누군가 우리와 연결했을 때
// connection이 생기면 소켓을 받음
// 파이어폭스 브라우저로 사용자가 이 서버에 접속할 때, 크롬 브라우저로 사용자가 서버에 접속할 때 독립적으로 실행됨
//wss.on("connection", handleConnection)
wss.on("connection", (socket) => {
    sockets.push(socket);
    socket["nickname"] = "Anon"; // 익명이 디폴트
    //console.log(socket);
    console.log("Connected to Browser");
    // frontend의 addEventListener과 유사
    // 홈페이지를 닫을 때
    socket.on("close", () => console.log("Disconnected from the Brower"));
    // 브라우저가 서버에 메세지 보냈을 때를 위한 리스너 등록
    socket.on("message", (msg) => {
        //console.log(msg);
        // const translatedMessageData = msg.toString('utf8');
        // console.log(translatedMessageData);

        // 사용자 -> 서버 -> 사용자  : 혼자 대화 ;카톡의 "나와의 채팅"
        // cf) 크롬 브라우저 사용자 -> 서버 -> 파이어폭스 브라우저 사용자  : 두 명이 대화; 삼각형 구조
        //socket.send(msg);
        const messageString = msg.toString('utf8');
        
        //socket.send(messageString);
        // 연결된 모든 소켓에 접근
        //sockets.forEach(aSocket => aSocket.send(messageString));

        // parse(): string -> javascript object
        // 메세지가 무슨 타입인지 확인하기 위해
        // new_message type의 메시지를 받는 경우와, nickname 타입의 메시지를 받는 경우를 구별
        const message = JSON.parse(messageString);
        //console.log(message, messageString);        
        
        switch (message.type) {
            case "new_message":
                // sockets.forEach(aSocket => aSocket.send(message.payload));
                sockets.forEach((aSocket) => 
                    aSocket.send(`${socket.nickname}: ${message.payload}`)
                );
            case "nickname": 
                //console.log(message.payload);
                //각 소켓이 누구인지 알기위해 소켓 객체에 새로운 item/property인 nickname 추가
                // nickname type의 메세지면 nickname 업데이트
                socket["nickname"] = message.payload;
        }   
    });
    //socket.send("hello!!!");
}); */

const handleListen = () => console.log('Listening on http://localhost:3000');

//app.listen(3000); // url: localhost:3000
//app.listen(3000, handleListen);
//server.listen(3000, handleListen);
httpServer.listen(3000, handleListen);