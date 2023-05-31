import TypedEventEmitter from "typed-emitter";
import { EventEmitter } from 'events';
import ws, { WebSocket } from 'ws';

export class PiSugarButton extends (EventEmitter  as new () => TypedEventEmitter<{
    single: () => void,
    double: () => void,
    long: () => void
}>) {
    private readonly socket: WebSocket;
    private firstPacketReceived = false;

    constructor() {
        super();
        this.socket = new WebSocket('ws://127.0.0.1:8421/ws');
        this.socket.on('message', this.onMessage.bind(this));
    }

    private onMessage(data: ws.RawData) {
        const msg = data.toString('utf-8').trim();

        console.log(msg);

        if (!this.firstPacketReceived) {
            this.firstPacketReceived = true;
            return;
        }

        switch (msg) {
            case 'single': {
                this.emit('single');
                break;
            }
            case 'double': {
                this.emit('double');
                break;
            }
            case 'long': {
                this.emit('long');
                break;
            }
        }
    }

    public destroy() {
        this.socket.close();
    }
}
