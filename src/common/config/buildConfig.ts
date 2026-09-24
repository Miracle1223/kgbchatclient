// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BuildConfig} from 'types/config';



// For detailed guides, please refer to https://docs.mattermost.com/deployment/desktop-app-deployment.html

/**
 * Build-time configuration. End-users can't change these parameters.
 * @prop {Object[]} defaultServers
 * @prop {string} defaultServers[].name - The view name for default server.
 * @prop {string} defaultServers[].url - The URL for default server.
 * @prop {string} defaultServers[].order - Sort order for server views (0, 1, 2)
 * @prop {string} helpLink - The URL for "Help->Learn More..." menu item.
 *                           If null is specified, the menu disappears.
 * @prop {boolean} enableServerManagement - Whether users can edit servers configuration.
 *                                          Specify at least one server for "defaultServers"
 *                                          when "enableServerManagement is set to false
 * @prop {[]} managedResources - Defines which paths are managed
 * @prop {[]} allowedProtocols - Defines which protocols should be automatically allowed
 * @prop {[]} trustedEmbeddedMediaOrigins - Explicit origin pairs that may share media permissions for embedded content
 */
const buildConfig: BuildConfig = {
    defaultServers: [/*
    {
      name: 'example',
      url: 'https://example.com'
    }
  */],
    // KGBChat: no external help/update links, no update phone-home
    helpLink: null,
    academyLink: null,
    upgradeLink: null,
    enableServerManagement: true,
    enableUpdateNotifications: false,
    updateNotificationURL: '',
    macAppStoreUpdateURL: '',
    windowsStoreUpdateURL: '',
    linuxUpdateURL: '',
    linuxGitHubReleaseURL: '',
    managedResources: ['trusted'],
    allowedProtocols: [
        'mattermost',
        'ftp',
        'mailto',
        'tel',
    ],
    trustedEmbeddedMediaOrigins: [],
};

export default buildConfig;
