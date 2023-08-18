/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React from 'react';
import { useDispatch } from 'react-redux';
import {
    Device as SharedDevice,
    DeviceSelector,
    logger,
    usageData,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import { openDevice } from '../actions/targetActions';
import EventAction from '../actions/usageDataActions';
import { resetDeviceInfo } from '../reducers/deviceDefinitionReducer';
import { setShowMcuBootProgrammingDialog } from '../reducers/mcubootReducer';
import { setShowModemProgrammingDialog } from '../reducers/modemReducer';
import { deselectDevice } from '../reducers/targetReducer';

export default () => {
    const dispatch = useDispatch();

    return (
        <DeviceSelector
            onDeviceSelected={(device: SharedDevice) => {
                dispatch(openDevice(device));
            }}
            onDeviceDeselected={() => {
                usageData.sendUsageData(EventAction.CLOSE_DEVICE, '');
                dispatch(setShowMcuBootProgrammingDialog(false));
                dispatch(setShowModemProgrammingDialog(false));
                dispatch(deselectDevice());
                dispatch(resetDeviceInfo());
                logger.info('Target device closed');
            }}
            deviceListing={{
                nordicUsb: true,
                serialPorts: true,
                jlink: true,
                mcuBoot: true,
                nordicDfu: true,
            }}
        />
    );
};
