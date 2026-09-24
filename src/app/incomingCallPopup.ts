// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Incoming-call popup (KGBChat custom): a small always-on-top window in the
// bottom-right corner shown when a call rings while the app is unfocused,
// similar to Teams. The calls plugin emits the events via the externalAPI
// preload; Join is relayed back as a CALLS_JOIN_REQUEST to the originating view.

import type {IpcMainEvent} from 'electron';
import {BrowserWindow, ipcMain, screen, webContents} from 'electron';
import Joi from 'joi';

import {
    CALLS_INCOMING_CALL,
    CALLS_INCOMING_CALL_ACTION,
    CALLS_INCOMING_CALL_ENDED,
    INCOMING_CALL_ACTION,
    INCOMING_CALL_DATA,
} from 'common/communication';
import {Logger} from 'common/log';
import {ipcValidate} from 'common/Validator';
import MainWindow from 'app/mainWindow/mainWindow';
import {getLocalPreload} from 'main/utils';

const log = new Logger('IncomingCallPopup');

const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 104;
const AUTO_CLOSE_MS = 45000;

const incomingCallMsgSchema = Joi.object({
    callID: Joi.string().required(),
    channelID: Joi.string().required(),
    callerName: Joi.string().allow('').required(),
    channelType: Joi.string().valid('dm', 'gm').required(),
});

type IncomingCallMsg = {
    callID: string;
    channelID: string;
    callerName: string;
    channelType: string;
};

// The popup page is self-contained; caller data arrives via IPC (never
// interpolated into the HTML) to avoid any injection risk.
const popupHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; height: 100%; font-family: 'Segoe UI', 'Ubuntu', sans-serif; user-select: none; }
  body { display: flex; align-items: center; gap: 12px; background: #1e325c; color: #fff; padding: 0 16px; box-sizing: border-box; border-radius: 8px; overflow: hidden; }
  .pulse { width: 44px; height: 44px; min-width: 44px; border-radius: 50%; background: #2d4373; display: flex; align-items: center; justify-content: center; font-size: 22px; animation: pulse 1.2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.35); } 70% { box-shadow: 0 0 0 12px rgba(255,255,255,0); } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } }
  .info { flex: 1; min-width: 0; }
  .caller { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; opacity: 0.75; }
  .btns { display: flex; gap: 8px; }
  button { border: none; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .join { background: #3db887; color: #fff; }
  .join:hover { background: #35a67a; }
  .dismiss { background: rgba(255,255,255,0.14); color: #fff; }
  .dismiss:hover { background: rgba(255,255,255,0.24); }
</style></head><body>
  <div class="pulse">&#128222;</div>
  <div class="info">
    <div class="caller" id="caller">&hellip;</div>
    <div class="sub" id="sub">Incoming call</div>
  </div>
  <div class="btns">
    <button class="join" id="join">Join</button>
    <button class="dismiss" id="dismiss">Dismiss</button>
  </div>
  <script>
    window.incomingCallAPI.onData((data) => {
      document.getElementById('caller').textContent = data.callerName;
      document.getElementById('sub').textContent = data.channelType === 'gm' ? 'Incoming group call' : 'Incoming call';
    });
    document.getElementById('join').addEventListener('click', () => window.incomingCallAPI.join());
    document.getElementById('dismiss').addEventListener('click', () => window.incomingCallAPI.dismiss());
  </script>
</body></html>`;

export class IncomingCallPopup {
    private win?: BrowserWindow;
    private current?: {msg: IncomingCallMsg; senderId: number};
    private closeTimeout?: NodeJS.Timeout;

    constructor() {
        ipcMain.on(CALLS_INCOMING_CALL, ipcValidate(this.handleIncomingCall, [incomingCallMsgSchema]));
        ipcMain.on(CALLS_INCOMING_CALL_ENDED, ipcValidate(this.handleIncomingCallEnded, [Joi.object({callID: Joi.string().required()})]));
        ipcMain.on(INCOMING_CALL_ACTION, ipcValidate(this.handleAction, [Joi.string().valid('join', 'dismiss').required()]));
    }

    private handleIncomingCall = (event: IpcMainEvent, msg: IncomingCallMsg) => {
        log.debug('handleIncomingCall', {callID: msg.callID});

        // Only pop up when the app isn't in the user's face already
        const mainWin = MainWindow.get();
        if (mainWin && mainWin.isFocused() && !mainWin.isMinimized()) {
            return;
        }

        this.close();
        this.current = {msg, senderId: event.sender.id};
        this.show();
    };

    private handleIncomingCallEnded = (_: IpcMainEvent, msg: {callID: string}) => {
        if (this.current?.msg.callID === msg.callID) {
            this.close();
        }
    };

    private handleAction = (event: IpcMainEvent, action: 'join' | 'dismiss') => {
        if (!this.win || event.sender.id !== this.win.webContents.id || !this.current) {
            return;
        }
        log.debug('handleAction', {action});

        // Relay to the originating view so the plugin joins or stops ringing
        const sender = webContents.fromId(this.current.senderId);
        if (sender && !sender.isDestroyed()) {
            sender.send(CALLS_INCOMING_CALL_ACTION, {
                action,
                channelID: this.current.msg.channelID,
                callID: this.current.msg.callID,
            });
        }
        if (action === 'join') {
            MainWindow.show();
        }
        this.close();
    };

    private show = () => {
        const {workArea} = screen.getPrimaryDisplay();
        this.win = new BrowserWindow({
            width: POPUP_WIDTH,
            height: POPUP_HEIGHT,
            x: workArea.x + workArea.width - POPUP_WIDTH - 16,
            y: workArea.y + workArea.height - POPUP_HEIGHT - 16,
            frame: false,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            show: false,
            transparent: true,
            webPreferences: {
                preload: getLocalPreload('incomingCallAPI.js'),
            },
        });
        this.win.setAlwaysOnTop(true, 'screen-saver');
        this.win.webContents.once('did-finish-load', () => {
            if (!this.win || !this.current) {
                return;
            }
            this.win.webContents.send(INCOMING_CALL_DATA, {
                callerName: this.current.msg.callerName,
                channelType: this.current.msg.channelType,
            });
            this.win.showInactive(); // never steal focus
        });
        this.win.on('closed', () => {
            this.win = undefined;
        });
        this.win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(popupHTML)}`);

        this.closeTimeout = setTimeout(this.close, AUTO_CLOSE_MS);
    };

    private close = () => {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
        if (this.win && !this.win.isDestroyed()) {
            this.win.close();
        }
        this.win = undefined;
        this.current = undefined;
    };
}

const incomingCallPopup = new IncomingCallPopup();
export default incomingCallPopup;
