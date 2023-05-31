import { WebSocket } from 'ws';

const socket = new WebSocket('ws://127.0.0.1:8421/ws');

socket.on('message', (msg) => console.log(msg.toString('utf-8')));
