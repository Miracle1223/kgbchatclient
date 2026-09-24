// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Preload for the incoming-call popup window (KGBChat custom).

import type {IpcRendererEvent} from 'electron';
import {contextBridge, ipcRenderer} from 'electron';

import {INCOMING_CALL_ACTION, INCOMING_CALL_DATA} from 'common/communication';

contextBridge.exposeInMainWorld('incomingCallAPI', {
    onData: (listener: (data: {callerName: string; channelType: string}) => void) => {
        ipcRenderer.on(INCOMING_CALL_DATA, (_: IpcRendererEvent, data: {callerName: string; channelType: string}) => listener(data));
    },
    join: () => ipcRenderer.send(INCOMING_CALL_ACTION, 'join'),
    dismiss: () => ipcRenderer.send(INCOMING_CALL_ACTION, 'dismiss'),
});
