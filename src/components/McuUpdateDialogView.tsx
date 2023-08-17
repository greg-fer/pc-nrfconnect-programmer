/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useEffect, useState } from 'react';
import Form from 'react-bootstrap/Form';
import FormLabel from 'react-bootstrap/FormLabel';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Tooltip from 'react-bootstrap/Tooltip';
import { useDispatch, useSelector } from 'react-redux';
import nrfdl from '@nordicsemiconductor/nrf-device-lib-js';
import {
    Alert,
    classNames,
    clearWaitForDevice,
    DialogButton,
    GenericDialog,
    getPersistentStore,
    logger,
    NumberInlineInput,
    selectedDevice,
    setWaitForDevice,
    Slider,
    Toggle,
    useStopwatch,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

import { canWrite, performUpdate } from '../actions/mcubootTargetActions';
import { getMcubootFilePath, getZipFilePath } from '../reducers/fileReducer';
import {
    getShowMcuBootProgrammingDialog,
    setShowMcuBootProgrammingDialog,
} from '../reducers/mcubootReducer';

const TOOLTIP_TEXT =
    'Delay duration to allow successful image swap from RAM NET to NET core after image upload. Recommended default timeout is 40s. Should be increased for the older Thingy:53 devices';

const NET_CORE_UPLOAD_DELAY = 120;

const McuUpdateDialogView = () => {
    const [progress, setProgress] = useState<nrfdl.Progress.Operation>();
    const [writing, setWriting] = useState(false);
    const [writingFail, setWritingFail] = useState(false);
    const [writingSucceed, setWritingSucceed] = useState(false);
    const [writingFailError, setWritingFailError] = useState<string>();
    const [timeoutStarted, setTimeoutStarted] = useState(false);
    const [timeoutValue, setTimeoutValue] = useState(0);

    const device = useSelector(selectedDevice);
    const isVisible = useSelector(getShowMcuBootProgrammingDialog);
    const mcubootFwPath = useSelector(getMcubootFilePath);
    const zipFilePath = useSelector(getZipFilePath);

    const [netCoreUploadDelayOffset, setNetCoreUploadDelayOffset] =
        useState(-1);

    const writingHasStarted = writing || writingFail || writingSucceed;

    const dispatch = useDispatch();

    const [uploadDelay, setUploadDelay] = useState(NET_CORE_UPLOAD_DELAY);
    const [keepDefaultTimeout, setKeepDefaultTimeout] = useState(true);
    const [showDelayTimeout, setShowDelayTimeout] = useState(true);
    const uploadDelayRange = {
        min: 20,
        max: 300,
        step: 5,
    };

    const { time, start, pause, reset } = useStopwatch({
        autoStart: false,
        resolution: 200,
    });

    useEffect(() => {
        // note: check may be redundant as Thingy:91 has a different modal
        const isThingy53 =
            device?.usb?.device.descriptor.idProduct === 0x5300 &&
            device?.usb?.device.descriptor.idVendor === 0x1915;
        setShowDelayTimeout(isThingy53);
    }, [device]);

    useEffect(() => {
        if (!isVisible) {
            setProgress(undefined);
            setWriting(false);
            setWritingSucceed(false);
            setWritingFail(false);
            setWritingFailError(undefined);
            setTimeoutStarted(false);
            setTimeoutValue(0);
        }
    }, [isVisible]);

    useEffect(() => {
        if (!showDelayTimeout || !device) return;

        const timeout =
            getPersistentStore().get(
                `firmwareProgram:device:${device.serialNumber}`
            )?.netCoreUploadDelay ?? NET_CORE_UPLOAD_DELAY;
        setUploadDelay(timeout);

        if (timeout !== NET_CORE_UPLOAD_DELAY) {
            setKeepDefaultTimeout(false);
        }
    }, [device, showDelayTimeout]);

    useEffect(() => {
        if (netCoreUploadDelayOffset === -1 && timeoutStarted) {
            setNetCoreUploadDelayOffset(Math.floor(time));
        } else if (!timeoutStarted) {
            setNetCoreUploadDelayOffset(-1);
        }
    }, [netCoreUploadDelayOffset, timeoutStarted, time]);

    const onCancel = () => {
        dispatch(clearWaitForDevice());
        dispatch(setShowMcuBootProgrammingDialog(false));
    };

    const onWriteStart = () => {
        if (!device) {
            logger.error('No target device!');
            return;
        }

        setWriting(true);
        reset();
        start();

        dispatch(
            setWaitForDevice({
                timeout: 99999999999999, // Wait 'indefinitely' as we will cancel the wait when programming is complete
                when: 'always',
                once: false,
            })
        );

        performUpdate(
            device,
            programmingProgress => {
                let updatedProgress: nrfdl.Progress.Operation = {
                    ...programmingProgress,
                    message: programmingProgress.message ?? '',
                };

                if (programmingProgress.operation === 'erase_image') {
                    updatedProgress = {
                        ...programmingProgress,
                        message: `${programmingProgress.message} This will take some time.`,
                    };
                }
                if (
                    programmingProgress.message?.match(
                        /Waiting [0-9]+ seconds to let RAM NET Core flash succeed./
                    )
                ) {
                    const timeouts = programmingProgress.message.match(/\d+/g);
                    if (timeouts?.length === 1) {
                        setTimeoutStarted(true);
                        setTimeoutValue(parseInt(timeouts[0], 10));
                    }
                }
                setProgress(updatedProgress);
            },
            mcubootFwPath,
            zipFilePath,
            showDelayTimeout ? uploadDelay : undefined
        )
            .then(() => {
                setWritingSucceed(true);
            })
            .catch(error => {
                setWritingFailError(error.message);
                setWritingFail(true);
            })
            .finally(() => {
                dispatch(canWrite());
                setWriting(false);
            });
    };

    const updateUploadDelayTimeout = (timeout: number) => {
        if (!device) return;
        setUploadDelay(timeout);
        getPersistentStore().set(
            `firmwareProgram:device:${device.serialNumber}`,
            {
                netCoreUploadDelay: timeout,
            }
        );
    };

    const toggleDefaultTimeoutUI = (shouldKeep: boolean) => {
        setKeepDefaultTimeout(shouldKeep);
        if (shouldKeep) {
            updateUploadDelayTimeout(NET_CORE_UPLOAD_DELAY);
        }
    };

    useEffect(() => {
        if (writingSucceed || writingFail) {
            pause();
        }
    }, [writingFail, writingSucceed, pause]);

    const timerProgress = timeoutStarted
        ? Math.min(
              100,
              Math.round(
                  ((time - netCoreUploadDelayOffset) / (timeoutValue * 1000)) *
                      100
              )
          )
        : progress?.progressPercentage ?? 0;

    return (
        <GenericDialog
            title="MCUboot DFU"
            isVisible={isVisible}
            onHide={onCancel}
            showSpinner={writing}
            closeOnUnfocus={false}
            className="mcu-update-dialog"
            footer={
                <>
                    <DialogButton
                        variant="primary"
                        onClick={onWriteStart}
                        disabled={writing || writingSucceed || writingFail}
                    >
                        Write
                    </DialogButton>
                    <DialogButton onClick={onCancel} disabled={writing}>
                        Close
                    </DialogButton>
                </>
            }
        >
            <Form.Group>
                <Form.Label className="mb-0">
                    <strong>Firmware:</strong>
                    <span>{` ${mcubootFwPath || zipFilePath}`}</span>
                </Form.Label>
            </Form.Group>
            {writing && (
                <Form.Group>
                    <Form.Label>
                        <strong>Status: </strong>
                        <span>{` ${
                            progress ? progress.message : 'Starting...'
                        }`}</span>
                    </Form.Label>
                    <ProgressBar
                        hidden={!writing}
                        now={timerProgress}
                        style={{ height: '4px' }}
                    />
                </Form.Group>
            )}
            {!writingHasStarted && showDelayTimeout && (
                <Form.Group className="upload-delay p-3">
                    <div className="d-flex justify-content-between">
                        <Form.Label className="mb-0">
                            <strong>
                                Keep default delay after image upload
                            </strong>
                            <OverlayTrigger
                                placement="bottom-end"
                                overlay={
                                    <Tooltip id="tooltip-delay-info">
                                        <div className="info text-left">
                                            <span>{TOOLTIP_TEXT}</span>
                                        </div>
                                    </Tooltip>
                                }
                            >
                                <span className="mdi mdi-information-outline info-icon ml-1" />
                            </OverlayTrigger>
                        </Form.Label>
                        <Toggle
                            onToggle={toggleDefaultTimeoutUI}
                            isToggled={keepDefaultTimeout}
                        />
                    </div>
                    <FormLabel
                        className={classNames(
                            'w-100 mb-0 mt-3',
                            keepDefaultTimeout ? 'd-none' : 'd-block'
                        )}
                    >
                        <div className="d-flex justify-content-between mb-2 flex-row">
                            <div>
                                <strong>Set delay duration</strong>
                            </div>
                            <div className="d-flex">
                                <NumberInlineInput
                                    value={uploadDelay}
                                    range={uploadDelayRange}
                                    onChange={updateUploadDelayTimeout}
                                />
                                <span>sec</span>
                            </div>
                        </div>
                        <Slider
                            values={[uploadDelay]}
                            onChange={[
                                (value: number) =>
                                    updateUploadDelayTimeout(value),
                            ]}
                            range={uploadDelayRange}
                        />

                        {uploadDelay !== NET_CORE_UPLOAD_DELAY && (
                            <p className="note">
                                Note: recommended delay for <i>most</i> of the
                                devices is {NET_CORE_UPLOAD_DELAY} seconds.
                            </p>
                        )}
                    </FormLabel>
                </Form.Group>
            )}
            <Form.Group>
                {!writingHasStarted && (
                    <Alert variant="warning">
                        <div>
                            <p className="mb-0">
                                You are now programming via MCUboot.
                            </p>
                            <p className="mb-0">
                                The device will be recovered if you proceed to
                                write.
                            </p>
                            <p className="mb-0">
                                Make sure the device is in{' '}
                                <strong>MCUboot mode</strong>.
                            </p>
                        </div>
                    </Alert>
                )}
                {writingSucceed && (
                    <Alert variant="success">
                        Completed successfully in {` `}
                        {` ${Math.round(time / 1000)} `}
                        {` `} seconds.
                    </Alert>
                )}
                {writingFail && (
                    <Alert variant="danger">
                        {writingFailError?.trim() ||
                            'Failed. Check the log below for more details...'}
                    </Alert>
                )}
            </Form.Group>
        </GenericDialog>
    );
};

export default McuUpdateDialogView;
