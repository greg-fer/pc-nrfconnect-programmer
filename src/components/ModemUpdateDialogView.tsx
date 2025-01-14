/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Form from 'react-bootstrap/Form';
import ProgressBar from 'react-bootstrap/ProgressBar';
import { useDispatch, useSelector } from 'react-redux';
import {
    Alert,
    DialogButton,
    GenericDialog,
    logger,
    selectedDevice,
    useStopwatch,
} from '@nordicsemiconductor/pc-nrfconnect-shared';
import { Progress } from '@nordicsemiconductor/pc-nrfconnect-shared/nrfutil';

import { performUpdate } from '../actions/modemTargetActions';
import { getZipFilePath } from '../reducers/fileReducer';
import {
    getShowModemProgrammingDialog,
    setShowModemProgrammingDialog,
} from '../reducers/modemReducer';
import { getForceMcuBoot } from '../reducers/settingsReducer';
import { WithRequired } from '../util/types';

const ModemUpdateDialogView = () => {
    const abortController = useRef(new AbortController());
    const [progress, setProgress] =
        useState<WithRequired<Progress, 'message'>>();
    const [writing, setWriting] = useState(false);
    const [writingFail, setWritingFail] = useState(false);
    const [writingSucceed, setWritingSucceed] = useState(false);
    const [writingFailError, setWritingFailError] = useState<string>();

    const device = useSelector(selectedDevice);
    const modemFwName = useSelector(getZipFilePath);
    const isVisible = useSelector(getShowModemProgrammingDialog);
    const isMcuboot =
        (useSelector(getForceMcuBoot) || !!device?.traits.mcuBoot) &&
        !device?.traits.jlink;

    const expectedFwName =
        !modemFwName || /mfw_nrf9160_\d+\.\d+\.\d+\.*.zip/.test(modemFwName);

    useEffect(() => {
        if (isVisible) {
            setProgress(undefined);
            setWriting(false);
            setWritingSucceed(false);
            setWritingFail(false);
            setWritingFailError(undefined);
        } else {
            abortController.current.abort();
        }
    }, [isVisible]);

    const dispatch = useDispatch();
    const onCancel = useCallback(() => {
        if (!writing) {
            dispatch(setShowModemProgrammingDialog(false));
        }
    }, [dispatch, writing]);

    const { time, start, pause, reset } = useStopwatch({
        autoStart: false,
    });

    const onWriteStart = () => {
        if (!device) {
            logger.error('No target device!');
            return;
        }

        if (!modemFwName) {
            logger.error('No file selected');
            return;
        }

        reset();
        start();

        setWriting(true);
        setProgress(progress);

        abortController.current = new AbortController();
        performUpdate(
            device,
            modemFwName,
            programmingProgress => {
                let updatedProgress: WithRequired<Progress, 'message'> = {
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
                    !programmingProgress.result &&
                    programmingProgress.operation === 'upload_image'
                ) {
                    updatedProgress = {
                        ...programmingProgress,
                        message: `Uploading image. This will take some time.`,
                    };
                }
                setProgress(updatedProgress);
            },
            abortController.current
        )
            .then(() => setWritingSucceed(true))
            .catch(error => {
                if (!abortController.current.signal.aborted) {
                    setWritingFailError(error.message);
                    setWritingFail(true);
                }
            })
            .finally(() => setWriting(false));
    };

    useEffect(() => {
        if (writingSucceed || writingFail) {
            pause();
        }
    }, [writingFail, writingSucceed, pause]);

    return (
        <GenericDialog
            title={`Modem DFU ${isMcuboot ? ' via MCUboot' : ''}`}
            showSpinner={writing}
            onHide={onCancel}
            closeOnEsc
            closeOnUnfocus
            footer={
                <>
                    <DialogButton
                        variant="primary"
                        onClick={onWriteStart}
                        disabled={
                            writing ||
                            writingSucceed ||
                            writingFail ||
                            !modemFwName
                        }
                    >
                        Write
                    </DialogButton>
                    <DialogButton
                        variant="secondary"
                        onClick={onCancel}
                        disabled={writing}
                    >
                        Close
                    </DialogButton>
                </>
            }
            isVisible={isVisible}
        >
            <>
                <Form.Group>
                    <Form.Label>
                        <b>Modem firmware</b>
                    </Form.Label>
                    <div>{modemFwName}</div>
                </Form.Group>
                <Form.Group>
                    {!writing &&
                        !writingSucceed &&
                        !writingFail &&
                        !expectedFwName && (
                            <Alert
                                label="Unexpected file name detected"
                                variant="warning"
                            >
                                <br />
                                Nordic official modem firmware files are named
                                mfw_nrf9160_X.X.X*.zip.
                                <br />
                                Modem firmware files can be downloaded from{' '}
                                <a
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href="https://www.nordicsemi.com/Products/Development-hardware/nrf9160-dk/download#infotabs"
                                >
                                    www.nordicsemi.com
                                </a>
                                .
                            </Alert>
                        )}
                </Form.Group>
                {writing && (
                    <Form.Group>
                        <Form.Label>
                            <strong>Status: </strong>
                            <span>{`${
                                progress ? progress.message : 'Starting...'
                            }`}</span>
                        </Form.Label>
                        {progress && (
                            <ProgressBar
                                hidden={!writing}
                                now={progress.stepProgressPercentage}
                                style={{ height: '4px' }}
                            />
                        )}
                    </Form.Group>
                )}
                <Form.Group>
                    {isMcuboot &&
                        !writing &&
                        !writingSucceed &&
                        !writingFail && (
                            <Alert variant="warning">
                                <p className="mb-0">
                                    You are now performing modem DFU via
                                    MCUboot.
                                </p>
                                <p className="mb-0">
                                    The device will be overwritten if you
                                    proceed to write.
                                </p>
                                <p className="mb-0">
                                    Make sure the device is in{' '}
                                    <strong>MCUboot mode</strong>.
                                </p>
                            </Alert>
                        )}
                    {writingSucceed && !writingFail && (
                        <Alert variant="success">
                            Completed successfully in
                            {` ${Math.round(time / 1000)} `}
                            seconds.
                        </Alert>
                    )}
                    {writingFail && !writing && (
                        <Alert variant="danger">
                            {writingFailError?.trim() ||
                                'Failed. Check the log below for more details...'}
                        </Alert>
                    )}
                </Form.Group>
            </>
        </GenericDialog>
    );
};

ModemUpdateDialogView.defaultProps = {};

export default ModemUpdateDialogView;
