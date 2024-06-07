'use client';

import { Epoch } from '@components/common/Epoch';
import { ErrorCard } from '@components/common/ErrorCard';
import { LoadingCard } from '@components/common/LoadingCard';
import { Slot } from '@components/common/Slot';
import { TableCardBody } from '@components/common/TableCardBody';
import { TimestampToggle } from '@components/common/TimestampToggle';
import { LiveTransactionStatsCard } from '@components/LiveTransactionStatsCard';
import { StatsNotReady } from '@components/StatsNotReady';
import { useVoteAccounts } from '@providers/accounts/vote-accounts';
import { useCluster } from '@providers/cluster';
import { StatsProvider } from '@providers/stats';
import {
    ClusterStatsStatus,
    useDashboardInfo,
    usePerformanceInfo,
    useStatsProvider,
} from '@providers/stats/solanaClusterStats';
import { Status, SupplyProvider, useFetchSupply, useSupply } from '@providers/supply';
import { ClusterStatus } from '@utils/cluster';
import { abbreviatedNumber, lamportsToSol, slotsToHumanString } from '@utils/index';
import { percentage } from '@utils/math';
import React from 'react';

import { SearchBar } from './components/SearchBar';
import Logo from '@img/logos-solana/XRAY.svg';

import Image from 'next/image';
import Link from 'next/link';

export default function Page() {
    return (
        <StatsProvider>
            <SupplyProvider>
                <div className="container mt-4">
                    <StakingComponent />
                    <Image alt="XRAY" height={100} src={Logo} width={1100} className="container mt-6"/>
                    <SearchBar />
                </div>
            </SupplyProvider>
        </StatsProvider>
    );
}

function StakingComponent() {
    const performanceInfo = usePerformanceInfo();

    if (performanceInfo.status !== ClusterStatsStatus.Ready) {
        return <StatsNotReady error={performanceInfo.status === ClusterStatsStatus.Error} />;
    }

    const { avgTps } = performanceInfo;
    const averageTps = Math.round(avgTps).toLocaleString('en-US');

    return (
        <div className="row staking-card">
            <div className="col-6 col-xl">
                <div className="card">
                    <div className="card-body">
                        <h4>User TPS</h4>
                        <h1>
                        <em>{averageTps}</em> / <small>{averageTps}</small>
                            <small>{}</small>
                        </h1>
                        <h5>
                             Total TPS: <em>{averageTps}</em>
                        </h5>
                    </div>
                </div>
            </div>
            <div className="col-6 col-xl">
                <div className="card">
                <div className="card-body">
                    <h4>User TPS</h4>
                    <h1>
                        <em>{averageTps}</em> / <small>{averageTps}</small>
                    </h1>
                        <h5>
                            Total TPS: <em>{averageTps}</em>
                        </h5>
                </div>
                </div>
            </div>
        </div>
    );
}


function displayLamports(value: number | bigint) {
    return abbreviatedNumber(lamportsToSol(value));
}

function StatsCardBody() {
    const dashboardInfo = useDashboardInfo();
    const performanceInfo = usePerformanceInfo();
    const { setActive } = useStatsProvider();
    const { cluster } = useCluster();

    React.useEffect(() => {
        setActive(true);
        return () => setActive(false);
    }, [setActive, cluster]);

    if (performanceInfo.status !== ClusterStatsStatus.Ready || dashboardInfo.status !== ClusterStatsStatus.Ready) {
        const error =
            performanceInfo.status === ClusterStatsStatus.Error || dashboardInfo.status === ClusterStatsStatus.Error;
        return <StatsNotReady error={error} />;
    }

    const { avgSlotTime_1h, avgSlotTime_1min, epochInfo, blockTime } = dashboardInfo;
    const hourlySlotTime = Math.round(1000 * avgSlotTime_1h);
    const averageSlotTime = Math.round(1000 * avgSlotTime_1min);
    const { slotIndex, slotsInEpoch } = epochInfo;
    const epochProgress = percentage(slotIndex, slotsInEpoch, 2).toFixed(1) + '%';
    const epochTimeRemaining = slotsToHumanString(Number(slotsInEpoch - slotIndex), hourlySlotTime);
    const { blockHeight, absoluteSlot } = epochInfo;

    return (
        <TableCardBody>
            <tr>
                <td className="w-100">Slot</td>
                <td className="text-lg-end font-monospace">
                    <Slot slot={absoluteSlot} link />
                </td>
            </tr>
            {blockHeight !== undefined && (
                <tr>
                    <td className="w-100">Block height</td>
                    <td className="text-lg-end font-monospace">
                        <Slot slot={blockHeight} />
                    </td>
                </tr>
            )}
            {blockTime && (
                <tr>
                    <td className="w-100">Cluster time</td>
                    <td className="text-lg-end font-monospace">
                        <TimestampToggle unixTimestamp={blockTime}></TimestampToggle>
                    </td>
                </tr>
            )}
            <tr>
                <td className="w-100">Slot time (1min average)</td>
                <td className="text-lg-end font-monospace">{averageSlotTime}ms</td>
            </tr>
            <tr>
                <td className="w-100">Slot time (1hr average)</td>
                <td className="text-lg-end font-monospace">{hourlySlotTime}ms</td>
            </tr>
            <tr>
                <td className="w-100">Epoch</td>
                <td className="text-lg-end font-monospace">
                    <Epoch epoch={epochInfo.epoch} link />
                </td>
            </tr>
            <tr>
                <td className="w-100">Epoch progress</td>
                <td className="text-lg-end font-monospace">{epochProgress}</td>
            </tr>
            <tr>
                <td className="w-100">Epoch time remaining (approx.)</td>
                <td className="text-lg-end font-monospace">~{epochTimeRemaining}</td>
            </tr>
        </TableCardBody>
    );
}
