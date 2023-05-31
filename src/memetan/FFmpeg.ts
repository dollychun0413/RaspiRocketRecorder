import { Transform } from "stream";
import * as child_process from 'child_process';

export default class FFmpeg extends Transform {
    private readonly ffmpegProc: child_process.ChildProcess;

    public constructor(args: string[]) {
        super({
            allowHalfOpen: true
        });

        this.ffmpegProc = child_process.spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

        this.ffmpegProc.stdout?.on('data', (chunk): void => {
            this.push(chunk);
        });

        this.ffmpegProc.stdout?.on('end', (): void => {
            this.push(null);
        });

        this.ffmpegProc.stderr?.on('data', (chunk): void => {
            process.stdout.write(chunk);
        });
    }

    public waitForReady(): Promise<void> {
        return new Promise((resolve): void => {
            this.ffmpegProc.stderr?.on('data', resolve);
        });
    }

    public override _read(): void {
        // No need to implement anything here
    }

    override _write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        this.ffmpegProc.stdin?._write(chunk, encoding, callback);
    }

    override _flush(callback: (error?: Error | null | undefined) => void): void {
        this.ffmpegProc.stdin?.end();
        this.ffmpegProc?.kill('SIGINT');
        this.ffmpegProc.stdout?.on('close', callback);
    }
}
