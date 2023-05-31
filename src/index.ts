import FFmpeg from "./memetan/FFmpeg.js";
import GPIO from "./memetan/GPIO.js";
import { PiSugarButton } from "./memetan/PiSugarButton.js";
import BMX055 from "./memetan/devices/BMX055.js";
import GPS from "./memetan/devices/GPS.js";
import fs from "fs";

const gps = new GPS();
const bmx055 = new BMX055();
const psButton = new PiSugarButton();
let isStart = false;
let interval: NodeJS.Timeout | undefined;

let videoFile: fs.WriteStream | undefined;
let logFile: fs.WriteStream | undefined;
let ffmpeg: FFmpeg | undefined;

// シングルクリックでプロセススタート/ストップ
if (process.argv[2] === undefined){
    psButton.on('single', buttonClickedProcess);
}

// GPIO初期設定
const gpio = await GPIO.init(21, 'out');

// GPS起動
gps.startParsing();
//gps.on('update', () => console.log(gps.getCurrentState()));

if (process.argv[2] !== undefined){
    // 起動パラメータが指定されている場合は即記録開始
    buttonClickedProcess();
    console.log('Start With Recording');
}

// 記録開始／停止処理
function buttonClickedProcess(){
    console.log('buttonClickedProcess');
    if (!isStart){
        isStart = true;
        recordProcess();
    }else{
        isStart = false;
        stopRecordingProcess();
    }
}

// 動画・ログ記録処理
function recordProcess(){
    console.log('recordProcess');

    // LED ON
    gpio.setValue(1);

    const date = new Date().toLocaleString('ja-JP').replaceAll('/', '-');

    // 動画撮影
    ffmpeg = new FFmpeg([
        '-f', 'video4linux2', '-input_format', 'h264', '-video_size', '640x480', '-framerate', '24', '-i', '/dev/video0', '-vcodec', 'copy', '-an', '-f', 'mpeg', '-'
    ]);
    videoFile = fs.createWriteStream(`./data/video-${date}.mpg`);
    ffmpeg.pipe(videoFile, { end: true });
    logFile = fs.createWriteStream(`./data/data-${date}.log`);

    // ログ出力
    logData(logFile);
    interval = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        logData(logFile!);
    }, 1000);
}

function logData(log : fs.WriteStream): void {
    let logStr = new Date().toLocaleString('ja-JP');
    logStr += ",";
    const acc = bmx055.readAcceleration();
    logStr += acc.x;
    logStr += ",";
    logStr += acc.y;
    logStr += ",";
    logStr += acc.z;
    logStr += ",";
    logStr += gps.getCurrentState()?.type;
    logStr += ",";
    logStr += gps.getCurrentState()?.utcTime;
    logStr += ",";
    logStr += gps.getCurrentState()?.coordinate.latitude;
    logStr += ",";
    logStr += gps.getCurrentState()?.coordinate.latitudeType;
    logStr += ",";
    logStr += gps.getCurrentState()?.coordinate.longitude;
    logStr += ",";
    logStr += gps.getCurrentState()?.coordinate.longitudeType;
    logStr += ",";
    logStr += gps.getCurrentState()?.reciveStatus;
    logStr += ",";
    logStr += gps.getCurrentState()?.numSatelites;
    logStr += ",";
    logStr += gps.getCurrentState()?.horizontalPrecisionLossRate;
    logStr += ",";
    logStr += gps.getCurrentState()?.seaLevelHeight;
    logStr += ",";
    logStr += gps.getCurrentState()?.seaLevelHeightType;
    logStr += ",";
    logStr += gps.getCurrentState()?.geoidHeight;
    logStr += ",";
    logStr += gps.getCurrentState()?.geoidHeightType;
    logStr += ",";
    logStr += gps.getCurrentState()?.timeAfterLastDGPSCommunication;
    logStr += ",";
    logStr += gps.getCurrentState()?.differentialReferencePointID;
    logStr += ",";
    logStr += gps.getCurrentState()?.checksum;
    logStr += "\n";

    console.log(gps.getCurrentState());
    console.log(logStr);    //あとでけす
    log.write(Buffer.from(logStr, 'utf-8'));
}

// 動画・ログ記録中止処理
function stopRecordingProcess() {
    console.log('stopRecordingProcess');
    clearInterval(interval);

    // LED OFF
    gpio.setValue(0);

    ffmpeg?._flush(() => console.log('ffmpeg close ok'));
    logFile?.end();
}

function finalize(noDestroyGPIO?: boolean) {
    console.log('finalize');
    stopRecordingProcess();

    gps.destroy();
    bmx055.destroy();
    psButton.destroy();

    if (!noDestroyGPIO) gpio.destroy();

    process.exit();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onError(e: any) {
    // LED ERROR SIGN
    console.log('onError');

    try { stopRecordingProcess(); } catch {}

    let i = 0;
    const scheduleNext = () => setTimeout(() => {
        i++;
        gpio.setValue(0);
        setTimeout(() => {
            gpio.setValue(1);

            if (i <= 5) {
                scheduleNext();
            } else {
                gpio.destroy();
                process.exit();
            }
        }, 500);
    }, 500);
    scheduleNext();

    console.log(e);
    logFile?.write(e.toString());
    finalize(true);
}

process.on('SIGINT', () => {
    console.log('SIGINT');
    stopRecordingProcess();
    finalize();
});
process.on('uncaughtException', onError);
process.on('unhandledRejection', onError);
