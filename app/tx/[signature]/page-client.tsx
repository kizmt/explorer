'use client';

import { ErrorCard } from '@components/common/ErrorCard';
import { LoadingCard } from '@components/common/LoadingCard';
import { Signature } from '@components/common/Signature';
import { Slot } from '@components/common/Slot';
import { SolBalance } from '@components/common/SolBalance';
import { TableCardBody } from '@components/common/TableCardBody';
import { SignatureContext } from '@components/instruction/SignatureContext';
import { FetchStatus } from '@providers/cache';
import { useCluster } from '@providers/cluster';
import {
    TransactionStatusInfo,
    useFetchTransactionStatus,
    useTransactionDetails,
    useTransactionStatus,
} from '@providers/transactions';
import { useFetchTransactionDetails } from '@providers/transactions/parsed';
import { ParsedTransaction, TransactionSignature } from '@solana/web3.js';
import { Cluster, ClusterStatus } from '@utils/cluster';
import { displayTimestamp } from '@utils/date';
import { SignatureProps } from '@utils/index';
import { getTransactionInstructionError } from '@utils/program-err';
import { useClusterPath } from '@utils/url';
import bs58 from 'bs58';
import Link from 'next/link';
import React, { Suspense, useEffect, useState } from 'react';
import { RefreshCw, Settings } from 'react-feather';
import useTabVisibility from 'use-tab-visibility';

const AUTO_REFRESH_INTERVAL = 2000;
const ZERO_CONFIRMATION_BAILOUT = 5;

enum AutoRefresh {
    Active,
    Inactive,
    BailedOut,
}

type AutoRefreshProps = {
    autoRefresh: AutoRefresh;
};

type Props = Readonly<{
    params: SignatureProps;
}>;

function getTransactionErrorReason(
    info: TransactionStatusInfo,
    tx: ParsedTransaction | undefined
): { errorReason: string; errorLink?: string } {
    if (typeof info.result.err === 'string') {
        return { errorReason: `Runtime Error: "${info.result.err}"` };
    }

    const programError = getTransactionInstructionError(info.result.err);
    if (programError !== undefined) {
        return { errorReason: `Program Error: "Instruction #${programError.index + 1} Failed"` };
    }

    const { InsufficientFundsForRent } = info.result.err as { InsufficientFundsForRent?: { account_index: number } };
    if (InsufficientFundsForRent !== undefined) {
        if (tx) {
            const address = tx.message.accountKeys[InsufficientFundsForRent.account_index].pubkey;
            return { errorLink: `/address/${address}`, errorReason: `Insufficient Funds For Rent: ${address}` };
        }
        return { errorReason: `Insufficient Funds For Rent: Account #${InsufficientFundsForRent.account_index + 1}` };
    }

    return { errorReason: `Unknown Error: "${JSON.stringify(info.result.err)}"` };
}

export default function TransactionDetailsPageClient({ params: { signature: raw } }: Props) {
    let signature: TransactionSignature | undefined;

    try {
        const decoded = bs58.decode(raw);
        if (decoded.length === 64) {
            signature = raw;
        }
    } catch (err) {
        /* empty */
    }

    const status = useTransactionStatus(signature);
    const [zeroConfirmationRetries, setZeroConfirmationRetries] = useState(0);
    const { visible: isTabVisible } = useTabVisibility();

    let autoRefresh = AutoRefresh.Inactive;
    if (!isTabVisible) {
        autoRefresh = AutoRefresh.Inactive;
    } else if (zeroConfirmationRetries >= ZERO_CONFIRMATION_BAILOUT) {
        autoRefresh = AutoRefresh.BailedOut;
    } else if (status?.data?.info && status.data.info.confirmations !== 'max') {
        autoRefresh = AutoRefresh.Active;
    }

    useEffect(() => {
        if (status?.status === FetchStatus.Fetched && status.data?.info && status.data.info.confirmations === 0) {
            setZeroConfirmationRetries(retries => retries + 1);
        }
    }, [status]);

    useEffect(() => {
        if (status?.status === FetchStatus.Fetching && autoRefresh === AutoRefresh.BailedOut) {
            setZeroConfirmationRetries(0);
        }
    }, [status, autoRefresh, setZeroConfirmationRetries]);

    return (
        <div className="container mt-n3">
            <div className="header">
                <div className="header-body">
                    <h6 className="header-pretitle">Details</h6>
                    <h2 className="header-title">Transaction</h2>
                </div>
            </div>
            {signature === undefined ? (
                <ErrorCard text={`Signature "${raw}" is not valid`} />
            ) : (
                <SignatureContext.Provider value={signature}>
                    <StatusCard signature={signature} autoRefresh={autoRefresh} />
                    <Suspense fallback={<LoadingCard message="Loading transaction details" />}>
                        <DetailsSection signature={signature} />
                    </Suspense>
                </SignatureContext.Provider>
            )}
        </div>
    );
}

function StatusCard({ signature, autoRefresh }: SignatureProps & AutoRefreshProps) {
    const fetchStatus = useFetchTransactionStatus();
    const status = useTransactionStatus(signature);
    const details = useTransactionDetails(signature);
    const { cluster, clusterInfo, name: clusterName, status: clusterStatus, url: clusterUrl } = useCluster();
    const inspectPath = useClusterPath({ pathname: `/tx/${signature}/inspect` });

    // Fetch transaction on load
    useEffect(() => {
        if (!status && clusterStatus === ClusterStatus.Connected) {
            fetchStatus(signature);
        }
    }, [signature, clusterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    // Effect to set and clear interval for auto-refresh
    useEffect(() => {
        if (autoRefresh === AutoRefresh.Active) {
            const intervalHandle: NodeJS.Timeout = setInterval(() => fetchStatus(signature), AUTO_REFRESH_INTERVAL);

            return () => {
                clearInterval(intervalHandle);
            };
        }
    }, [autoRefresh, fetchStatus, signature]);

    if (!status || (status.status === FetchStatus.Fetching && autoRefresh === AutoRefresh.Inactive)) {
        return <LoadingCard />;
    } else if (status.status === FetchStatus.FetchFailed) {
        return <ErrorCard retry={() => fetchStatus(signature)} text="Fetch Failed" />;
    } else if (!status.data?.info) {
        if (clusterInfo && clusterInfo.firstAvailableBlock > 0) {
            return (
                <ErrorCard
                    retry={() => fetchStatus(signature)}
                    text="Not Found"
                    subtext={`Note: Transactions processed before block ${clusterInfo.firstAvailableBlock} are not available at this time`}
                />
            );
        }
        return <ErrorCard retry={() => fetchStatus(signature)} text="Not Found" />;
    }

    const SOL_TOKEN_IMAGE_URL = '/SOL.png'; // Replace with the actual URL
    const { info } = status.data;

    const transactionWithMeta = details?.data?.transactionWithMeta;
    const fee = transactionWithMeta?.meta?.fee;
    const transaction = transactionWithMeta?.transaction;

    let statusClass = 'success';
    let statusText = 'Success';
    let errorReason = undefined;
    let errorLink = undefined;

    if (info.result.err) {
        statusClass = 'warning';
        statusText = 'Error';

        const err = getTransactionErrorReason(info, transaction);
        errorReason = err.errorReason;
        if (err.errorLink !== undefined) {
            if (cluster === Cluster.MainnetBeta) {
                errorLink = err.errorLink;
            } else {
                errorLink = `${err.errorLink}?cluster=${clusterName.toLowerCase()}${cluster === Cluster.Custom ? `&customUrl=${clusterUrl}` : ''
                    }`;
            }
        }
    }

    return (
        <div className="d-flex justify-content-center mt-5">
            <div className="card" style={{ maxWidth: '600px', minWidth: '400px' }}>
                <div className="card-header align-items-center mb-2">
                    <h3 className="card-header-title">Overview</h3>
                    <Link className="btn btn-white btn-sm me-2" href={inspectPath}>
                        <Settings className="align-text-top me-2" size={13} />
                        Inspect
                    </Link>
                    {autoRefresh === AutoRefresh.Active ? (
                        <span className="spinner-grow spinner-grow-sm"></span>
                    ) : (
                        <button className="btn btn-white btn-sm" onClick={() => fetchStatus(signature)}>
                            <RefreshCw className="align-text-top me-2" size={13} />
                            Refresh
                        </button>
                    )}
                </div>
                <div className="p-3">
                    <div className="text-center border border-primary p-3 rounded">
                        <div className="d-flex justify-content-center align-items-center mb-2">
                            <div className="mx-3 text-muted">7DeVVqiDq…</div>
                            <div className="mx-3 font-weight-bold">Sent</div>
                            <div className="mx-3 text-muted">5SXVVJFyrc…</div>
                        </div>
                        <div className="d-flex justify-content-center align-items-center">
                        <img src={SOL_TOKEN_IMAGE_URL} alt="SOL" style={{ height: '22px', marginRight: '5px', width: '22px' }} />

                            <span className="font-weight-bold">1.23 SOL</span>
                        </div>
                    </div>
                </div>


                <TableCardBody>
                    <tr>
                        <td>Signature</td>
                        <td className="text-lg-end">
                            <Signature signature={signature} alignRight/>
                        </td>
                    </tr>

                    <tr>
                        <td>Result</td>
                        <td className="text-lg-end">
                            <h3 className="mb-0">
                                <span className={`badge bg-${statusClass}-soft`}>{statusText} </span>
                            </h3>
                        </td>
                    </tr>

                    {errorReason !== undefined && (
                        <tr>
                            <td>Error</td>
                            <td className="text-lg-end">
                                {errorLink !== undefined ? (
                                    <Link className="text-warning" href={errorLink}>
                                        {errorReason}
                                    </Link>
                                ) : (
                                    <span className="text-warning">{errorReason}</span>
                                )}
                            </td>
                        </tr>
                    )}

                    <tr>
                        <td>Timestamp</td>
                        <td className="text-lg-end">
                            {info.timestamp !== 'unavailable' ? (
                                displayTimestamp(info.timestamp * 1000, true) // Pass true to use short timezone name
                            ) : (
                                <span className="text-muted">Unavailable</span>
                            )}
                        </td>
                    </tr>

                    <tr>
                        <td>Slot</td>
                        <td className="text-lg-end">
                            <Slot slot={info.slot} link />
                        </td>
                    </tr>

                    <tr>
                        <td>Confirmations</td>
                        <td className="text-lg-end text-uppercase">
                            {info.confirmations !== 'max' ? (
                                info.confirmations === undefined ? (
                                    <span className="text-muted">Unknown</span>
                                ) : (
                                    info.confirmations
                                )
                            ) : (
                                'Max'
                            )}
                        </td>
                    </tr>

                    {fee !== undefined && (
                        <tr>
                            <td>Fee</td>
                            <td className="text-lg-end">
                                <SolBalance lamports={fee} />
                            </td>
                        </tr>
                    )}
                </TableCardBody>
            </div>
        </div>
    );
}

function DetailsSection({ signature }: SignatureProps) {
    const details = useTransactionDetails(signature);
    const fetchDetails = useFetchTransactionDetails();
    const status = useTransactionStatus(signature);
    const transactionWithMeta = details?.data?.transactionWithMeta;
    const transaction = transactionWithMeta?.transaction;
    const message = transaction?.message;
    const { status: clusterStatus } = useCluster();
    const refreshDetails = () => fetchDetails(signature);

    // Fetch details on load
    useEffect(() => {
        if (!details && clusterStatus === ClusterStatus.Connected && status?.status === FetchStatus.Fetched) {
            fetchDetails(signature);
        }
    }, [signature, clusterStatus, status]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!status?.data?.info) {
        return null;
    } else if (!details || details.status === FetchStatus.Fetching) {
        return <LoadingCard />;
    } else if (details.status === FetchStatus.FetchFailed) {
        return <ErrorCard retry={refreshDetails} text="Failed to fetch details" />;
    } else if (!transactionWithMeta || !message) {
        return <ErrorCard text="Details are not available" />;
    }

    return (
        <>
        </>
    );
}
