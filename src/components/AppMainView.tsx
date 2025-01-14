/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';
import { useSelector } from 'react-redux';
import {
    Alert,
    selectedDevice,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import { getForceMcuBoot } from '../reducers/settingsReducer';
import useOpenFileFromArgs from '../useOpenFileFromArgs';
import DeviceMemoryBoxView from './DeviceMemoryBoxView';
import FileMemoryBoxView from './FileMemoryBoxView';
import McuUpdateDialogView from './McuUpdateDialogView';
import ModemUpdateDialogView from './ModemUpdateDialogView';
import UsbSdfuUpdateDialog from './UsbSdfuUpdateDialog';
import UserInputDialogView from './UserInputDialogView';
import WarningView from './WarningView';

export default () => {
    const device = useSelector(selectedDevice);
    const forcedMCUBoot = useSelector(getForceMcuBoot);

    useOpenFileFromArgs();

    return (
        <div className="app-main-view">
            <WarningView />
            {device &&
                !device.traits.jlink &&
                !device.traits.mcuBoot &&
                !forcedMCUBoot &&
                !device.traits.nordicDfu && (
                    <div className="tw-flex tw-w-full tw-max-w-5xl tw-flex-col tw-gap-2 tw-self-center">
                        <Alert variant="warning" label="Caution: ">
                            No operation possible. <br /> If the device is a
                            MCUboot device make sure it is in the bootloader
                            mode or enable MCUboot.
                            {process.platform === 'linux' && (
                                <>
                                    <br />
                                    If the device is a JLink device, please make
                                    sure J-Link Software and nrf-udev are
                                    installed.
                                </>
                            )}
                            {process.platform === 'darwin' && (
                                <>
                                    <br />
                                    If the device is a JLink device, please make
                                    sure J-Link Software is installed.
                                </>
                            )}
                        </Alert>
                    </div>
                )}
            <div className="memory-box-container tw-flex tw-h-full tw-w-full tw-max-w-5xl tw-flex-row tw-flex-nowrap tw-justify-center tw-gap-4 tw-self-center">
                <FileMemoryBoxView />
                <DeviceMemoryBoxView />
            </div>
            <UserInputDialogView />
            <ModemUpdateDialogView />
            <McuUpdateDialogView />
            <UsbSdfuUpdateDialog />
        </div>
    );
};
